"use client";

import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { SectionHead } from "@/components/ui/SectionHead";
import { UnofficialPackNotice } from "@/components/UnofficialPackNotice";
import { ui } from "@/lib/ui";
import { GENRE_OPTIONS, RACE_OPTIONS, ALIGNMENT_OPTIONS, catalogLabel } from "@/lib/worlds/catalog";
import type { WorldPackDraft } from "@/lib/worlds/draft";
import { DM_FLAVOR_FLOOR } from "@/lib/worlds/draft-check";
import { ChipList, TextField } from "@/app/workshop/plugin/fields";
import type { SectionProps } from "@/app/workshop/plugin/types";
import { useT } from "@/lib/locale";

// The identity of a world pack, in four groups that are also the wizard's
// steps: what it is called, whose setting it stands on, what kind of world
// it is, and how the narrator should sound. The Identity tab shows all four
// at once for anyone past the guided setup.

export function NameFields({ draft, onDraft }: SectionProps) {
  const t = useT();
  const set = (patch: Partial<WorldPackDraft>) => onDraft({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label={t("workshop.bestiary.block.name")}
        value={draft.name}
        onChange={(name) => set({ name })}
        maxLength={70}
        placeholder="The Sunken Coast"
        className="sm:col-span-2"
        required
      />
      <TextField
        label={t("workshop.plugin.oneLine")}
        value={draft.blurb}
        onChange={(blurb) => set({ blurb })}
        maxLength={200}
        placeholder="A drowned dwarven kingdom and the tide-cults that kept living in it."
        hint={t("workshop.plugin.oneLineHint")}
        className="sm:col-span-2"
        required
      />
      <TextField label={t("workshop.plugin.author")} value={draft.author} onChange={(author) => set({ author })} maxLength={80} />
      <TextField
        label={t("workshop.plugin.version")}
        value={draft.version}
        onChange={(version) => set({ version })}
        maxLength={20}
        hint={t("workshop.plugin.versionHint")}
      />
      <TextField
        label={t("workshop.plugin.homepage")}
        value={draft.homepage}
        onChange={(homepage) => set({ homepage })}
        maxLength={300}
        placeholder="https://"
        className="sm:col-span-2"
      />
    </div>
  );
}

export function OriginFields({ draft, onDraft }: SectionProps) {
  const t = useT();
  const set = (patch: Partial<WorldPackDraft>) => onDraft({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label={t("workshop.plugin.inspiredBy")}
        value={draft.inspiredBy}
        onChange={(inspiredBy) => set({ inspiredBy })}
        maxLength={200}
        placeholder="An original world, or the setting this is a homage to"
        className="sm:col-span-2"
        required
      />
      <TextField
        label={t("workshop.plugin.rightsHolder")}
        value={draft.rightsHolder}
        onChange={(rightsHolder) => set({ rightsHolder })}
        maxLength={120}
        placeholder="Leave empty if this is your own world"
        hint={t("workshop.plugin.rightsHolderHint")}
        className="sm:col-span-2"
      />
      <UnofficialPackNotice
        rightsHolder={draft.rightsHolder}
        inspiredBy={draft.inspiredBy.trim() || undefined}
        className="sm:col-span-2"
      />
      <TextField
        label={t("workshop.plugin.franchise")}
        value={draft.franchise}
        onChange={(franchise) => set({ franchise })}
        maxLength={60}
        placeholder="Defaults to the name"
        hint={t("workshop.plugin.franchiseHint")}
      />
      <TextField
        label={t("workshop.plugin.edition")}
        value={draft.edition}
        onChange={(edition) => set({ edition })}
        maxLength={60}
        placeholder="Empty for a single-era world"
      />
      <div className="block">
        <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">{t("workshop.plugin.editionOrder")}</span>
        <NumberStepper
          label={t("workshop.plugin.editionOrder")}
          min={0}
          max={999}
          value={draft.editionOrder}
          onChange={(next) => set({ editionOrder: Math.max(0, Math.min(999, next || 0)) })}
        />
        <span className="mt-1 block text-[11px] text-stone-500">{t("workshop.plugin.editionOrderHint")}</span>
      </div>
    </div>
  );
}

export function WorldFields({ draft, onDraft }: SectionProps) {
  const t = useT();
  const set = (patch: Partial<WorldPackDraft>) => onDraft({ ...draft, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="block">
        <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">
          {t("workshop.plugin.baseGenre")} <span className="text-amber-400/80">*</span>
        </span>
        <Select<WorldPackDraft["baseGenre"]>
          label={t("workshop.plugin.baseGenre")}
          value={draft.baseGenre}
          onChange={(baseGenre) => set({ baseGenre })}
          options={GENRE_OPTIONS.map((option) => ({ value: option.value as WorldPackDraft["baseGenre"], label: option.label }))}
        />
        <span className="mt-1 block text-[11px] text-stone-500">
          {t("workshop.plugin.baseGenreHint")}
        </span>
      </div>
      <TextField
        label={t("workshop.maps.theme")}
        value={draft.theme}
        onChange={(theme) => set({ theme })}
        maxLength={120}
        placeholder="Salvage, faith and the things under the water"
        hint={t("workshop.plugin.themeHint")}
        required
      />
      <TextField
        label={t("workshop.plugin.premise")}
        value={draft.premise}
        onChange={(premise) => set({ premise })}
        maxLength={500}
        rows={3}
        placeholder="Where a new campaign in this world starts, in a paragraph."
        hint={t("workshop.plugin.premiseHint")}
        className="sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">{t("workshop.plugin.alignmentsTitle")}</span>
        <ChipList
          items={draft.alignments}
          onChange={(alignments) => set({ alignments })}
          options={ALIGNMENT_OPTIONS}
          prompt={t("workshop.plugin.addAlignment")}
          labelFor={(code) => catalogLabel(ALIGNMENT_OPTIONS, code)}
          max={9}
        />
      </div>
    </div>
  );
}

export function VoiceFields({ draft, onDraft }: SectionProps) {
  const t = useT();
  const set = (patch: Partial<WorldPackDraft>) => onDraft({ ...draft, ...patch });
  const thin = draft.dmFlavor.trim().length < DM_FLAVOR_FLOOR;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label={t("workshop.plugin.narratorBrief")}
        value={draft.dmFlavor}
        onChange={(dmFlavor) => set({ dmFlavor })}
        maxLength={1400}
        rows={6}
        placeholder="Tone, what magic feels like, what the stakes are, what the narrator must never do."
        hint={
          thin
            ? t("workshop.plugin.narratorBriefThin", { floor: DM_FLAVOR_FLOOR, count: draft.dmFlavor.trim().length })
            : t("workshop.plugin.narratorBriefHint")
        }
        className="sm:col-span-2"
      />
      <TextField
        label={t("workshop.plugin.portraitStyle")}
        value={draft.portraitStyle}
        onChange={(portraitStyle) => set({ portraitStyle })}
        maxLength={300}
        placeholder="Painted, weathered, brine-stained leathers"
        hint={t("workshop.plugin.portraitStyleHint")}
      />
      <TextField
        label={t("workshop.plugin.mapStyle")}
        value={draft.mapStyle}
        onChange={(mapStyle) => set({ mapStyle })}
        maxLength={300}
        placeholder="Inked nautical charts, kelp-green wash"
        hint={t("workshop.plugin.mapStyleHint")}
      />
      <TextField
        label={t("workshop.plugin.sceneStyle")}
        value={draft.sceneStyle}
        onChange={(sceneStyle) => set({ sceneStyle })}
        maxLength={300}
        placeholder="Salt-washed illustration, grey overcast light"
        hint={t("workshop.plugin.sceneStyleHint")}
      />
      <TextField
        label={t("workshop.plugin.nameHints")}
        value={draft.nameHints}
        onChange={(nameHints) => set({ nameHints })}
        maxLength={300}
        placeholder="Dwarven names with tide-words; surnames are the ship they were born on"
        hint={t("workshop.plugin.nameHintsHint")}
      />
      <TextField
        label={t("workshop.plugin.raceHint")}
        value={draft.raceHint}
        onChange={(raceHint) => set({ raceHint })}
        maxLength={300}
        placeholder="Most people are dwarves or sea-elves; humans are traders from upriver"
        hint={t("workshop.plugin.raceHintHint")}
      />
      <div className="sm:col-span-2">
        <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">{t("workshop.plugin.companionRaces")}</span>
        <ChipList
          items={draft.companionRaces}
          onChange={(companionRaces) => set({ companionRaces })}
          options={RACE_OPTIONS}
          prompt={t("workshop.plugin.allowRace")}
          labelFor={(id) => catalogLabel(RACE_OPTIONS, id)}
        />
        <p className="mt-1 text-[11px] text-stone-500">{t("workshop.plugin.emptyNoRestriction")}</p>
      </div>
    </div>
  );
}

export function IdentitySection(props: SectionProps) {
  const t = useT();
  return (
    <div className="space-y-6">
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.calledTitle")} glyph="system-plugin" />
        <NameFields {...props} />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.whoseWorld")} glyph="tab-friends" />
        <OriginFields {...props} />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.kindOfWorld")} glyph="system-region" />
        <WorldFields {...props} />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.narratorSounds")} glyph="tab-ambience" />
        <VoiceFields {...props} />
      </section>
    </div>
  );
}
