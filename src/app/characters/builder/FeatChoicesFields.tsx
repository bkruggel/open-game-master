"use client";

import { Select } from "@/components/ui/Select";
import { STANDARD_LANGUAGES } from "@/lib/content/mechanics";
import { describeSkill } from "@/lib/help";
import { SRD_SKILLS } from "@/lib/srd";
import { KNOWN_TOOLS, anyPicksMade, pickSlots, type FeatGrantSpec, type FeatPicks, type PickKind } from "@/lib/srd/feat-grants";
import { featEngineTag } from "@/lib/srd/feat-combat";
import { featAbilityIncrease } from "@/lib/srd/feat-effects";
import { ABILITY_LABELS } from "./AbilityEditor";
import { featSpellsAnything, type CastingAbility } from "@/lib/srd/feat-spells";
import { SRD_WEAPONS } from "@/lib/srd/weapons";
import { textKey } from "@/lib/language/text-logic";
import { useLocale, useT } from "@/lib/locale";
import { skillLabel } from "@/lib/srd";
import ContentPicker from "./ContentPicker";
import { PickPill } from "./steps/shared";

// What the character already has, so a feat's pick is never one of them.
export type KnownTraining = {
  languages: string[];
  skills: string[];
  expertise: string[];
  weapons: string[];
  tools: string[];
  armor: string[];
};

// The builder's training as it stands, for the pickers, known on every
// step (useBuilderDerived's `training` needs no ability score).
export function knownTraining(derived: {
  training: { languages: string[]; skills: string[]; expertise?: string[]; weapons: string[]; tools: string[]; armor?: string[] };
}): KnownTraining {
  const { training } = derived;
  return {
    languages: training.languages,
    skills: training.skills,
    expertise: training.expertise ?? [],
    weapons: training.weapons,
    tools: training.tools,
    armor: training.armor ?? [],
  };
}
// Each word's first letter up ("thieves' tools" to "Thieves' Tools"), the
// letter after a possessive left alone ("Alchemist's Supplies").
const capital = (value: string) => value.replace(/(^|\s)([a-z])/g, (_, before, letter) => `${before}${letter.toUpperCase()}`);

// The picks a feat leaves to the player, beside the feat (issue #125):
// Linguist's three languages, Skill Expert's skill and the expertise on it,
// Weapon Master's four weapons, a pack feat's tool; a count shared between
// kinds (Skilled's three skills or tools) shrinks each kind's slots as the
// others fill (issue #147). Each list offers only what the character does
// not already have, less this feat's own picks, which stay offered so they
// can be changed. What the feat hands over outright is said under them.
export default function FeatChoicesFields({
  feat,
  spec,
  picks,
  known,
  onChange,
  desc,
  source = "feat",
}: {
  feat: string;
  spec: FeatGrantSpec;
  picks: FeatPicks | undefined;
  known: KnownTraining;
  onChange: (picks: FeatPicks) => void;
  // The feat's text, for the ability point it names (what the table applies).
  desc?: string;
  // A subclass feature's training (src/lib/srd/subclass-training.ts) reads
  // the same, but is applied whole: it has no "rest" the DM runs.
  source?: "feat" | "subclass";
}) {
  const t = useT();
  const locale = useLocale();
  const mine = {
    languages: picks?.languages ?? [],
    skills: picks?.skills ?? [],
    expertise: picks?.expertise ?? [],
    weapons: picks?.weapons ?? [],
    tools: picks?.tools ?? [],
    armor: picks?.armor ?? [],
  };
  // How many of a kind this feat lets the player name right now: its own
  // count plus what is left of the shared one.
  const slots = (kind: PickKind) => pickSlots(spec, picks, kind);
  const sharedLeft = spec.any - anyPicksMade(spec, picks);
  // Held by someone other than this feat.
  const heldBy = (kind: keyof KnownTraining) => {
    const own = new Set(mine[kind].map(textKey));
    return new Set(known[kind].map(textKey).filter((entry) => !own.has(entry)));
  };
  const set = (kind: keyof KnownTraining, index: number, value: string) => {
    const next = [...(mine[kind] ?? [])];
    while (next.length < index) {
      next.push("");
    }
    next[index] = value;
    onChange({ ...picks, [kind]: next });
  };
  const toggle = (kind: "skills" | "expertise", value: string, limit: number) => {
    const current = mine[kind];
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : current.length < limit
        ? [...current, value]
        : current;
    onChange({ ...picks, [kind]: next });
  };
  const heldLanguages = heldBy("languages");
  const heldSkills = heldBy("skills");
  const heldExpertise = heldBy("expertise");
  const heldWeapons = heldBy("weapons");
  const heldTools = heldBy("tools");
  const heldArmor = heldBy("armor");
  // The feat's expertise goes on a skill the character has, the feat's own
  // skill included.
  const expertiseFrom = [...new Set([...known.skills, ...mine.skills])].filter((skill) => !heldExpertise.has(textKey(skill)));
  const hasPicks = spec.languages + spec.skills + spec.expertise + spec.weapons + spec.tools + spec.any + spec.damageTypes.length > 0;
  const armorWords = (piece: string) => (piece === "shields" ? t("builder.feats.shields") : t("builder.feats.armorPiece", { piece }));
  const abilityWords = {
    str: "sheet.ability.str",
    dex: "sheet.ability.dex",
    con: "sheet.ability.con",
    int: "sheet.ability.int",
    wis: "sheet.ability.wis",
    cha: "sheet.ability.cha",
  } as const;
  const fixed = [
    ...spec.fixedSkills.map((skill) => (spec.fixedExpertise.includes(skill) ? `${skillLabel(skill, locale)} ${t("builder.feats.expertiseWord")}` : skillLabel(skill, locale))),
    ...spec.fixedLanguages,
    ...spec.armor.map(armorWords),
    ...spec.fixedWeapons,
    ...spec.fixedTools,
  ];
  const taught = spec.taught;
  const teaches = featSpellsAnything(taught) && taught.cantrips + taught.spells > 0;
  // What the table applies of this feat, in a sentence, so a player never
  // assumes the rest is on the sheet (issue #147): the ability point, the
  // training and spells read from its text, and the combat rules the
  // engines run; the DM runs whatever is left from the feat's text.
  const increase = desc !== undefined ? featAbilityIncrease(feat, desc) : null;
  const engineTag = featEngineTag(feat);
  const applied = [
    ...(increase
      ? [
          increase.from.length === 6
            ? t("builder.feats.increaseAny")
            : t("builder.feats.increaseFrom", {
                abilities: increase.from.map((ability) => t(abilityWords[ability as keyof typeof abilityWords])).join(" or "),
              }),
        ]
      : []),
    ...(spec.languages + spec.fixedLanguages.length ? [t("builder.feats.applied.languages")] : []),
    ...(spec.skills + spec.fixedSkills.length ? [t("builder.feats.applied.skills")] : []),
    ...(spec.expertise ? [t("builder.feats.applied.expertise")] : []),
    ...(spec.armor.length + spec.armorFrom.length ? [t("builder.feats.applied.armor")] : []),
    ...(spec.weapons + spec.fixedWeapons.length + spec.weaponsFrom.length ? [t("builder.feats.applied.weapons")] : []),
    ...(spec.tools + spec.fixedTools.length ? [t("builder.feats.applied.tools")] : []),
    ...(spec.any ? [t("builder.feats.applied.any", { count: spec.any })] : []),
    ...(teaches || taught.fixedSpells.length || taught.fixedCantrips.length ? [t("builder.feats.applied.spells")] : []),
    ...(spec.damageTypes.length ? [t("builder.feats.applied.damageType")] : []),
    ...(engineTag ? [t("builder.feats.applied.combat", { tag: engineTag })] : []),
  ];
  const coverage =
    source === "subclass"
      ? t("builder.feats.coverage.subclass")
      : applied.length
        ? t("builder.feats.coverage.applied", { applied: applied.join(", ") })
        : t("builder.feats.coverage.none");
  if (!hasPicks && !teaches && !fixed.length) {
    return (
      <p className="mt-1 text-sm text-stone-500" data-feat-coverage={feat}>
        {coverage}
      </p>
    );
  }
  // A shared pick ("three skills or tools") names no tool list: every tool
  // the table knows is offered, as the server allows.
  const toolsOffered = spec.toolsFrom.length ? spec.toolsFrom : KNOWN_TOOLS;
  const weaponsOffered = spec.weaponsFrom.length
    ? SRD_WEAPONS.filter((weapon) => spec.weaponsFrom.some((offered) => textKey(offered) === textKey(weapon.name)))
    : SRD_WEAPONS;
  // The spells the feat teaches (src/lib/srd/feat-spells.ts): the class
  // list and casting ability where the feat leaves them open, then one
  // search per cantrip and per spell, held to the feat's level, school and
  // list by the content API's filters.
  const spellPicks = { cantrips: picks?.cantrips ?? [], spells: picks?.spells ?? [] };
  const listPicked = (picks?.list ?? "").trim().toLowerCase();
  const listParam = taught.listChoice ? listPicked : taught.lists.length === 1 ? taught.lists[0] : "";
  const needsList = taught.listChoice && !listPicked;
  const setSpell = (kind: "cantrips" | "spells", index: number, value: string) => {
    const next = [...spellPicks[kind]];
    while (next.length < index) {
      next.push("");
    }
    next[index] = value;
    onChange({ ...picks, [kind]: next.filter((entry, at) => entry || at < index) });
  };
  const spellSlots = (kind: "cantrips" | "spells", count: number, level: number) =>
    Array.from({ length: count }, (_, index) => {
      const chosen = spellPicks[kind][index] ?? "";
      const label =
        kind === "cantrips"
          ? t(taught.attackCantrip ? "builder.feats.spellSlot.attackCantrip" : "builder.feats.spellSlot.cantrip", { feat, n: index + 1 })
          : t("builder.feats.spellSlot.spell", {
              feat,
              level: t(`builder.feats.spellLevel.${level === 1 ? "1" : "n"}`, { level: level === 1 ? 1 : level }),
              school: taught.schools.length ? `${taught.schools.join(" or ")} ` : "",
              ritual: taught.ritualBook ? t("builder.feats.spellRitual") : "",
              n: index + 1,
            });
      return (
        <div key={`${kind}-${index}`} data-feat-spell={`${feat}:${kind}:${index + 1}`}>
          <span className="mb-1 block text-sm text-stone-400">{label}</span>
          {chosen ? (
            <div className="flex items-center gap-2">
              <PickPill label={chosen} selected onClick={() => setSpell(kind, index, "")}>
                {capital(chosen)}
              </PickPill>
              <span className="text-sm text-stone-500">{t("builder.feats.tapToChange")}</span>
            </div>
          ) : needsList ? (
            <span className="text-xs text-stone-500">{t("builder.feats.pickListFirst")}</span>
          ) : (
            <ContentPicker
              kind="spells"
              extraParams={{
                level: String(level),
                exact: "1",
                ...(listParam ? { class: listParam } : {}),
                ...(taught.schools.length ? { school: taught.schools.join(",") } : {}),
                ...(kind === "cantrips" && taught.attackCantrip ? { attack: "1" } : {}),
              }}
              placeholder={t("builder.feats.searchSpells", { kind: kind === "cantrips" ? t("builder.feats.cantripWord") : t("builder.feats.spellWord") })}
              onPick={(entry) => setSpell(kind, index, entry.name)}
            />
          )}
        </div>
      );
    });
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-amber-900/40 bg-amber-950/10 p-2.5" data-feat-choices={feat}>
      <p className="text-xs text-amber-200/90">{hasPicks || teaches ? t("builder.feats.choicesTitle", { feat }) : feat}</p>
      {spec.any > 0 ? (
        <p className="text-sm text-stone-400" data-feat-shared={feat}>
          {t("builder.feats.anyOf", {
            count: spec.any,
            kinds: spec.anyKinds.map((kind) => (kind === "armor" ? t("builder.feats.shields") : kind)).join(", "),
          })}
          {sharedLeft > 0 ? <span className="text-amber-300">{t("builder.feats.stillToChoose", { count: sharedLeft })}</span> : null}
        </p>
      ) : null}
      {slots("languages") > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: slots("languages") }, (_, index) => (
            <Select<string>
              key={index}
              value={mine.languages[index] ?? ""}
              onChange={(picked) => set("languages", index, picked)}
              className="w-full"
              label={t("builder.feats.languageN", { feat, n: index + 1 })}
              placeholder={t("builder.feats.chooseLanguage")}
              options={[
                { value: "", label: t("builder.feats.chooseLanguage") },
                ...STANDARD_LANGUAGES.filter(
                  (language) =>
                    !heldLanguages.has(textKey(language)) &&
                    (mine.languages[index] === language || !mine.languages.includes(language)),
                ).map((language) => ({ value: language as string, label: language as string })),
              ]}
            />
          ))}
        </div>
      ) : null}
      {slots("skills") > 0 ? (
        <div>
          <span className="mb-1 block text-sm text-stone-400">
            {spec.anyKinds.includes("skills")
              ? t("builder.feats.skillsHeader.any", { count: slots("skills") })
              : t("builder.feats.skillsHeader.fixed", { count: spec.skills })}
            {spec.pickedExpertise ? t("builder.feats.withExpertise") : ""}
            {mine.skills.length < spec.skills ? <span className="text-amber-300">{t("builder.feats.stillToChoose", { count: spec.skills - mine.skills.length })}</span> : null}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SRD_SKILLS.filter((skill) => !heldSkills.has(textKey(skill.id)) && (!spec.skillsFrom.length || spec.skillsFrom.includes(skill.id))).map((skill) => (
              <PickPill
                key={skill.id}
                label={skill.name}
                selected={mine.skills.includes(skill.id)}
                onClick={() => toggle("skills", skill.id, slots("skills"))}
                info={{ text: describeSkill(t, skill.id, locale) }}
              >
                {skill.name}
              </PickPill>
            ))}
          </div>
        </div>
      ) : null}
      {spec.expertise > 0 ? (
        <div>
          <span className="mb-1 block text-sm text-stone-400">
            {t("builder.feats.expertiseHeader", { count: spec.expertise })}
            {mine.expertise.length < spec.expertise ? <span className="text-amber-300">{t("builder.feats.stillToChoose", { count: spec.expertise - mine.expertise.length })}</span> : null}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {expertiseFrom.length ? null : <span className="text-xs text-stone-500">{t("builder.feats.pickSkillFirst")}</span>}
            {expertiseFrom.map((skillId) => (
              <PickPill
                key={skillId}
                label={skillLabel(skillId, locale)}
                selected={mine.expertise.includes(skillId)}
                onClick={() => toggle("expertise", skillId, spec.expertise)}
                info={{ text: describeSkill(t, skillId, locale) }}
              >
                {skillLabel(skillId, locale)}
              </PickPill>
            ))}
          </div>
        </div>
      ) : null}
      {slots("weapons") > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: slots("weapons") }, (_, index) => (
            <Select<string>
              key={index}
              value={mine.weapons[index] ?? ""}
              onChange={(picked) => set("weapons", index, picked)}
              className="w-full"
              label={t("builder.feats.weaponN", { feat, n: index + 1 })}
              placeholder={t("builder.feats.chooseWeapon")}
              options={[
                { value: "", label: t("builder.feats.chooseWeapon") },
                ...weaponsOffered.filter(
                  (weapon) =>
                    !heldWeapons.has(textKey(weapon.name)) &&
                    (mine.weapons[index] === weapon.name || !mine.weapons.includes(weapon.name)),
                ).map((weapon) => ({ value: weapon.name, label: weapon.name, hint: weapon.damage })),
              ]}
            />
          ))}
        </div>
      ) : null}
      {spec.damageTypes.length ? (
        <Select<string>
          value={picks?.damageType ?? ""}
          onChange={(picked) => onChange({ ...picks, damageType: picked })}
          className="w-full sm:w-64"
          label={t("builder.feats.damageTypeN", { feat })}
          placeholder={t("builder.feats.chooseDamageType")}
          options={[
            { value: "", label: t("builder.feats.chooseDamageType") },
            ...spec.damageTypes.map((type) => ({ value: type, label: capital(type) })),
          ]}
        />
      ) : null}
      {teaches && taught.listChoice ? (
        <Select<string>
          value={listPicked}
          onChange={(picked) => onChange({ ...picks, list: picked, cantrips: [], spells: [] })}
          className="w-full sm:w-64"
          label={t("builder.feats.spellListN", { feat })}
          placeholder={t("builder.feats.chooseSpellList")}
          options={[
            { value: "", label: t("builder.feats.chooseSpellList") },
            ...taught.lists.map((list) => ({ value: list, label: capital(list) })),
          ]}
        />
      ) : null}
      {teaches && taught.ability === "choice" ? (
        <Select<CastingAbility | "">
          value={picks?.ability ?? ""}
          onChange={(picked) => onChange({ ...picks, ...(picked ? { ability: picked } : {}) })}
          className="w-full sm:w-64"
          label={t("builder.feats.spellAbilityN", { feat })}
          placeholder={t("builder.feats.chooseAbilityWord")}
          options={[
            { value: "", label: t("builder.feats.chooseAbilityWord") },
            { value: "int", label: t("sheet.ability.int") },
            { value: "wis", label: t("sheet.ability.wis") },
            { value: "cha", label: t("sheet.ability.cha") },
          ]}
        />
      ) : null}
      {teaches && taught.fixedSpells.length ? (
        <p className="text-sm text-stone-400">
          {t("builder.feats.knownFromFeat", { list: taught.fixedSpells.map(capital).join(", ") })}
          {taught.freeCast ? t("builder.feats.freeCast") : ""}.
        </p>
      ) : null}
      {teaches && taught.cantrips > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{spellSlots("cantrips", taught.cantrips, 0)}</div> : null}
      {teaches && taught.spells > 0 ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{spellSlots("spells", taught.spells, taught.spellLevel)}</div> : null}
      {slots("armor") > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: slots("armor") }, (_, index) => (
            <Select<string>
              key={index}
              value={mine.armor[index] ?? ""}
              onChange={(picked) => set("armor", index, picked)}
              className="w-full"
              label={t("builder.feats.armorN", { feat, n: index + 1 })}
              placeholder={t("builder.feats.chooseArmor")}
              options={[
                { value: "", label: t("builder.feats.chooseArmor") },
                ...spec.armorFrom.filter(
                  (piece) => !heldArmor.has(textKey(piece)) && (mine.armor[index] === piece || !mine.armor.includes(piece)),
                ).map((piece) => ({ value: piece, label: capital(armorWords(piece)) })),
              ]}
            />
          ))}
        </div>
      ) : null}
      {slots("tools") > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: slots("tools") }, (_, index) => (
            <Select<string>
              key={index}
              value={mine.tools[index] ?? ""}
              onChange={(picked) => set("tools", index, picked)}
              className="w-full"
              label={t("builder.feats.toolN", { feat, n: index + 1 })}
              placeholder={t("builder.feats.chooseTool")}
              options={[
                { value: "", label: t("builder.feats.chooseTool") },
                ...toolsOffered.filter(
                  (tool) => !heldTools.has(textKey(tool)) && (mine.tools[index] === tool || !mine.tools.includes(tool)),
                ).map((tool) => ({ value: tool, label: capital(tool) })),
              ]}
            />
          ))}
        </div>
      ) : null}
      {fixed.length ? (
        <p className="text-sm text-stone-400" data-feat-fixed={feat}>
          {t("builder.feats.grantedOutright", { list: fixed.map(capital).join(", ") })}
        </p>
      ) : null}
      <p className="text-sm text-stone-500" data-feat-coverage={feat}>
        {coverage}
      </p>
    </div>
  );
}
