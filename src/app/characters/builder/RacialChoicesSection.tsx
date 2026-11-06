"use client";

import { useId } from "react";
import CatalogBrowser from "@/app/characters/builder/CatalogBrowser";
import ContentPicker from "@/app/characters/builder/ContentPicker";
import type { RaceOption } from "@/app/characters/builder/useBuilderOptions";
import { GameTerm } from "@/components/ui/GameTerm";
import { InfoButton } from "@/components/ui/InfoDialog";
import { Select } from "@/components/ui/Select";
import { ALL_SKILLS } from "@/lib/content/mechanics";
import { contentSlug, describeSkill } from "@/lib/help";
import { SRD_SKILLS } from "@/lib/srd";
import { ABILITIES, type Ability } from "@/lib/schemas/sheet";
import { featAbilityIncrease } from "@/lib/srd/feat-effects";
import type { FeatChoices, FeatGrantSpec, FeatPicks } from "@/lib/srd/feat-grants";
import FeatChoicesFields, { type KnownTraining } from "./FeatChoicesFields";
import { SelectedPrerequisite } from "./AsiFeatEditor";
import { judgeEntry, useFeatJudge } from "./featPrereqs";
import { racialFeatCount } from "@/lib/srd/race-id";
import { DRACONIC_ANCESTRIES, takesDraconicAncestry } from "@/lib/srd/racial-grants";
import { variantShort, variantSummary } from "@/lib/content/species-variants";
import { Chip } from "./steps/shared";
import { RacialCantripPicker } from "./RacialCantripPicker";
import { featChoice } from "@/lib/schemas/sheet";
import { skillLabel } from "@/lib/srd";
import { useLocale, useT } from "@/lib/locale";

// An ability key as its name in the reader's language (sheet.ability.*).
const ABILITY_LABEL_KEYS: Record<Ability, string> = {
  str: "sheet.ability.str",
  dex: "sheet.ability.dex",
  con: "sheet.ability.con",
  int: "sheet.ability.int",
  wis: "sheet.ability.wis",
  cha: "sheet.ability.cha",
};



// The picks a race offers instead of fixing: half-elf's two +1 ability
// bumps and two skills, high elf's wizard cantrip, hill dwarf's tool, the
// variant human's feat. Until these existed the grants were silently
// dropped, leaving those characters weaker than the rules allow.
export function RacialChoicesSection({
  race,
  grantedSkills,
  asi,
  onAsiChange,
  skills,
  onSkillsChange,
  cantrips,
  onCantripsChange,
  tool,
  onToolChange,
  ancestry = "",
  onAncestryChange,
  variant = "",
  onVariantChange,
  repeated = [],
  repeatSkills = [],
  onRepeatChange,
  feats = [],
  onFeatsChange,
  featAbility = "",
  onFeatAbilityChange,
  featSpecOf,
  featDescOf,
  featChoices,
  onFeatPicks,
  known,
}: {
  race: RaceOption;
  // Skills already granted by class and background, so they are not offered
  // twice (a duplicate pick would waste the racial choice).
  grantedSkills: string[];
  asi: Array<Ability | "">;
  onAsiChange: (index: number, ability: Ability | "") => void;
  skills: string[];
  onSkillsChange: (index: number, skill: string) => void;
  cantrips: string[];
  onCantripsChange: (cantrips: string[]) => void;
  tool: string;
  onToolChange: (tool: string) => void;
  // A dragonborn's draconic ancestry, by id.
  ancestry?: string;
  onAncestryChange?: (ancestry: string) => void;
  // The option of a workshop species' choice (a Half-Dragon's ancestry), by
  // id, for a race that offers one.
  variant?: string;
  onVariantChange?: (variant: string) => void;
  // Skills the race and the background both give, and the ones chosen in
  // their place.
  repeated?: string[];
  repeatSkills?: string[];
  onRepeatChange?: (index: number, skill: string) => void;
  // The variant human's feat, picked here with the race's other choices
  // (issue #124: it sat four steps away and no gate asked for it), and the
  // score a half-feat raises where it offers one (Resilient, Athlete).
  feats?: string[];
  onFeatsChange?: (feats: string[]) => void;
  featAbility?: Ability | "";
  onFeatAbilityChange?: (ability: Ability | "") => void;
  // What the feat grants beyond its point and the picks it leaves open
  // (src/lib/srd/feat-grants.ts), picked right under the feat.
  featSpecOf?: (name: string) => FeatGrantSpec;
  // The feat's text where known, for a content pack half-feat's score.
  featDescOf?: (name: string) => string;
  featChoices?: FeatChoices;
  onFeatPicks?: (feat: string, picks: FeatPicks) => void;
  known?: KnownTraining;
  inputClass: string;
}) {
  const t = useT();
  const locale = useLocale();
  const draconic = takesDraconicAncestry(race.id);
  const racialFeats = onFeatsChange ? racialFeatCount(race.id) : 0;
  const hasChoices = Boolean(
    race.asiChoice || race.skillChoice || race.cantripChoice || race.toolChoice || draconic || race.variants || repeated.length || racialFeats,
  );
  const chosen = race.variants?.options.find((option) => option.id === variant) ?? null;
  // The half-feat's choice of score, offered once the feat is picked.
  const featScores = racialFeats ? (featAbilityIncrease(feats[0] ?? "", featDescOf?.(feats[0] ?? ""))?.from ?? []) : [];
  // The builder's prerequisite check (featPrereqs.ts): read off each row,
  // and rechecked on the feat once picked.
  const judge = useFeatJudge();
  const noteId = useId();
  const abilityWord = (ability: Ability | string) => t(ABILITY_LABEL_KEYS[ability as Ability] ?? String(ability));
  const pickFeat = (name: string) => {
    if (!onFeatsChange || feats.includes(name) || feats.length >= racialFeats) {
      return;
    }
    onFeatsChange([...feats, name]);
  };
  if (!hasChoices) {
    return null;
  }

  // A half-elf's +1s go to abilities other than the one the race already
  // raises, per the SRD.
  const fixedAbilities = new Set(Object.keys(race.asi) as Ability[]);
  // An either-or increase ("Strength or Dexterity") offers only its two.
  const asiFrom = race.asiChoice?.from;

  return (
    <div className="space-y-3 rounded-lg border border-amber-900/40 bg-amber-950/10 p-3">
      <p className="text-xs text-amber-200/90">{t("builder.racial.title", { race: race.name })}</p>

      {/* First: what it gives changes what the picks below may be. */}
      {race.variants && onVariantChange ? (
        <div data-builder-target="variant">
          <label className="block">
            <span className="mb-1 block text-stone-400">
              {t("builder.racial.variantLine", { label: race.variants.label, species: race.name })}
            </span>
            <Select<string>
              value={variant}
              onChange={onVariantChange}
              className="w-full"
              label={race.variants.label}
              placeholder={t("builder.racial.chooseOne")}
              options={[
                { value: "", label: t("builder.racial.chooseOne") },
                ...race.variants.options.map((option) => ({ value: option.id, label: `${option.name} (${variantShort(option)})` })),
              ]}
            />
          </label>
          {chosen ? (
            <p className="live-in mt-1 whitespace-pre-line text-xs text-stone-400" data-variant-summary>
              {variantSummary(chosen)}
              {chosen.description ? `\n${chosen.description}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      {race.asiChoice ? (
        <div data-builder-target="racialAsi">
          <span className="mb-1 flex flex-wrap items-center gap-1 text-stone-400">
            <GameTerm id="ability_score">Ability</GameTerm>
            {t("builder.racial.asiHeader", {
              amount: race.asiChoice.amount,
              from: asiFrom
                ? t("builder.racial.asiFrom", {
                    from: asiFrom.map((ability) => abilityWord(ability)).join(" or "),
                    count: race.asiChoice.count,
                  })
                : "",
            })}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: race.asiChoice.count }, (_, index) => (
              <span key={index} className="flex items-center gap-1">
                <Select<Ability | "">
                  value={asi[index] ?? ""}
                  onChange={(next) => onAsiChange(index, next)}
                  className="min-w-0 grow"
                  label={t("builder.racial.asiN", { n: index + 1 })}
                  placeholder={t("builder.racial.chooseAbility")}
                  options={[
                    // Still a row of its own, so a pick can be taken back.
                    { value: "" as const, label: t("builder.racial.chooseAbility") },
                    ...ABILITIES.filter(
                      (ability) =>
                        !fixedAbilities.has(ability) &&
                        (!asiFrom || asiFrom.includes(ability)) &&
                        (asi[index] === ability || !asi.includes(ability)),
                    ).map((ability) => ({ value: ability, label: abilityWord(ability) })),
                  ]}
                />
                {asi[index] ? (
                  <GameTerm id={asi[index] as Ability} className="shrink-0 text-xs text-stone-500">
                    what is this?
                  </GameTerm>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {race.skillChoice ? (
        <div data-builder-target="racialSkills">
          <span className="mb-1 flex flex-wrap items-center gap-1 text-stone-400">
            <GameTerm id="skill">Skill</GameTerm>
            {t("builder.racial.skillsHeader", { count: race.skillChoice.count })}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: race.skillChoice.count }, (_, index) => (
              <span key={index} className="flex items-center gap-1">
                <Select<string>
                  value={skills[index] ?? ""}
                  onChange={(next) => onSkillsChange(index, next)}
                  className="min-w-0 grow"
                  label={t("builder.racial.skillN", { n: index + 1 })}
                  placeholder={t("builder.racial.chooseSkill")}
                  options={[
                    { value: "", label: t("builder.racial.chooseSkill") },
                    ...(race.skillChoice?.from?.length ? race.skillChoice.from : ALL_SKILLS).filter(
                      (skill) => skills[index] === skill || (!skills.includes(skill) && !grantedSkills.includes(skill)),
                    ).map((skill) => ({ value: skill as string, label: skillLabel(skill, locale) })),
                  ]}
                />
                {skills[index] ? (
                  <InfoButton
                    label={skillLabel(skills[index], locale)}
                    text={describeSkill(t, skills[index], locale)}
                  />
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {draconic && onAncestryChange ? (
        <label className="block" data-builder-target="ancestry">
          <span className="mb-1 block text-stone-400">
            {t("builder.racial.ancestryHeader")}
          </span>
          <Select<string>
            value={ancestry}
            onChange={onAncestryChange}
            className="w-full"
            label={t("builder.racial.ancestryLabel")}
            placeholder={t("builder.racial.chooseDragon")}
            options={[
              { value: "", label: t("builder.racial.chooseDragon") },
              ...DRACONIC_ANCESTRIES.map((entry) => ({
                value: entry.id,
                label: t("builder.racial.ancestryOption", {
                  dragon: entry.dragon,
                  type: entry.damageType,
                  area: entry.area,
                  save: entry.save.toUpperCase(),
                }),
              })),
            ]}
          />
        </label>
      ) : null}

      {repeated.length && onRepeatChange ? (
        <div data-builder-target="repeatSkills">
          <span className="mb-1 flex flex-wrap items-center gap-1 text-stone-400">
            {t("builder.racial.repeatLine", {
              list: repeated.map((id) => skillLabel(id, locale)).join(" and "),
              choice: t(`builder.racial.repeatChoice_${repeated.length === 1 ? "one" : "other"}`, { count: repeated.length }),
            })}
          </span>
          <div className="grid grid-cols-2 gap-2">
            {repeated.map((_, index) => (
              <span key={index} className="flex items-center gap-1">
                <Select<string>
                  value={repeatSkills[index] ?? ""}
                  onChange={(next) => onRepeatChange(index, next)}
                  className="min-w-0 grow"
                  label={t("builder.racial.repeatN", { n: index + 1 })}
                  placeholder={t("builder.racial.chooseSkill")}
                  options={[
                    { value: "", label: t("builder.racial.chooseSkill") },
                    ...ALL_SKILLS.filter(
                      (skill) =>
                        repeatSkills[index] === skill ||
                        (!repeatSkills.includes(skill) && !grantedSkills.includes(skill) && !skills.includes(skill)),
                    ).map((skill) => ({ value: skill as string, label: skillLabel(skill, locale) })),
                  ]}
                />
                {repeatSkills[index] ? (
                  <InfoButton label={skillLabel(repeatSkills[index], locale)} text={describeSkill(t, repeatSkills[index], locale)} />
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {racialFeats > 0 && onFeatsChange ? (
        <div data-builder-target="racialFeat">
          <span className="mb-1 flex flex-wrap items-center gap-1 text-stone-400">
            {t("builder.racial.featHeader", { count: racialFeats })}
          </span>
          <p className="mb-1.5 text-xs text-stone-500">
            {t("builder.racial.featExplainer", { race: race.name })}
          </p>
          {feats.length ? (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {feats.map((feat) => (
                <Chip
                  key={feat}
                  label={feat}
                  info={{ reference: { kind: "feats", slug: contentSlug(feat), name: feat } }}
                  onRemove={() => onFeatsChange(feats.filter((entry) => entry !== feat))}
                />
              ))}
            </div>
          ) : null}
          {feats.map((feat, index) => (
            <SelectedPrerequisite key={feat} id={`${noteId}-${index}`} check={judge?.checkFeat(feat) ?? null} />
          ))}
          {feats.length < racialFeats ? (
            <>
              <CatalogBrowser
                kind="feats"
                buttonLabel={t("builder.racial.browseFeats")}
                selectedNames={feats}
                judge={judge ? (entry) => judgeEntry(judge, entry) : undefined}
                onPick={(entry) => pickFeat(entry.name)}
                onUnpick={(featName) => onFeatsChange(feats.filter((entry) => entry !== featName))}
                sections={[{ key: "feats:all", label: t("builder.racial.allFeats") }]}
              />
              <p className="mt-2 mb-1 text-xs text-stone-500">{t("builder.racial.orSearch")}</p>
              <ContentPicker
                kind="feats"
                placeholder={t("builder.racial.searchFeats")}
                judge={judge ? (entry) => judgeEntry(judge, entry) : undefined}
                onPick={(entry) => pickFeat(entry.name)}
              />
            </>
          ) : null}
          {featSpecOf && onFeatPicks && known
            ? feats.slice(0, racialFeats).map((feat) => (
                <FeatChoicesFields
                  key={feat}
                  feat={feat}
                  desc={featDescOf?.(feat)}
                  spec={featSpecOf(feat)}
                  picks={featChoice(featChoices, feat)}
                  known={known}
                  onChange={(picks) => onFeatPicks(feat, picks)}
                />
              ))
            : null}
          {featScores.length > 1 && onFeatAbilityChange ? (
            <label className="mt-2 block sm:w-64">
              <span className="mb-1 block text-xs text-stone-500">{t("builder.racial.featRaisesBy1", { feat: feats[0] })}</span>
              <Select<Ability>
                value={featScores.includes(featAbility as Ability) ? (featAbility as Ability) : featScores[0]}
                onChange={(ability) => onFeatAbilityChange(ability)}
                label={t("builder.racial.featRaises", { feat: feats[0] })}
                className="w-full"
                options={featScores.map((ability) => ({ value: ability, label: abilityWord(ability) }))}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {race.toolChoice ? (
        <label className="block" data-builder-target="racialTool">
          <span className="mb-1 block text-stone-400">{t("builder.racial.toolHeader")}</span>
          <Select<string>
            value={tool}
            onChange={onToolChange}
            className="w-full"
            label={t("builder.racial.toolHeader")}
            placeholder={t("builder.racial.chooseTool")}
            options={[{ value: "", label: t("builder.racial.chooseTool") }, ...race.toolChoice.from.map((entry) => ({ value: entry, label: entry }))]}
          />
        </label>
      ) : null}

      <RacialCantripPicker race={race} cantrips={cantrips} onChange={onCantripsChange} />
    </div>
  );
}
