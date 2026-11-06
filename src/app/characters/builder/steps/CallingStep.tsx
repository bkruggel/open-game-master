"use client";

import { useMemo, useState, type ReactNode } from "react";
import { GameTerm } from "@/components/ui/GameTerm";
import { InfoButton, InfoDialog } from "@/components/ui/InfoDialog";
import { describeFeature, describeSkill } from "@/lib/help";
import { contentName } from "@/lib/content/names";
import { useClassFeatureText } from "@/lib/classes/use-feature-text";
import { firstSentence } from "@/lib/help/rules-text";
import { CLASS_ROLES, classRoles, type ClassRole } from "@/lib/srd/class-roles";
import { subclassBlurb } from "@/lib/srd/features";
import { SRD_SKILLS } from "@/lib/srd";
import { displayName, type Reskinned } from "@/lib/worlds/reskin-logic";
import type { WorldPack } from "@/lib/worlds/types";
import { classCard } from "../cardFaces";
import { CardText } from "../CardText";
import { abilityName, hitDieChip } from "../lineage";
import { useShowNumbers } from "../numbersPref";
import { OptionCardGrid, type CardFacet, type OptionCardGroup } from "../OptionCardGrid";
import OptionPicker, { type PickerGroup } from "../OptionPicker";
import { classInfoText } from "../usePickerGroups";
import { grantedSkillSources, grantingTrait } from "../reconcile";
import type { ArchetypeOption, BackgroundOption, ClassOption, RaceOption } from "../useBuilderOptions";
import type { BuilderActions, BuilderDerived } from "../useBuilderDerived";
import type { BuilderState } from "../useBuilderState";
import { ClassChoices } from "./ClassChoices";
import { MulticlassSection } from "./MulticlassSection";
import { PlaystylePicker } from "../PlaystylePicker";
import { fillClassSkills, type PlaystyleId } from "../playstyles";
import FeatChoicesFields, { knownTraining } from "../FeatChoicesFields";
import { Field, PickForMe, PickPill, StepPanel, inputClass } from "./shared";
import { featChoice } from "@/lib/schemas/sheet";
import { useLocale, useT } from "@/lib/locale";
import type { Locale } from "@/lib/messages-logic";

// Step 1 (backlog F4: how you want to play comes first): the setting's
// notices, then the class (the playstyle question and "Help me build" over
// painted cards in the picker's groups and order, the setting's callings
// first and badged, each with its emblem and a ? that opens its write-up),
// the level, its subclass once the level allows one, what the pair grants at
// this level, and the class skill picks. Expertise, fighting styles and
// option lists (invocations and the like) follow in ClassChoices.
export function CallingStep({
  state,
  derived,
  actions,
  klass,
  race,
  background,
  pack,
  classes,
  classGroups,
  subclassGroups,
  offersSubclass,
  subclassLockedAt,
  chosenArchetype,
  playstyle,
  onPickForMe,
  classNote = null,
  subclassNote = null,
  notices = null,
  genderField = null,
  levelField = null,
  multiclassAllowed = true,
}: {
  state: BuilderState;
  derived: BuilderDerived;
  actions: BuilderActions;
  klass: ClassOption | undefined;
  race: RaceOption | undefined;
  background: BackgroundOption | undefined;
  pack: WorldPack | null;
  classes: Array<Reskinned<ClassOption>>;
  classGroups: PickerGroup[];
  subclassGroups: PickerGroup[];
  offersSubclass: boolean;
  // The level the class picks a subclass at, while this level is below it.
  subclassLockedAt: number | null;
  chosenArchetype: ArchetypeOption | null;
  // A new character's answer to "how do you want to play", held by the
  // builder so the background's hints and the quiz follow it. The question
  // is in its door's words (a player's job, or what the party needs), and
  // "Help me build" (QuickBuildQuiz.tsx) carries the job picked so far.
  playstyle?: {
    value: PlaystyleId | null;
    onChange: (style: PlaystyleId | null) => void;
    question?: string;
    intro?: string;
    onHelpMeBuild?: (style: PlaystyleId | null) => void;
  };
  // The setting's notices (ContentNotices), the gender (GenderField), which
  // the class cards' art follows, so it is asked above them, and the level
  // (LevelField): the level decides what this step and every later one
  // offers, so it is set here, under the class.
  notices?: ReactNode;
  genderField?: ReactNode;
  levelField?: ReactNode;
  // "Pick for me" on the subclass (quickBuild.ts), offered once the level
  // asks for one.
  onPickForMe?: (target: "subclass") => void;
  // Why the class or subclass list may be short (TableScopeNote): the
  // asker's own Homebrew the table leaves out, or a list that did not load.
  classNote?: ReactNode;
  subclassNote?: ReactNode;
  // Whether a second class may be added here (backlog F9): the table's
  // multiclassing setting, always true in the library.
  multiclassAllowed?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { subclass } = state;
  const { effectiveLevel } = derived;
  // The first class's own levels and features: a class taken after it
  // shows its own in its card (MulticlassSection).
  const primaryLevel = derived.primaryLevel ?? effectiveLevel;
  const grantedFeatures = derived.multiclass ? (derived.featuresByClass[0]?.features ?? []) : derived.grantedFeatures;
  const { gender } = state;
  // A genre class's feature text arrives on demand (issue 411).
  useClassFeatureText([klass?.id]);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  // "Show rules and numbers" (backlog F11): the cards add the hit die.
  const numbers = useShowNumbers();
  // What "Suggest the rest" picked, said until the player changes a pick.
  const [suggested, setSuggested] = useState<string[] | null>(null);
  // The skills already the character's from race or background, and the
  // source each came from: the same map the toggle refuses by, so every
  // greyed pill says why (issue #109).
  const skillSources = useMemo(
    () =>
      grantedSkillSources({
        race,
        background,
        racialSkills: state.racialSkills,
        backgroundSkills: state.backgroundSkills,
      }),
    [race, background, state.racialSkills, state.backgroundSkills],
  );

  // Each class's job in a fight and which of the core four it plays like
  // (src/lib/srd/class-roles.ts).
  const readings = useMemo(
    () =>
      new Map(
        classGroups.flatMap((group) =>
          group.options.map((option) => [
            option.id,
            classRoles(classes.find((candidate) => candidate.id === option.id) ?? { id: option.id }),
          ]),
        ),
      ),
    [classGroups, classes],
  );
  // Each card's face: its play line, its job, its HP in words, its caster
  // (cardFaces.ts, backlog F11).
  const cardGroups = useMemo<OptionCardGroup[]>(
    () =>
      classGroups.map((group) => ({
        label: group.label,
        recommended: group.recommended,
        options: group.options.map((option) =>
          classCard({
            option,
            entry: classes.find((candidate) => candidate.id === option.id),
            reading: readings.get(option.id),
            gender,
            numbers,
          }),
        ),
      })),
    [classGroups, classes, gender, readings, numbers],
  );
  // The class grid's filters (OptionCardGrid): its job in a fight, how much
  // magic it has, which of the core four it plays like, and its book or
  // setting. Each offers only the values some class has, so a veteran can
  // ask for the tanks among the setting's classes.
  const classFacets = useMemo<CardFacet[]>(() => {
    const entryOf = (id: string) => classes.find((candidate) => candidate.id === id);
    const magicOf = (id: string) => {
      const type = entryOf(id)?.casterType ?? "none";
      return type === "none" ? t("builder.calling.magicNone") : type === "half" || type === "artificer" ? t("builder.calling.magicHalf") : t("builder.calling.magicFull");
    };
    const bookOf = (id: string) => {
      const entry = entryOf(id);
      return entry?.genres?.length ? entry.genres.map(genreWords).join(", ") : entry?.source || t("builder.shared.coreRules");
    };
    const ids = [...readings.keys()];
    const present = (values: string[]) => [...new Set(values)].sort().map((value) => ({ value, label: value }));
    return [
      {
        key: "role",
        label: t("builder.calling.facetRole"),
        options: CLASS_ROLES.filter((role) => ids.some((id) => readings.get(id)?.roles.includes(role))).map((role) => ({ value: role, label: role })),
        test: (id, role) => Boolean(readings.get(id)?.roles.includes(role as ClassRole)),
      },
      {
        key: "magic",
        label: t("builder.calling.facetMagic"),
        options: ([t("builder.calling.magicNone"), t("builder.calling.magicHalf"), t("builder.calling.magicFull")] as string[]).filter((kind) => ids.some((id) => magicOf(id) === kind)).map((kind) => ({ value: kind, label: kind })),
        test: (id, kind) => magicOf(id) === kind,
      },
      {
        key: "plays",
        label: t("builder.calling.facetPlays"),
        options: ["Fighter", "Wizard", "Cleric", "Rogue"].map((core) => ({ value: core, label: core })),
        test: (id, core) => Boolean(readings.get(id)?.playsLike.includes(core)),
      },
      {
        key: "book",
        label: t("builder.calling.facetBook"),
        options: present(ids.map(bookOf)),
        test: (id, book) => bookOf(id) === book,
      },
    ];
  }, [classes, readings, t]);
  const details = detailsFor
    ? classGroups.flatMap((group) => group.options).find((option) => option.id === detailsFor)
    : undefined;

  return (
    <div className="space-y-4">
      {notices}
      <StepPanel title={t("builder.calling.chooseClass")} ornate anchor="class">
        {/* A plain-language way in, above the full catalog it points into.
            "Easy to learn" there and the setting's star in the grid mean
            different things: one is about play, the other about the world. */}
        <PlaystylePicker
          offered={classGroups.flatMap((group) =>
            group.options.map((option) => {
              const reading = readings.get(option.id);
              return { id: option.id, name: option.name, roles: reading?.roles ?? [], playsLike: reading?.playsLike ?? "" };
            }),
          )}
          chosen={klass?.id ?? ""}
          onChoose={state.changeClass}
          style={playstyle?.value}
          onStyle={playstyle?.onChange}
          question={playstyle?.question}
          intro={playstyle?.intro}
          onHelpMeBuild={playstyle?.onHelpMeBuild}
        />
        {genderField}
        <Field label={t("builder.calling.class")} className="mt-4">
          {klass ? (
            <span className="mb-3 flex flex-wrap items-center gap-x-1 text-xs text-stone-500">
              <span className="text-amber-200">{klass.name}:</span>{" "}
              {/* In words first (backlog F11); the die joins them with "Show rules and numbers" on. */}
              <GameTerm id="hit_dice"><CardText text={hitDieChip(klass.hitDie, numbers)} /></GameTerm> ·{" "}
              <GameTerm id="saving_throw">{t("builder.meta.savesWord")}</GameTerm>{" "}
              {klass.saves.map(abilityName).join(", ")}
              {klass.spellAbility ? (
                <>
                  {" · "}
                  <GameTerm id={klass.spellAbility}>{abilityName(klass.spellAbility)}</GameTerm>{" "}
                  {t("builder.calling.caster")}
                  {klass.castingLabel ? t("builder.calling.flavored", { label: klass.castingLabel }) : ""}
                </>
              ) : null}
              <InfoButton
                label={klass.name}
                text={classInfoText(klass)}
                reference={{ kind: "classes", slug: klass.id }}
              />
            </span>
          ) : null}
          <OptionCardGrid
            groups={cardGroups}
            value={klass?.id ?? ""}
            onChoose={state.changeClass}
            onDetails={setDetailsFor}
            noun="class"
            facets={classFacets}
            compact
            numbersSwitch
          />
          {classNote}
          {/* The same write-up the dropdown's info button opened: the pack's
              blurb, the catalog blurb or the content pack's entry. */}
          <InfoDialog
            open={Boolean(details)}
            onOpenChange={(open) => (open ? undefined : setDetailsFor(null))}
            title={details?.name ?? ""}
            // The card's role and "plays like", said again where the class
            // is read about at length.
            meta={
              details
                ? classDetailsMeta(t, {
                    id: details.id,
                    meta: details.meta,
                    saves: classes.find((candidate) => candidate.id === details.id)?.saves,
                    reading: readings.get(details.id),
                    locale,
                  }).join(" · ")
                : undefined
            }
            text={details?.infoText}
            reference={details?.reference}
          />
        </Field>
        {levelField}
        {offersSubclass ? (
          <Field label={t("builder.calling.subclass")} className="mt-3" anchor="subclass">
            <OptionPicker
              value={subclass}
              groups={subclassGroups}
              placeholder={t("builder.calling.subclassNone")}
              className={inputClass}
              onChange={state.changeSubclass}
            />
            <span className="mt-1 flex items-start gap-1 text-xs text-stone-500">
              {subclass ? (
                <>
                  <span className="grow">
                    {firstSentence(chosenArchetype?.desc || subclassBlurb(klass?.id ?? "", subclass)) ??
                      t("builder.calling.specialization")}
                  </span>
                  <InfoButton
                    label={subclass}
                    text={chosenArchetype?.desc || subclassBlurb(klass?.id ?? "", subclass) || undefined}
                    reference={
                      chosenArchetype ? { kind: "archetypes", slug: chosenArchetype.id } : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <span className="grow">
                    <span className="text-amber-300">{t("builder.calling.subclassStill")}</span>
                    {t("builder.calling.subclassWhy")}
                  </span>
                  {onPickForMe ? <PickForMe what={t("builder.calling.aSubclass")} onPick={() => onPickForMe("subclass")} /> : null}
                </>
              )}
            </span>
            {subclassNote}
            {/* What the subclass trains the character in (issue 251): its
                armor and weapons said outright, and its picks asked for here,
                as a feat's are. */}
            {derived.subclassTraining.map((grant) => (
              <FeatChoicesFields
                key={grant.name}
                feat={grant.name}
                spec={grant.spec}
                picks={featChoice(state.featChoices, grant.name)}
                known={knownTraining(derived)}
                onChange={(picks) => state.setFeatPicks(grant.name, picks)}
                source="subclass"
              />
            ))}
          </Field>
        ) : subclassLockedAt !== null && klass ? (
          // Below the class's subclass level the menu stays shut and says
          // when the choice comes, instead of listing picks that vanished.
          <Field label={t("builder.calling.subclass")} className="mt-3">
            <p className="rounded-lg border border-dashed border-stone-700/70 bg-stone-950/40 px-3 py-2 text-xs text-stone-400">
              {t("builder.calling.locked", {
                class: klass.name.toLowerCase(),
                level: subclassLockedAt,
                at: derived.multiclass ? t("builder.calling.classLevel", { class: klass.name.toLowerCase() }) : t("builder.calling.levelWord"),
                then: primaryLevel,
              })}
            </p>
            {subclassNote}
          </Field>
        ) : null}
      </StepPanel>

      {klass ? (
        <MulticlassSection
          state={state}
          derived={derived}
          klass={klass}
          classes={classes}
          classGroups={classGroups}
          allowed={multiclassAllowed}
          numbers={numbers}
        />
      ) : null}

      {grantedFeatures.length ? (
        <StepPanel
          title={
            derived.multiclass
              ? t("builder.calling.gainsMulti", { class: klass?.name.toLowerCase() ?? "", level: primaryLevel })
              : t("builder.calling.gains", { level: effectiveLevel })
          }
          help={t("builder.calling.gainsHelp")}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {grantedFeatures.map((feature) => (
              <span
                key={`${feature.name}-${feature.level ?? 0}`}
                className="flex items-center gap-1 text-xs text-stone-300"
              >
                {displayName(pack, "features", feature.name)}
                <InfoButton
                  label={feature.name}
                  meta={feature.level ? t("sheet.featureLevel", { level: feature.level }) : undefined}
                  text={klass ? describeFeature(klass.id, subclass, feature.name) : null}
                />
              </span>
            ))}
          </div>
        </StepPanel>
      ) : null}

      {klass ? (
        <StepPanel
          anchor="classSkills"
          title={t("builder.calling.classSkills", { count: klass.skillChoices.count })}
          help={
            <>
              {klass.skillChoices.count - state.chosenSkills.length > 0 ? (
                <span className="text-amber-300">
                  {t("builder.calling.stillToChoose", { count: klass.skillChoices.count - state.chosenSkills.length })}
                  <button
                    type="button"
                    onClick={() => {
                      const filled = fillClassSkills({
                        classId: klass.id,
                        from: klass.skillChoices.from,
                        count: klass.skillChoices.count,
                        chosen: state.chosenSkills,
                        granted: new Set(skillSources.keys()),
                      });
                      setSuggested(filled.filter((id) => !state.chosenSkills.includes(id)));
                      state.setChosenSkills(filled);
                    }}
                    className="underline-offset-2 hover:underline"
                    data-suggest-skills
                  >
                    {t("builder.calling.suggest")}
                  </button>{" "}
                </span>
              ) : suggested?.length && suggested.every((id) => state.chosenSkills.includes(id)) ? (
                <span key={suggested.join()} className="reveal block text-amber-200/90">
                  {t("builder.calling.suggestedFor", {
                    class: klass.name.toLowerCase(),
                    list: suggested.map((id) => SRD_SKILLS.find((entry) => entry.id === id)?.name ?? id).join(", "),
                  })}
                </span>
              ) : null}
              {t("builder.calling.skillsHelpA")}{" "}
              <GameTerm id="skill">{t("builder.shared.skill")}</GameTerm>
              {t("builder.calling.skillsHelpB")}
              <GameTerm id="proficiency_bonus">{t("builder.shared.proficiencyBonus")}</GameTerm>
              {t("builder.calling.skillsHelpC")}
            </>
          }
        >
          <div className="flex flex-wrap gap-2">
            {klass.skillChoices.from.map((skillId) => {
              const skill = SRD_SKILLS.find((entry) => entry.id === skillId);
              const name = skill?.name ?? skillId;
              const source = skillSources.get(skillId.trim().toLowerCase());
              const sourceWord = source === "race" ? t("builder.calling.sourceRace") : source === "background" ? t("builder.calling.sourceBackground") : "";
              const grantedBy = source === "race" ? race?.name : source === "background" ? background?.name : "";
              const trait = source === "race" && race ? grantingTrait(race.id, name) : null;
              const info = source
                ? t("builder.calling.alreadyYours", {
                    name,
                    source: sourceWord,
                    via: trait ? t("builder.calling.via", { trait }) : "",
                  }).concat(
                    grantedBy ? ` (${grantedBy})` : "",
                    "\n\n",
                    describeSkill(t, skillId, locale) ?? "",
                  ).trim()
                : describeSkill(t, skillId, locale);
              return (
                <PickPill
                  key={skillId}
                  label={name}
                  selected={state.chosenSkills.includes(skillId)}
                  disabled={Boolean(source)}
                  onClick={() => actions.toggleSkill(skillId)}
                  info={{ text: info }}
                >
                  {name}
                  {source ? t("builder.calling.sourceTag", { source: sourceWord }) : ""}
                </PickPill>
              );
            })}
          </div>
        </StepPanel>
      ) : null}

      <ClassChoices state={state} derived={derived} actions={actions} klass={klass} />
    </div>
  );
}

// A genre id as the filter reads it ("dark-fantasy" is "Dark fantasy").
function genreWords(genre: string): string {
  const words = genre.replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The parts of the line over a class's write-up, joined with " · ": its
// book, its saves, its job in a fight and which of the core four it plays
// like. The card's details dialog and the build math panel's picks both
// read it.
export function classDetailsMeta(
  t: (key: string, vars?: Record<string, string | number>) => string,
  {
    id,
    meta,
    saves,
    reading,
    locale = "en",
  }: {
    id: string;
    meta?: string;
    saves?: string[];
    reading?: ReturnType<typeof classRoles>;
    // The reader's language, for the class names in a play line.
    locale?: Locale;
  },
): string[] {
  const likeWords = (names: string) =>
    names
      .split(/\s*\+\s*/)
      .map((name) => contentName("classes", name.trim(), locale))
      .join(" + ");
  return [
    meta,
    saves?.length ? t("builder.meta.saves", { list: saves.map(abilityName).join(", ") }) : "",
    reading ? t("builder.meta.role", { roles: reading.roles.map((role) => t(`builder.face.role.${role.toLowerCase()}`)).join(" / ") }) : "",
    reading
      ? reading.playsLike.toLowerCase() === id.toLowerCase()
        ? t("builder.meta.coreFour")
        : t("builder.meta.playsLike", { like: likeWords(reading.playsLike) }).concat(reading.suggested ? t("builder.meta.suggested") : "")
      : "",
  ].filter((part): part is string => Boolean(part));
}
