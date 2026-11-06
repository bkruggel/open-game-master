"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { GameIcon } from "@/components/ui/GameIcon";
import { Switch } from "@/components/ui/Switch";
import { LoadFailed, PanelLoading, RowMenu, panelRow } from "@/app/campaigns/[campaignId]/PanelKit";
import { readLoad, useLoadStatus } from "@/lib/load-state";
import { DeskCard } from "@/app/campaigns/[campaignId]/DmConsoleParts";
import {
  dieForTable,
  formatRollTable,
  parseRollTable,
  tableGaps,
  TABLE_NAME_MAX,
} from "@/lib/dm/roll-table-logic";
import type { RollTable } from "@/lib/db/roll-tables";
import { offersStoryModel, useCapabilities } from "@/lib/use-capabilities";
import { Sheet } from "@/components/ui/Sheet";
import { useTourPrepare } from "@/lib/tours/prepare";
import { appendLine } from "@/lib/workshop/pickers";
import { RefPicker } from "@/app/workshop/tables/RefPicker";
import { inputClass, StatblockFinder } from "@/app/workshop/tables/StatblockFinder";
import { TableRows, type RollResult } from "@/app/workshop/tables/TableRows";
import { useT } from "@/lib/locale";

// The DM's random tables, and the monster lookup beside them. Both are the
// DM's own reference: rolling a table writes an ordinary roll everyone can
// see, but what the row SAYS comes back here alone.
//
// The painted die a table rolls on, where the kit has one that size.
const PAINTED_DICE = new Set([4, 6, 8, 10, 12, 20, 100]);
function dieGlyph(sides: number): string {
  return PAINTED_DICE.has(sides) ? `die-d${sides}` : "die-d20";
}

// Two layouts over one set of requests. "list" is the DM console's: the
// tables, the new-table form and the lookup stacked in three sections.
// "rows" is the workshop's: a searchable row per table with its coverage at
// a glance, the editor in a sheet (which is also how a saved table gets
// edited), and the lookup folded into a card of its own.

export function DmTablesPanel({
  campaignId,
  layout = "list",
}: {
  campaignId: string;
  layout?: "list" | "rows";
}) {
  const t = useT();
  const [tables, setTables] = useState<RollTable[]>([]);
  // Loaded only once the server has answered yes; a no is kept in its own
  // words (issue 140), so "No tables yet" is never drawn over a refusal.
  const { loaded, loadError, settle } = useLoadStatus();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState("");
  // The saved table the editor has open, or "" for a new one. Only the rows
  // layout ever sets it, so the console's form keeps creating as it always
  // has.
  const [editingId, setEditingId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  // Draw without replacement: a rumour heard once is not heard again.
  const [noReplacement, setNoReplacement] = useState(false);
  // Drafting rows is the story model's job; a server without one offers the
  // paste box alone.
  const canDraft = offersStoryModel(useCapabilities());
  const [error, setError] = useState("");
  const [result, setResult] = useState<RollResult | null>(null);
  const rows = layout === "rows";

  const load = useCallback(
    () =>
      readLoad<{ tables?: RollTable[] }>(t, fetch(`/api/campaigns/${campaignId}/dm/roll-tables`), t("load.label.tables")).then((outcome) => {
        if (outcome.payload) {
          setTables(outcome.payload.tables ?? []);
        }
        settle(outcome);
      }),
    [ campaignId, settle, t ],  );

  // Refetches on mount and after every edit, the same shape as BondsPanel.
  useEffect(() => {
    load().catch(() => {
      // transient; the next action reloads
    });
  }, [load]);

  async function draft() {
    if (!prompt.trim()) {
      return;
    }
    setBusy("draft");
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/dm/roll-tables/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), rows: 12 }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("tables.error.draft"));
        return;
      }
      setText(data.text ?? "");
      if (!name.trim()) {
        setName(prompt.trim().slice(0, TABLE_NAME_MAX));
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy("");
    }
  }

  // Creates a table, or rewrites the one the editor has open. The PATCH
  // takes the same name-and-text shape the POST does.
  async function save() {
    if (!name.trim() || !text.trim()) {
      return;
    }
    setBusy("save");
    setError("");
    try {
      const response = await fetch(
        editingId
          ? `/api/campaigns/${campaignId}/dm/roll-tables/${editingId}`
          : `/api/campaigns/${campaignId}/dm/roll-tables`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), text, noReplacement }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("tables.error.save"));
        return;
      }
      setName("");
      setText("");
      setPrompt("");
      setNoReplacement(false);
      setEditingId("");
      setEditorOpen(false);
      await load();
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy("");
    }
  }

  async function roll(table: RollTable) {
    setBusy(table.id);
    setError("");
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/dm/roll-tables/${table.id}/roll`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "dm" }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("tables.error.roll"));
        return;
      }
      setResult({
        tableId: table.id,
        total: data.total,
        text: data.final?.text ?? data.entry?.text ?? t("tables.result.none"),
        chain: Array.isArray(data.chain) && data.chain.length > 1 ? data.chain : [],
        remaining: typeof data.remaining === "number" ? data.remaining : null,
      });
      // A no-replacement draw changed the table's memory; the rows show it.
      if (typeof data.remaining === "number") {
        await load();
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy("");
    }
  }

  // Same create route the save button uses, with the rows written back to
  // the text shorthand it takes.
  async function duplicate(table: RollTable) {
    setBusy(`copy-${table.id}`);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/dm/roll-tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${table.name} (copy)`.slice(0, TABLE_NAME_MAX),
          text: formatRollTable(table.entries),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("tables.error.copy"));
        return;
      }
      await load();
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy("");
    }
  }

  // Puts a saved table in the editor, or clears it for a new one. A half
  // typed new table survives closing and reopening the sheet; it is only
  // thrown away when a saved table had taken its place.
  // The tour's "open the editor" step, answered where the editor is a sheet.
  useTourPrepare((name) => {
    if (name !== "open-table-editor") return;
    if (rows && !editorOpen) open(null);
    return true;
  });

  function open(table: RollTable | null) {
    setError("");
    if (table) {
      setEditingId(table.id);
      setName(table.name);
      setText(formatRollTable(table.entries));
      setNoReplacement(table.noReplacement);
      setPrompt("");
    } else if (editingId) {
      setEditingId("");
      setName("");
      setText("");
      setNoReplacement(false);
      setPrompt("");
    }
    setEditorOpen(true);
  }

  // Reset and delete: one request about a saved table, its refusal said.
  async function ask(table: RollTable, init: RequestInit, failure: string, after: () => void) {
    setBusy(table.id);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/dm/roll-tables/${table.id}`, init);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || failure);
        return;
      }
      after();
      await load();
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy("");
    }
  }

  // Forget every result dealt so far, so the deck is whole again.
  function reset(table: RollTable) {
    const init = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset: true }) };
    return ask(table, init, t("tables.error.reset"), () => setResult(null));
  }

  // A save after a delete would otherwise PATCH a table that is gone.
  function remove(table: RollTable) {
    return ask(table, { method: "DELETE" }, t("tables.error.delete"), () => {
      if (editingId === table.id) open(null);
    });
  }

  const draftEntries = parseRollTable(text);
  const gaps = draftEntries.length ? tableGaps(draftEntries) : null;
  const editing = tables.find((table) => table.id === editingId) ?? null;

  const editor = (
    <>
      <input
        value={name}
        onChange={(event) => setName(event.target.value.slice(0, TABLE_NAME_MAX))}
        placeholder={t("tables.namePlaceholder")}
        aria-label={t("tables.nameAria")}
        data-tour="tables-name"
        className={inputClass}
      />
      {canDraft ? (
        <div className="reveal mt-1.5 flex gap-1.5">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 300))}
            placeholder={t("tables.promptPlaceholder")}
            aria-label={t("tables.promptAria")}
            className={inputClass}
          />
          <button
            type="button"
            onClick={draft}
            disabled={busy === "draft" || !prompt.trim()}
            title={t("tables.draftTitle")}
            aria-busy={busy === "draft"}
            className={cn(ui.btnSmall, "shrink-0 text-xs")}
          >
            {busy === "draft" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {t("tables.draft")}
          </button>
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={rows ? 10 : 5}
        placeholder={t("tables.bodyPlaceholder")}
        aria-label={t("tables.rowsAria")}
        data-tour="tables-body"
        className={cn(inputClass, "mt-1.5 resize-y font-mono text-xs")}
      />
      <div className="mt-1.5">
        <RefPicker
          campaignId={campaignId}
          tables={tables}
          editingId={editingId}
          onInsert={(line) => setText((current) => appendLine(current, line))}
        />
      </div>
      {draftEntries.length ? (
        <p className="reveal mt-1 text-[11px] text-stone-500">
          {t("tables.rowsSummary", { count: draftEntries.length, sides: dieForTable(draftEntries) })}
          {gaps?.uncovered.length
            ? t("tables.gapUncovered", { gaps: gaps.uncovered.join(", ") })
            : ""}
          {gaps?.overlapping.length
            ? t("tables.gapOverlap", { gaps: gaps.overlapping.join(", ") })
            : ""}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="flex min-h-10 items-center gap-2 text-xs text-stone-300">
          <Switch on={noReplacement} onChange={setNoReplacement} label={t("tables.noReplacement")} />
          {t("tables.noReplacement")}
        </span>
        {editing?.noReplacement && editing.drawn.length ? (
          <button
            type="button"
            onClick={() => void reset(editing)}
            className={cn(ui.btnSmall, "px-2 py-1 text-[11px]")}
          >
            {t("tables.reset", { count: editing.drawn.length })}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-stone-500">
        {t("tables.syntaxHelp")}
      </p>
      {error ? <p role="alert" className="motion-shake mt-1 text-xs text-red-400">{error}</p> : null}
      <button
        type="button"
        onClick={save}
        disabled={busy === "save" || !name.trim() || !text.trim()}
        aria-busy={busy === "save"}
        data-tour="tables-save"
        className={cn(ui.btnPrimary, "mt-2")}
      >
        {busy === "save" ? t("tables.saving") : t("tables.save")}
      </button>
    </>
  );

  if (rows) {
    return (
      <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-4 lg:space-y-0">
        <TableRows
          tables={tables}
          loaded={loaded}
          loadError={loadError}
          onRetry={() => void load()}
          busy={busy}
          result={result}
          onOpen={open}
          onRoll={roll}
          onDuplicate={duplicate}
          onDelete={remove}
        />
        <StatblockFinder campaignId={campaignId} collapsible />
        {/* A roll or a copy that fails happens in the rows, not the sheet,
            so its message has to show out here as well. */}
        {error && !editorOpen ? (
          <p role="alert" className="motion-shake text-xs text-red-400 lg:col-span-2">{error}</p>
        ) : null}
        <Sheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          title={editing ? editing.name : t("tables.new")}
          className="lg:w-[min(92vw,40rem)]"
        >
          {editor}
        </Sheet>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DeskCard
        glyph="system-tables"
        title={t("tables.yours")}
        aside={tables.length ? <span key={tables.length} className="count-pop">{tables.length}</span> : undefined}
      >
        {tables.length ? (
          <ul className="stagger space-y-1.5">
            {tables.map((table) => {
              const sides = dieForTable(table.entries);
              // Roll stays the row's visible button. The two that were icons
              // live in the row's menu under the words they always carried.
              const items: ContextMenuItem[] = [
                { id: "roll", label: t("table.tray.roll"), glyph: dieGlyph(sides), disabled: busy === table.id, onSelect: () => void roll(table) },
                { id: "duplicate", label: t("tables.duplicate", { name: table.name }), glyph: "ui-duplicate", disabled: busy === `copy-${table.id}`, onSelect: () => void duplicate(table) },
                { id: "delete", label: t("tables.delete"), glyph: "ui-delete", tone: "danger", separated: true, onSelect: () => void remove(table) },
              ];
              return (
                <ContextMenu key={table.id} as="li" items={items} label={table.name} className={panelRow}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-stone-100">
                      <GameIcon icon={{ kind: "glyph", key: dieGlyph(sides) }} size="size-6" className="shrink-0" />
                      <span className="min-w-0 truncate">{table.name}</span>
                      <span className="shrink-0 text-[11px] text-stone-400">d{sides}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => roll(table)}
                        disabled={busy === table.id}
                        aria-busy={busy === table.id}
                        className={cn(ui.btnPrimary, "h-9 px-3 text-[11px]")}
                      >
                        {busy === table.id ? <Loader2 className="size-3.5 animate-spin" /> : t("table.tray.roll")}
                      </button>
                      <RowMenu items={items} label={table.name} />
                    </span>
                  </div>
                  {result?.tableId === table.id ? (
                    <div className="live-in mt-1.5 rounded-lg border border-amber-500/25 bg-stone-950/50 px-2 py-1.5 text-xs text-stone-200">
                      <p>
                        <span key={result.total} className="count-pop inline-block font-display text-amber-200">{result.total}:</span> {result.text}
                      </p>
                      {result.chain.map((line, index) => (
                        <p key={index} className="text-[11px] text-stone-400">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </ContextMenu>
              );
            })}
          </ul>
        ) : loaded ? (
          <EmptyState size="sm" art="scrolls" title={t("tables.empty")} />
        ) : loadError ? (
          <LoadFailed error={loadError} onRetry={() => void load()} />
        ) : (
          <PanelLoading label={t("action.loading")} rows={2} />
        )}
        {loaded && loadError ? <LoadFailed error={loadError} onRetry={() => void load()} /> : null}
      </DeskCard>

      <DeskCard glyph="system-homebrew" title={t("tables.new")}>
        {editor}
      </DeskCard>

      <StatblockFinder campaignId={campaignId} />
    </div>
  );
}
