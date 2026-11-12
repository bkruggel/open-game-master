"use client";

import { Check, ChevronDown, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionHead } from "@/components/ui/SectionHead";
import { chip, chipOn, chipRow } from "@/app/workshop/kit";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import type { RecordKind } from "@/lib/pdf-import/draft-logic";
import type { MatchOption } from "@/lib/pdf-import/match-logic";
import type { RecordView, ReviewView } from "@/lib/pdf-import/view";
import { PdfMatches, type MatchChoice } from "./PdfMatches";
import { useT } from "@/lib/locale";

// The book, read, before anything is written: every record the import
// found, grouped by what it becomes, each with the pages it came from, the
// words it was read from and anything to check. A group's chip takes or
// leaves the whole group; a record's own tick takes or leaves it alone.
// Nothing here is final: the workshop's own editors change any of it
// afterwards.
//
// The kind labels are dictionary keys (pdf.kind.*_one/_other, the
// monster-folds pattern): the record's kind is the server's protocol value,
// matched by nothing here.

export const KIND_KEYS: Record<RecordKind, string> = {
  beat: "pdf.kind.beat_other",
  location: "pdf.kind.location_other",
  npc: "pdf.kind.npc_other",
  faction: "pdf.kind.faction_other",
  monster: "pdf.kind.monster_other",
  encounter: "pdf.kind.encounter_other",
  item: "pdf.kind.item_other",
  spell: "pdf.kind.spell_other",
  table: "pdf.kind.table_other",
  map: "pdf.kind.map_other",
  art: "pdf.kind.art_other",
  lore: "pdf.kind.lore_other",
};

// One of each, for a count of one ("1 Map", not "1 Maps").
const ONE_KEYS: Record<RecordKind, string> = {
  beat: "pdf.kind.beat_one",
  location: "pdf.kind.location_one",
  npc: "pdf.kind.npc_one",
  faction: "pdf.kind.faction_one",
  monster: "pdf.kind.monster_one",
  encounter: "pdf.kind.encounter_one",
  item: "pdf.kind.item_one",
  spell: "pdf.kind.spell_one",
  table: "pdf.kind.table_one",
  map: "pdf.kind.map_one",
  art: "pdf.kind.art_one",
  lore: "pdf.kind.lore_one",
};

const ORDER: RecordKind[] = ["beat", "location", "npc", "faction", "monster", "encounter", "item", "spell", "table", "map", "art", "lore"];
// What a WorldForge file cannot carry: these come only with a new workshop.
export const WORKSHOP_ONLY: RecordKind[] = ["map", "encounter", "table"];
const PAGE_ROWS = 40;

export function PdfReview({
  importId,
  review,
  srd,
  destination,
  busy,
  error,
  matchError,
  onChoose,
  onReread,
  onImport,
  onDiscard,
}: {
  importId: string;
  review: ReviewView;
  srd: MatchOption[];
  destination: "workshop" | "world";
  busy: boolean;
  error: string;
  matchError: string;
  onChoose: (choices: Record<string, MatchChoice>) => void;
  onReread: () => void;
  onImport: (choices: { include: Record<string, boolean>; title: string; destination: "workshop" | "world" }) => void;
  onDiscard: () => void;
}) {
  const t = useT();
  const [include, setInclude] = useState<Record<string, boolean>>(() => Object.fromEntries(review.records.map((record) => [record.key, record.include])));
  const [title, setTitle] = useState(review.title);
  const [open, setOpen] = useState<RecordKind | null>(null);
  const groups = useMemo(() => {
    const byKind = new Map<RecordKind, RecordView[]>();
    for (const record of review.records) byKind.set(record.kind, [...(byKind.get(record.kind) ?? []), record]);
    return ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({ kind, records: byKind.get(kind)! }));
  }, [review.records]);
  const toCheck = review.records.filter((record) => include[record.key] && record.check.length).length;
  const taken = review.records.filter((record) => include[record.key]).length;
  // A match whose records are all left out waits for nobody; a creature a
  // kept fight or person uses still comes in, so its match still waits.
  const toMatch = review.matches.filter((match) => !match.confirmed && [...match.records, ...match.usedBy].some((key) => include[key])).length;
  const blocked = busy || !taken || toMatch > 0;

  const landsHere = (kind: RecordKind) => destination === "workshop" || !WORKSHOP_ONLY.includes(kind);
  const setGroup = (kind: RecordKind, value: boolean) =>
    setInclude((current) => ({ ...current, ...Object.fromEntries(review.records.filter((record) => record.kind === kind).map((record) => [record.key, value])) }));

  return (
    <div className={`${ui.card} reveal mt-3 p-4`} data-testid="pdf-review">
      <SectionHead title={destination === "world" ? t("pdf.review.worldTitle") : t("pdf.review.title")} glyph={destination === "world" ? "system-world" : "system-share"} />
      {destination === "workshop" ? (
        <label className="mt-1 block text-xs text-stone-400">
          {t("workshop.header.nameAria")}
          <input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 70))} className={cn(ui.input, "mt-1 w-full")} maxLength={70} />
        </label>
      ) : (
        <p className="text-sm text-stone-300">{review.title}</p>
      )}
      {review.premise ? <p className="mt-2 line-clamp-3 text-sm text-stone-400">{review.premise}</p> : null}
      {review.system ? (
        <p className="mt-1 text-xs text-stone-400">
          {t("pdf.review.system", { system: review.system })}
        </p>
      ) : null}
      {review.party ? (
        <p className="mt-1 text-xs text-stone-500">
          {t(
            review.party.stated ? (review.party.levelTo ? "pdf.review.party.statedTo" : "pdf.review.party.stated") : review.party.levelTo ? "pdf.review.party.plainTo" : "pdf.review.party.plain",
            { size: review.party.size, level: review.party.level, levelTo: review.party.levelTo ?? 0 },
          )}
        </p>
      ) : null}

      {review.modelNote ? <p className="motion-pop mt-2 text-xs text-amber-200/90">{review.modelNote}</p> : null}
      {review.modelFailed ? (
        <div className="motion-pop mt-1 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={onReread} className={cn(ui.btnSmall, "pointer-coarse:min-h-10")}>
            {t(review.modelFailed === 1 ? "pdf.review.reread_one" : "pdf.review.reread_other")}
          </button>
          <span className="text-xs text-stone-500">{t("pdf.review.rereadNote")}</span>
        </div>
      ) : null}
      {!review.modelUsed && !review.modelNote ? (
        <p className="mt-2 text-xs text-stone-400">
          {t("pdf.review.layoutOnly")}
        </p>
      ) : null}

      {review.matches.length ? <PdfMatches matches={review.matches} srd={srd} error={matchError} onChoose={onChoose} /> : null}

      <ul className={cn("stagger mt-3", chipRow)} aria-label={t("pdf.review.shelvesAria")}>
        {groups.map(({ kind, records }) => {
          const on = records.filter((record) => include[record.key]).length;
          const usable = landsHere(kind);
          const label = records.length === 1 ? t(ONE_KEYS[kind]) : t(KIND_KEYS[kind]);
          return (
            <li key={kind}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on === records.length ? true : on === 0 ? false : "mixed"}
                disabled={!usable}
                onClick={() => setGroup(kind, on !== records.length)}
                title={usable ? t("pdf.group.takeTitle", { label }) : t("pdf.group.workshopOnly")}
                className={cn(ui.btnSmall, chip, "rounded-full normal-case", on && usable ? chipOn : "text-stone-500", !usable && "opacity-50")}
              >
                <Check className={cn("size-3.5", on && usable ? "text-amber-300" : "opacity-20")} aria-hidden="true" />
                {on === records.length ? t("pdf.chip.all", { count: on, label }) : t("pdf.chip.some", { on, total: records.length, label })}
              </button>
            </li>
          );
        })}
      </ul>
      {review.records.some((record) => record.kind === "monster" && !include[record.key]) ? (
        <p className="mt-2 text-xs text-stone-500">{t("pdf.review.leftOutNote")}</p>
      ) : null}
      {destination === "world" && groups.some(({ kind }) => !landsHere(kind)) ? (
        <p className="mt-2 text-xs text-stone-500">{t("pdf.review.workshopOnlyNote")}</p>
      ) : null}
      {toCheck ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-200/90">
          <TriangleAlert className="size-3.5" aria-hidden="true" /> {t("pdf.review.checkCount", { count: toCheck })}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {groups.map(({ kind, records }) => (
          <Group
            key={kind}
            kind={kind}
            records={records}
            importId={importId}
            include={include}
            usable={landsHere(kind)}
            open={open === kind}
            onOpen={() => setOpen(open === kind ? null : kind)}
            onToggle={(key) => setInclude((current) => ({ ...current, [key]: !current[key] }))}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-stone-500">
        {t("pdf.review.license")}
      </p>
      {error ? (
        <p role="alert" className="motion-shake mt-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
      {toMatch ? (
        <p className="motion-pop mt-2 text-xs text-amber-200/90" id="pdf-import-blocked">
          {t(toMatch === 1 ? "pdf.review.matchesFirst_one" : "pdf.review.matchesFirst_other", { count: toMatch })}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={blocked} aria-describedby={toMatch ? "pdf-import-blocked" : undefined} onClick={() => onImport({ include, title: title.trim() || review.title, destination })} className={ui.btnPrimary}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {destination === "world" ? t("pdf.review.bringWorld") : t("pdf.review.makeWorkshop", { count: taken })}
        </button>
        {destination === "world" ? (
          <button type="button" disabled={blocked} onClick={() => onImport({ include, title: title.trim() || review.title, destination: "workshop" })} className={ui.btnSecondary}>
            {t("pdf.review.newWorkshopInstead")}
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onDiscard} className={ui.btnSecondary}>
          {t("action.discard")}
        </button>
      </div>
    </div>
  );
}

function Group({
  kind,
  records,
  importId,
  include,
  usable,
  open,
  onOpen,
  onToggle,
}: {
  kind: RecordKind;
  records: RecordView[];
  importId: string;
  include: Record<string, boolean>;
  usable: boolean;
  open: boolean;
  onOpen: () => void;
  onToggle: (key: string) => void;
}) {
  const t = useT();
  const [shown, setShown] = useState(PAGE_ROWS);
  const checks = records.filter((record) => record.check.length).length;
  return (
    <section className="rounded-lg border border-stone-700/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={onOpen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-200 hover:text-amber-100 pointer-coarse:min-h-10"
      >
        <ChevronDown className={cn("size-4 transition-transform", open ? "rotate-0" : "-rotate-90")} aria-hidden="true" />
        <span>{t(KIND_KEYS[kind])}</span>
        <span className="text-xs text-stone-500">{records.length}</span>
        {checks ? <span className="ml-auto text-xs text-amber-200/80">{t("pdf.group.toCheck", { count: checks })}</span> : null}
      </button>
      {open ? (
        <ul className="stagger space-y-1 px-2 pb-2">
          {records.slice(0, shown).map((record) => (
            <Row key={record.key} record={record} importId={importId} on={Boolean(include[record.key]) && usable} usable={usable} onToggle={() => onToggle(record.key)} />
          ))}
          {records.length > shown ? (
            <li>
              <button type="button" onClick={() => setShown(shown + PAGE_ROWS * 2)} className={cn(ui.btnSmall, "mt-1")}>
                {t("pdf.group.showMore", { count: Math.min(PAGE_ROWS * 2, records.length - shown), total: records.length - shown })}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

function Row({ record, importId, on, usable, onToggle }: { record: RecordView; importId: string; on: boolean; usable: boolean; onToggle: () => void }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const pages = record.pages.length ? `${t("pdf.pageRange", { pages: record.pages.slice(0, 3).join(", ") })}${record.pages.length > 3 ? "…" : ""}` : "";
  return (
    <li className="reveal rounded-md bg-stone-900/40 px-2 py-1.5" data-record={record.key}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={t("pdf.row.take", { name: record.name })}
          disabled={!usable}
          onClick={onToggle}
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded border border-stone-600 pointer-coarse:size-10"
        >
          <Check className={cn("size-3.5", on ? "text-amber-300" : "opacity-0")} aria-hidden="true" />
        </button>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-w-0 flex-1 text-left pointer-coarse:min-h-10">
          <span className={cn("block truncate text-sm", on ? "text-stone-200" : "text-stone-500 line-through")}>{record.name}</span>
          <span className="block truncate text-xs text-stone-500">
            {[pages, record.from === "model" ? t("pdf.row.byModel") : "", record.summary].filter(Boolean).join(" · ")}
          </span>
        </button>
        {record.check.length ? <TriangleAlert className="mt-1 size-3.5 shrink-0 text-amber-300" aria-label={t("pdf.row.checkAria")} /> : null}
      </div>
      {expanded ? (
        <div className="motion-pop mt-2 space-y-2 pl-8 text-xs">
          {record.check.map((line) => (
            <p key={line} className="text-amber-200/90">
              {line}
            </p>
          ))}
          {record.picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- a private picture behind its import's own route, not a static asset
            <img src={`/api/pdf-imports/${importId}/pictures/${record.picture}`} alt={record.name} className="max-h-48 rounded border border-stone-700/60" loading="lazy" />
          ) : null}
          {record.source ? <p className="whitespace-pre-line text-stone-400">{record.source}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
