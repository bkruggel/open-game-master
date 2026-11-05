"use client";

import { SectionHead } from "@/components/ui/SectionHead";
import { ui } from "@/lib/ui";
import { ChipList, LineList, PairList } from "@/app/workshop/plugin/fields";
import type { SectionProps } from "@/app/workshop/plugin/types";
import { useT } from "@/lib/locale";

// The setting half of a pack: what the narrator is handed about the world
// beyond its names. Factions, places, hooks and a glossary go into the
// game-state block; name seeds are offered as clickable suggestions in the
// character builder. Pull from this workshop (in the panel header) fills
// these from the factions, lore, places, hook cards and cast already built
// here.

export function SettingSection({ draft, onDraft }: SectionProps) {
  const t = useT();
  return (
    <div className="space-y-4">
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.system.factions.label")} glyph="system-factions" className="mb-0" />
        <p className="mb-3 text-[11px] text-stone-500">{t("workshop.plugin.factionsHint")}</p>
        <PairList
          items={draft.factions}
          onChange={(factions) => onDraft({ ...draft, factions })}
          first={{ key: "name", label: t("workshop.plugin.factionLabel"), max: 60 }}
          second={{ key: "blurb", label: t("workshop.plugin.whatAbout"), max: 200 }}
          addLabel={t("workshop.plugin.addFaction")}
          empty={t("workshop.plugin.noFactions")}
        />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.placesTitle")} glyph="system-region" className="mb-0" />
        <p className="mb-3 text-[11px] text-stone-500">{t("workshop.plugin.placesHint")}</p>
        <PairList
          items={draft.locations}
          onChange={(locations) => onDraft({ ...draft, locations })}
          first={{ key: "name", label: t("workshop.plugin.placeLabel"), max: 60 }}
          second={{ key: "blurb", label: t("workshop.plugin.whatLike"), max: 200 }}
          addLabel={t("workshop.plugin.addPlace")}
          empty={t("workshop.plugin.noPlaces")}
        />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.hooksTitle")} glyph="quest-active" className="mb-0" />
        <p className="mb-3 text-[11px] text-stone-500">{t("workshop.plugin.hooksHint")}</p>
        <LineList
          items={draft.hooks}
          onChange={(hooks) => onDraft({ ...draft, hooks })}
          maxLength={240}
          addLabel={t("workshop.plugin.addHook")}
          placeholder="A tide-priest offers to pay for a relic nobody else will touch."
          empty={t("workshop.plugin.noHooks")}
        />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.glossaryTitle")} glyph="tab-reference" className="mb-0" />
        <p className="mb-3 text-[11px] text-stone-500">{t("workshop.plugin.glossaryHint")}</p>
        <PairList
          items={draft.glossary}
          onChange={(glossary) => onDraft({ ...draft, glossary })}
          first={{ key: "term", label: t("workshop.plugin.termLabel"), max: 40 }}
          second={{ key: "meaning", label: t("workshop.plugin.meaningLabel"), max: 160 }}
          addLabel={t("workshop.plugin.addTerm")}
          empty={t("workshop.plugin.noGlossary")}
        />
      </section>
      <section className={ui.card + " p-4"}>
        <SectionHead title={t("workshop.plugin.nameSeeds")} glyph="tab-characters" className="mb-0" />
        <p className="mb-3 text-[11px] text-stone-500">{t("workshop.plugin.nameSeedsHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">{t("workshop.plugin.people")}</span>
            <ChipList
              items={draft.nameSeeds.people}
              onChange={(people) => onDraft({ ...draft, nameSeeds: { ...draft.nameSeeds, people } })}
              placeholder={t("workshop.plugin.personPlaceholder")}
            />
          </div>
          <div>
            <span className="mb-1 block font-display text-[11px] tracking-[0.1em] text-amber-300/85">{t("workshop.plugin.placesChip")}</span>
            <ChipList
              items={draft.nameSeeds.places}
              onChange={(places) => onDraft({ ...draft, nameSeeds: { ...draft.nameSeeds, places } })}
              placeholder={t("workshop.plugin.placePlaceholder")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
