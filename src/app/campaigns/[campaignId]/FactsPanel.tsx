"use client";

import { EmptyState } from "@/components/EmptyState";
import { BookMarked, Check, Eye, EyeOff, Pin, PinOff, X } from "lucide-react";
import { useState } from "react";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { SectionHead } from "@/components/ui/SectionHead";
import { cn } from "@/lib/cn";
import type { WorldFact } from "@/lib/db/facts";
import { FACT_CATEGORIES, isSecretFact, isStorytellerFact, type FactCategory } from "@/lib/dm/fact-logic";
import { KitButton, PanelError, RowMenu, panelField, panelRow } from "./PanelKit";
import { DictateField } from "@/components/DictateField";
import { appendDictation } from "@/lib/dictation";
import { useT } from "@/lib/locale";

// The world-state fact sheet: server-tracked canon extracted at chapter
// close (plus manual pins). Everyone sees party-known facts; the lead can
// pin, edit, retire, add facts, and peek at DM-only secrets.

// The categories' words by value; the keys live with the facts group.
const CATEGORY_KEYS: Record<FactCategory, "facts.category.location" | "facts.category.npc" | "facts.category.promise" | "facts.category.world" | "facts.category.party" | "facts.category.lore"> = {
  location: "facts.category.location",
  npc: "facts.category.npc",
  promise: "facts.category.promise",
  world: "facts.category.world",
  party: "facts.category.party",
  lore: "facts.category.lore",
};

// The painted glyph each heading leads with.
const CATEGORY_GLYPHS: Record<FactCategory, string> = {
  location: "tab-map",
  npc: "tab-bonds",
  promise: "coin-purse",
  world: "system-region",
  party: "tab-party",
  lore: "system-lore",
};

function FactCard({
  campaignId,
  fact,
  steersStory,
  refresh,
}: {
  campaignId: string;
  fact: WorldFact;
  steersStory: boolean;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.fact);
  const [busy, setBusy] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/facts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factId: fact.id, ...payload }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const pinTitle = fact.pinned ? t("facts.unpin") : t("facts.pin");
  const items: ContextMenuItem[] = steersStory
    ? [
        { id: "pin", label: pinTitle, glyph: "ui-pin", disabled: busy, onSelect: () => void patch({ pinned: !fact.pinned }) },
        { id: "edit", label: t("action.edit"), glyph: "ui-edit", onSelect: () => setEditing(true) },
        {
          id: "retire",
          label: t("facts.retire"),
          glyph: "ui-delete",
          tone: "danger",
          separated: true,
          disabled: busy,
          onSelect: () => void patch({ status: "retired" }),
        },
      ]
    : [];

  return (
    <ContextMenu as="li" items={editing ? [] : items} label={fact.subject || t(CATEGORY_KEYS[fact.category])} className={panelRow}>
      {editing ? (
        <div className="reveal space-y-1.5">
          <DictateField label={t("facts.fact")} onTranscript={(spoken) => setText((current) => appendDictation(current, spoken, 300))}>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={2}
              maxLength={300}
              aria-label={t("facts.fact")}
              className={cn(panelField, "leading-5")}
            />
          </DictateField>
          <div className="flex gap-1.5">
            <KitButton
              tone="primary"
              disabled={busy || !text.trim()}
              busy={busy}
              onClick={async () => {
                await patch({ fact: text.trim() });
                setEditing(false);
              }}
            >
              {busy ? null : <Check className="size-3.5" />}
              {t("action.save")}
            </KitButton>
            <KitButton
              onClick={() => {
                setEditing(false);
                setText(fact.fact);
              }}
            >
              <X className="size-3.5" /> {t("action.cancel")}
            </KitButton>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs leading-5 text-stone-300">
            {fact.pinned ? <Pin className="mr-1 inline size-3 text-amber-400" /> : null}
            {fact.subject ? (
              <span className="font-medium text-amber-200">{fact.subject}: </span>
            ) : null}
            {fact.fact}
          </p>
          <div className="mt-1 flex min-h-6 items-center gap-2 text-[11px] text-stone-500">
            <span className={isSecretFact(fact.knownBy) ? "text-violet-300" : undefined}>
              {isStorytellerFact(fact.knownBy) ? t("facts.storytellerSecret") : isSecretFact(fact.knownBy) ? t("facts.gmSecret") : t(CATEGORY_KEYS[fact.category])}
            </span>
            {steersStory ? (
              <span className="ml-auto flex shrink-0 items-center gap-0.5">
                <KitButton
                  tone="icon"
                  always
                  disabled={busy}
                  busy={busy}
                  onClick={() => patch({ pinned: !fact.pinned })}
                  title={pinTitle}
                  aria-label={pinTitle}
                  aria-pressed={fact.pinned}
                >
                  {busy ? null : fact.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </KitButton>
                <RowMenu items={items} label={fact.subject || t(CATEGORY_KEYS[fact.category])} />
              </span>
            ) : null}
          </div>
        </>
      )}
    </ContextMenu>
  );
}

function FactComposer({
  campaignId,
  refresh,
}: {
  campaignId: string;
  refresh: () => Promise<void>;
}) {
  const t = useT();
  const [category, setCategory] = useState<FactCategory>("world");
  const [subject, setSubject] = useState("");
  const [fact, setFact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!fact.trim() || busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject: subject.trim(), fact: fact.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("facts.error.save"));
        return;
      }
      setSubject("");
      setFact("");
      await refresh();
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel rounded-lg p-2.5">
      <SectionHead title={t("facts.pinFact")} glyph="tab-facts" level="h4" />
      <div data-pill-group="" role="group" aria-label={t("facts.categoryAria")} className="mb-1.5 flex flex-wrap gap-1">
        {FACT_CATEGORIES.map((value) => (
          <button
            data-on={category === value ? "" : undefined}
            aria-pressed={category === value}
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className="pk-pill pk-tap motion-press"
          >
            {t(CATEGORY_KEYS[value])}
          </button>
        ))}
      </div>
      <input
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        maxLength={80}
        placeholder={t("facts.subjectPlaceholder")}
        aria-label={t("facts.subjectAria")}
        className={cn(panelField, "mb-1.5")}
      />
      <DictateField label={t("facts.fact")} onTranscript={(text) => setFact((current) => appendDictation(current, text, 300))}>
        <textarea
          value={fact}
          onChange={(event) => setFact(event.target.value)}
          rows={2}
          maxLength={300}
          placeholder={t("facts.factPlaceholder")}
          aria-label={t("facts.fact")}
          className={cn(panelField, "leading-5")}
        />
      </DictateField>
      {error ? <PanelError className="mt-1">{error}</PanelError> : null}
      <KitButton tone="secondary" onClick={submit} disabled={busy || !fact.trim()} busy={busy} className="mt-1.5 w-full">
        {busy ? null : <BookMarked className="size-3.5" />}
        {t("facts.pinAction")}
      </KitButton>
    </div>
  );
}

export function FactsPanel({
  campaignId,
  facts,
  steersStory,
  refreshFacts,
}: {
  campaignId: string;
  facts: WorldFact[];
  steersStory: boolean;
  refreshFacts: () => Promise<void>;
}) {
  const t = useT();
  // Lead-only peek at DM secrets: fetched separately so the spoilers never
  // sit in shared state, and merged in only while the toggle is on.
  const [secrets, setSecrets] = useState<WorldFact[] | null>(null);

  async function toggleSecrets() {
    if (secrets) {
      setSecrets(null);
      return;
    }
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/facts?secrets=1`);
      if (response.ok) {
        const data = await response.json();
        setSecrets(
          ((data.facts ?? []) as WorldFact[]).filter((fact) => isSecretFact(fact.knownBy)),
        );
      }
    } catch {
      // transient; the button retries
    }
  }

  const refresh = async () => {
    await refreshFacts();
    if (secrets) {
      setSecrets(null);
      await toggleSecrets();
    }
  };

  const pinned = facts.filter((fact) => fact.pinned);

  return (
    <div className="space-y-3">
      {steersStory ? <FactComposer campaignId={campaignId} refresh={refresh} /> : null}

      {pinned.length ? (
        <div className="reveal space-y-1.5">
          <SectionHead title={t("facts.pinned")} glyph="tab-facts" aside={pinned.length} />
          <ul className="stagger space-y-1.5">
            {pinned.map((fact) => (
              <FactCard
                key={fact.id}
                campaignId={campaignId}
                fact={fact}
                steersStory={steersStory}
                refresh={refresh}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {FACT_CATEGORIES.map((category) => {
        const entries = facts.filter((fact) => fact.category === category && !fact.pinned);
        if (!entries.length) {
          return null;
        }
        return (
          <div key={category} className="space-y-1.5">
            <SectionHead title={t(CATEGORY_KEYS[category])} glyph={CATEGORY_GLYPHS[category]} aside={entries.length} />
            <ul className="stagger space-y-1.5">
              {entries.map((fact) => (
                <FactCard
                  key={fact.id}
                  campaignId={campaignId}
                  fact={fact}
                  steersStory={steersStory}
                  refresh={refresh}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {!facts.length ? (
        <EmptyState size="sm" art="board" title={`${t("facts.empty.lead")}${steersStory ? t("facts.empty.steersTail") : ""}.`} />
      ) : null}

      {steersStory ? (
        <div className="reveal space-y-1.5">
          <KitButton tone="link" onClick={toggleSecrets} aria-expanded={Boolean(secrets)}>
            {secrets ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {secrets ? t("facts.hideSecrets") : t("facts.showSecrets")}
          </KitButton>
          {secrets ? (
            secrets.length ? (
              <ul className="stagger space-y-1.5">
                {secrets.map((fact) => (
                  <FactCard
                    key={fact.id}
                    campaignId={campaignId}
                    fact={fact}
                    steersStory={steersStory}
                    refresh={refresh}
                  />
                ))}
              </ul>
            ) : (
              <p className="live-in px-1 text-xs text-stone-500">{t("facts.noSecrets")}</p>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
