"use client";

import { rowIcon } from "@/app/workshop/kit";
import { SectionHead } from "@/components/ui/SectionHead";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { AddFromList, Suggestions } from "@/components/ui/AddFromList";
import { ContentPick } from "@/components/ui/ContentPick";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import {
  BACKGROUND_OPTIONS,
  CLASS_OPTIONS,
  FEATURE_OPTIONS,
  RACE_OPTIONS,
  catalogLabel,
  isCasterClass,
  type CatalogOption,
} from "@/lib/worlds/catalog";
import type { WorldPackDraft } from "@/lib/worlds/draft";
import { input, removeAt, replaceAt, type SectionProps } from "@/app/workshop/plugin/types";
import { textKey } from "@/lib/language/text-logic";
import { useT } from "@/lib/locale";

// The reskin tables: the world's own names for things the engine already
// has. Pick, do not type. A race, class or background is chosen from the
// catalog by its real name and the id is never seen; a spell or item is
// found in the content pack; a feature is picked from every feature the
// SRD tables grant. What a person types is the world's word for it and a
// line about what it is here.

type IdKind = "races" | "classes" | "backgrounds";
type NameKind = "spells" | "items" | "features";

const ID_COPY: Record<IdKind, { title: string; prompt: string; blurb: string; catalog: CatalogOption[] }> = {
  races: {
    title: "workshop.plugin.reskin.speciesTitle",
    prompt: "workshop.plugin.reskin.addSpecies",
    blurb: "workshop.plugin.reskin.speciesBlurb",
    catalog: RACE_OPTIONS,
  },
  classes: {
    title: "workshop.plugin.reskin.callingsTitle",
    prompt: "workshop.plugin.reskin.addClass",
    blurb: "workshop.plugin.reskin.callingsBlurb",
    catalog: CLASS_OPTIONS,
  },
  backgrounds: {
    title: "workshop.plugin.reskin.backgroundsTitle",
    prompt: "workshop.plugin.reskin.addBackground",
    blurb: "workshop.plugin.reskin.backgroundsBlurb",
    catalog: BACKGROUND_OPTIONS,
  },
};

export function IdReskinList({ draft, onDraft, kind }: SectionProps & { kind: IdKind }) {
  const t = useT();
  const copy = ID_COPY[kind];
  const list = draft[kind];
  const used = new Set(list.map((entry) => entry.id));
  const remaining = copy.catalog.filter((option) => !used.has(option.value));
  const set = (next: WorldPackDraft[IdKind]) => onDraft({ ...draft, [kind]: next } as WorldPackDraft);
  return (
    <section className={ui.card + " p-4"}>
      <SectionHead title={t(copy.title)} glyph="system-plugin" className="mb-0" />
      <p className="mb-3 text-[11px] text-stone-500">{t(copy.blurb)}</p>
      <div className="stagger space-y-1.5">
        {list.map((entry, index) => (
          <div key={`${entry.id}-${index}`} className="flex flex-wrap items-start gap-1.5 rounded-lg border border-stone-800 p-2">
            <span className="w-full text-[11px] text-stone-400 sm:w-36 sm:pt-1.5">
              {catalogLabel(copy.catalog, entry.id)}
            </span>
            <input
              value={entry.name}
              maxLength={60}
              placeholder={t("workshop.plugin.calledHere")}
              aria-label={t("workshop.plugin.nameFor", { slug: catalogLabel(copy.catalog, entry.id) })}
              onChange={(event) => set(replaceAt(list, index, { ...entry, name: event.target.value }) as typeof list)}
              className={cn(input, "w-40 min-w-0")}
            />
            <input
              value={entry.blurb}
              maxLength={200}
              placeholder={t("workshop.plugin.oneLine")}
              aria-label={t("workshop.plugin.blurbAria")}
              onChange={(event) => set(replaceAt(list, index, { ...entry, blurb: event.target.value }) as typeof list)}
              className={cn(input, "min-w-0 flex-1")}
            />
            {kind === "classes" && isCasterClass(entry.id) ? (
              <input
                value={(entry as { castingLabel?: string | null }).castingLabel ?? ""}
                maxLength={40}
                placeholder={t("workshop.plugin.reskin.castingPlaceholder")}
                aria-label={t("workshop.plugin.reskin.castingAria")}
                onChange={(event) =>
                  set(
                    replaceAt(list as WorldPackDraft["classes"], index, {
                      ...(entry as WorldPackDraft["classes"][number]),
                      castingLabel: event.target.value || null,
                    }),
                  )
                }
                className={cn(input, "w-40 min-w-0")}
              />
            ) : null}
            <button
              type="button"
              onClick={() => set(removeAt(list, index) as typeof list)}
              aria-label={t("workshop.bestiary.block.removeNamed", { name: catalogLabel(copy.catalog, entry.id) })}
              className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <AddFromList
          prompt={t(copy.prompt)}
          options={remaining}
          onPick={(id) =>
            set([
              ...list,
              kind === "classes" ? { id, name: "", blurb: "", castingLabel: null } : { id, name: "", blurb: "" },
            ] as typeof list)
          }
        />
      </div>
    </section>
  );
}

const NAME_COPY: Record<NameKind, { title: string; blurb: string }> = {
  spells: { title: "workshop.plugin.reskin.spellsTitle", blurb: "workshop.plugin.reskin.spellsBlurb" },
  items: { title: "workshop.plugin.reskin.gearTitle", blurb: "workshop.plugin.reskin.gearBlurb" },
  features: { title: "workshop.plugin.reskin.featuresTitle", blurb: "workshop.plugin.reskin.featuresBlurb" },
};

export function NameReskinList({ draft, onDraft, kind }: SectionProps & { kind: NameKind }) {
  const t = useT();
  const copy = NAME_COPY[kind];
  const list = draft[kind];
  const set = (next: WorldPackDraft[NameKind]) => onDraft({ ...draft, [kind]: next } as WorldPackDraft);
  const [feature, setFeature] = useState("");
  const addFrom = (from: string) => {
    const trimmed = from.trim();
    if (!trimmed || list.some((entry) => textKey(entry.from) === textKey(trimmed))) {
      return;
    }
    set([...list, { from: trimmed, name: "", blurb: "" }]);
    setFeature("");
  };
  return (
    <section className={ui.card + " p-4"}>
      <SectionHead title={t(copy.title)} glyph="system-plugin" className="mb-0" />
      <p className="mb-3 text-[11px] text-stone-500">{t(copy.blurb)}</p>
      <div className="stagger space-y-1.5">
        {list.map((entry, index) => (
          <div key={`${entry.from}-${index}`} className="flex flex-wrap items-start gap-1.5 rounded-lg border border-stone-800 p-2">
            <span className="w-full text-[11px] text-stone-400 sm:w-36 sm:pt-1.5">{entry.from}</span>
            <input
              value={entry.name}
              maxLength={80}
              placeholder={t("workshop.plugin.calledHere")}
              aria-label={t("workshop.plugin.nameFor", { slug: entry.from })}
              onChange={(event) => set(replaceAt(list, index, { ...entry, name: event.target.value }))}
              className={cn(input, "w-40 min-w-0")}
            />
            <input
              value={entry.blurb}
              maxLength={200}
              placeholder={t("workshop.plugin.oneLine")}
              aria-label={t("workshop.plugin.blurbAria")}
              onChange={(event) => set(replaceAt(list, index, { ...entry, blurb: event.target.value }))}
              className={cn(input, "min-w-0 flex-1")}
            />
            <button
              type="button"
              onClick={() => set(removeAt(list, index))}
              aria-label={t("workshop.bestiary.block.removeNamed", { name: entry.from })}
              className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2">
        {kind === "features" ? (
          <div className="reveal flex gap-1.5">
            <input
              value={feature}
              list="plugin-feature-options"
              placeholder={t("workshop.plugin.findRename")}
              aria-label={t("workshop.plugin.reskin.featureAria")}
              onChange={(event) => setFeature(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addFrom(feature);
                }
              }}
              className={cn(input, "min-w-0 flex-1")}
            />
            <Suggestions id="plugin-feature-options" options={FEATURE_OPTIONS()} />
            <button type="button" onClick={() => addFrom(feature)} disabled={!feature.trim()} className={cn(ui.btnSmall, "text-xs")}>
              <Plus className="size-3.5" /> {t("workshop.bestiary.stats.add")}
            </button>
          </div>
        ) : (
          <ContentPick
            kind={kind}
            label={t(kind === "spells" ? "workshop.plugin.reskin.findSpell" : "workshop.plugin.reskin.findItem")}
            placeholder={t(kind === "spells" ? "workshop.plugin.reskin.findSpell" : "workshop.plugin.reskin.findItem")}
            onPick={(entry) => addFrom(entry.name)}
          />
        )}
      </div>
    </section>
  );
}

export function PeopleSection(props: SectionProps) {
  return (
    <div className="space-y-4">
      <IdReskinList {...props} kind="races" />
      <IdReskinList {...props} kind="classes" />
      <IdReskinList {...props} kind="backgrounds" />
    </div>
  );
}

export function MagicSection(props: SectionProps) {
  return (
    <div className="space-y-4">
      <NameReskinList {...props} kind="spells" />
      <NameReskinList {...props} kind="items" />
      <NameReskinList {...props} kind="features" />
    </div>
  );
}
