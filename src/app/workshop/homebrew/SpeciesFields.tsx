"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { SectionHead } from "@/components/ui/SectionHead";
import { Select } from "@/components/ui/Select";
import { NumberField, SelectField, TextArea, TextField, ToggleChips } from "@/app/workshop/homebrew/fields";
import { ChipList } from "@/app/workshop/plugin/fields";
import { MechGroup, list, num, sub } from "@/app/workshop/homebrew/MechGroup";
import { LANGUAGES, TOOL_PROFICIENCIES, VISION_SUGGESTIONS } from "@/lib/workshop/pickers";
import { SKILL_IDS } from "@/lib/homebrew/item-magic-schema";
import { SRD_WEAPONS } from "@/lib/srd/weapons";
import { addChip, rowIcon } from "@/app/workshop/kit";
import { SpeciesTraitPicker } from "@/app/workshop/homebrew/SpeciesTraitPicker";
import { SpeciesChoiceFields } from "@/app/workshop/homebrew/SpeciesChoiceFields";
import type { Data } from "@/app/workshop/homebrew/draft";
import { speciesHoldsTrait } from "@/lib/srd/race-id";
import { heldTraitNames, resistanceTrait, resistedByTraits, withTrait } from "@/lib/workshop/species-traits";
import { DAMAGE_TYPES } from "@/lib/dm/damage-logic";
import { AddFromList } from "@/components/ui/AddFromList";
import { RACE_LIMITS } from "@/lib/homebrew/race-data";
import { useT } from "@/lib/locale";

// A species: the numbers the builder reads (scores, speed, size, languages),
// the structured grants the SRD's races carry (skills, tools, weapon and
// armor training, a cantrip, the picks it leaves the player) and its traits.
// Everything here is what the builder offers and the creation check holds a
// character to (src/lib/homebrew/race-data.ts); the size, the dwarf's
// heavy-armor clause and the traits named as published are read at the
// table (src/lib/srd/race-id.ts).

type Props = { data: Data; set: (patch: Data) => void };
type AsiRow = { attributes: string[]; value: number };

const ABILITY_NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
const ABILITY_IDS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS = Object.fromEntries(ABILITY_IDS.map((id) => [id, id.toUpperCase()])) as Record<(typeof ABILITY_IDS)[number], string>;
const SKILL_LABELS = Object.fromEntries(SKILL_IDS.map((id) => [id, id.replace(/_/g, " ")])) as Record<(typeof SKILL_IDS)[number], string>;
const ARMOR = ["light", "medium", "heavy", "shields"] as const;
const CANTRIP_LISTS = ["", "bard", "cleric", "druid", "sorcerer", "warlock", "wizard"];
const TOOLS = TOOL_PROFICIENCIES.map((tool) => tool.toLowerCase());
// As the SRD's races write their training: "battleaxes", "martial weapons".
const WEAPONS = ["simple weapons", "martial weapons", ...SRD_WEAPONS.map((weapon) => `${weapon.name.toLowerCase()}s`)];

const capital = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Languages are a list; a species written before they were kept as text.
function languageList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? "")
    .split(/,|\band\b/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function AbilityIncreases({ data, set }: Props) {
  const t = useT();
  const asi = Array.isArray(data.asi) ? (data.asi as AsiRow[]) : [];
  const put = (next: AsiRow[]) => set({ asi: next });
  const choice = sub(data.asiChoice);
  const putChoice = (patch: Data) => {
    const next = { ...choice, ...patch };
    set({ asiChoice: num(next.count) > 0 ? next : undefined });
  };
  return (
    <div className="space-y-1.5 text-sm">
      <SectionHead title={t("workshop.homebrew.species.asiTitle")} glyph="ability-str" className="mb-1" />
      {asi.map((row, index) => (
        <div key={index} className="live-in flex flex-wrap items-center gap-1.5">
          <span className="w-44">
            <Select
              value={row.attributes[0] ?? "Strength"}
              label={t("workshop.bestiary.spells.ability")}
              options={ABILITY_NAMES.map((name) => ({
                value: name as string,
                label: name,
                icon: { kind: "glyph" as const, key: `ability-${name.slice(0, 3).toLowerCase()}` },
              }))}
              onChange={(name) => put(asi.map((entry, at) => (at === index ? { ...entry, attributes: [name] } : entry)))}
            />
          </span>
          <NumberStepper label={t("workshop.homebrew.species.increase")} value={row.value} min={-2} max={3} onChange={(value) => put(asi.map((entry, at) => (at === index ? { ...entry, value } : entry)))} />
          <button type="button" aria-label={t("workshop.homebrew.species.removeIncrease")} onClick={() => put(asi.filter((_, at) => at !== index))} className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {asi.length < 6 ? (
        <button type="button" onClick={() => put([...asi, { attributes: ["Dexterity"], value: 1 }])} className={cn(ui.btnSmall, addChip)}>
          <Plus className="size-3" /> {t("workshop.homebrew.species.addIncrease")}
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-400">
        <span>{t("workshop.homebrew.background.andPlayerPicks")}</span>
        <NumberStepper size="sm" label={t("workshop.homebrew.species.abilitiesPicked")} value={num(choice.count)} min={0} max={3} onChange={(count) => putChoice({ count })} />
        <span>{t("workshop.homebrew.species.abilitiesToRaise")}</span>
        <NumberStepper size="sm" label={t("workshop.homebrew.species.raisedBy")} value={num(choice.amount, 1)} min={1} max={2} onChange={(amount) => putChoice({ amount })} />
      </div>
      {num(choice.count) > 0 ? (
        <div className="live-in space-y-1">
          <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.fromNoneTicked")}</span>
          <ToggleChips options={ABILITY_IDS} labels={ABILITY_LABELS} selected={list(choice.from)} onChange={(from) => putChoice({ from: from.length ? from : undefined })} />
        </div>
      ) : null}
    </div>
  );
}

function Languages({ data, set }: Props) {
  const t = useT();
  const known = languageList(data.languages);
  const choice = sub(data.languageChoice);
  const from = list(choice.from);
  const putChoice = (patch: Data) => {
    const next = { count: num(choice.count, 1), from, ...patch };
    set({ languageChoice: list(next.from).length ? next : undefined });
  };
  return (
    <div className="space-y-1.5 text-sm">
      <SectionHead title={t("workshop.bestiary.stats.languages")} glyph="system-lore" className="mb-1" />
      <ChipList items={known} onChange={(languages) => set({ languages })} options={LANGUAGES} prompt={t("workshop.homebrew.background.addLanguage")} max={12} />
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
        <span>{t("workshop.homebrew.background.plus")}</span>
        <NumberStepper size="sm" label={t("workshop.homebrew.background.languagesOfChoice")} value={num(data.bonusLanguages)} min={0} max={4} onChange={(bonusLanguages) => set({ bonusLanguages: bonusLanguages || undefined })} />
        <span>{t("workshop.homebrew.background.ofChoice")}</span>
      </div>
      <div className="space-y-1">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.orShortList")}</span>
        <ChipList items={from} onChange={(next) => putChoice({ from: next })} options={LANGUAGES} prompt={t("workshop.homebrew.species.offerLanguage")} max={12} />
        {from.length ? (
          <span className="live-in flex items-center gap-2 text-[11px] text-stone-400">
            {t("workshop.homebrew.species.playerPicks")}
            <NumberStepper size="sm" label={t("workshop.homebrew.species.languagesFromList")} value={num(choice.count, 1)} min={1} max={3} onChange={(count) => putChoice({ count })} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Training({ data, set }: Props) {
  const t = useT();
  const skills = list(data.skills);
  const tools = list(data.tools);
  const toolChoice = sub(data.toolChoice);
  const toolFrom = list(toolChoice.from);
  const armor = list(data.armor);
  const weapons = list(data.weapons);
  const cantrip = sub(data.cantripChoice);
  const skillChoice = sub(data.skillChoice);
  const skillFrom = list(skillChoice.from);
  const putSkillChoice = (patch: Data) => {
    const next = { count: num(skillChoice.count), from: skillFrom, ...patch };
    set({ skillChoice: next.count ? { count: next.count, ...(list(next.from).length ? { from: next.from } : {}) } : undefined });
  };
  const summary = [
    skills.length ? skills.join(", ").replace(/_/g, " ") : "",
    num(sub(data.skillChoice).count) ? t("workshop.homebrew.species.skillsOfChoice", { count: num(sub(data.skillChoice).count) }) : "",
    tools.length ? tools.join(", ") : "",
    armor.length ? t("workshop.homebrew.species.armorSummary", { list: armor.join(", ") }) : "",
    weapons.length ? t("workshop.homebrew.species.weaponsSummary", { count: weapons.length }) : "",
    cantrip.list ? t("workshop.homebrew.species.cantripSummary", { list: String(cantrip.list) }) : "",
  ].filter(Boolean).join("; ");
  const open = summary.length > 0;
  const putToolChoice = (patch: Data) => {
    const next = { count: num(toolChoice.count, 1), from: toolFrom, ...patch };
    set({ toolChoice: list(next.from).length ? next : undefined });
  };
  return (
    <MechGroup title={t("workshop.homebrew.species.whatTrains")} summary={summary || t("workshop.homebrew.hazard.nothing")} open={open}>
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.skillsProficient")}</span>
        <ToggleChips options={SKILL_IDS} labels={SKILL_LABELS} selected={skills} max={RACE_LIMITS.skills} onChange={(next) => set({ skills: next.length ? next : undefined })} />
      </div>
      <NumberField
        label={t("workshop.homebrew.species.skillsPlayerChoice")}
        value={num(skillChoice.count)}
        min={0}
        max={4}
        onChange={(count) => putSkillChoice({ count })}
      />
      {num(skillChoice.count) ? (
        <div className="live-in col-span-2 space-y-1 sm:col-span-4">
          <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.pickedFromNone")}</span>
          <ToggleChips options={SKILL_IDS} labels={SKILL_LABELS} selected={skillFrom} onChange={(from) => putSkillChoice({ from })} />
        </div>
      ) : null}
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.toolsProficient")}</span>
        <ChipList items={tools} onChange={(next) => set({ tools: next.length ? next : undefined })} options={TOOLS} prompt={t("workshop.homebrew.background.addTool")} max={6} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.orOneTool")}</span>
        <ChipList items={toolFrom} onChange={(from) => putToolChoice({ from })} options={TOOLS} prompt={t("workshop.homebrew.species.offerTool")} max={12} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.class.armorTraining")}</span>
        <ToggleChips options={ARMOR} selected={armor} onChange={(next) => set({ armor: next.length ? next : undefined })} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.class.weaponTraining")}</span>
        <ChipList items={weapons} onChange={(next) => set({ weapons: next.length ? next : undefined })} options={WEAPONS} prompt={t("workshop.homebrew.class.addWeapon")} max={12} />
      </div>
      <SelectField
        label={t("workshop.homebrew.species.cantripFrom")}
        value={String(cantrip.list ?? "")}
        options={CANTRIP_LISTS.map((value) => ({ value, label: value ? t("workshop.homebrew.species.listWord", { list: value }) : t("workshop.homebrew.species.noList") }))}
        onChange={(value) => set({ cantripChoice: value ? { list: value, count: num(cantrip.count, 1) } : undefined })}
      />
      {cantrip.list ? (
        <NumberField label={t("workshop.homebrew.species.cantrips")} value={num(cantrip.count, 1)} min={1} max={3} onChange={(count) => set({ cantripChoice: { list: cantrip.list, count: count || 1 } })} />
      ) : null}
    </MechGroup>
  );
}

export function SpeciesFields({ data, set }: Props) {
  const t = useT();
  const speed = (data.speed as { walk?: number } | undefined)?.walk ?? 30;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField
          label={t("workshop.homebrew.copy.fieldSize")}
          value={capital(String(data.size ?? "Medium").toLowerCase())}
          options={["Tiny", "Small", "Medium", "Large"].map((value) => ({ value, label: value }))}
          onChange={(size) => set({ size })}
          hint={t("workshop.homebrew.species.sizeHint")}
        />
        <NumberField label={t("workshop.homebrew.species.speedFt")} value={speed} min={5} max={120} step={5} onChange={(walk) => set({ speed: { walk: walk === "" ? 30 : walk } })} />
        <TextField
          label={t("workshop.homebrew.species.vision")}
          value={String(data.vision ?? "")}
          onChange={(vision) => set({ vision })}
          placeholder="Darkvision 60 ft"
          maxLength={120}
          suggestions={VISION_SUGGESTIONS}
        />
        <label className="flex items-center gap-2 self-end pb-2 text-xs text-stone-300 pointer-coarse:min-h-10">
          <input
            type="checkbox"
            checked={data.heavyArmorSpeed === true}
            onChange={(event) => set({ heavyArmorSpeed: event.target.checked || undefined })}
            className="accent-amber-500"
          />
          {t("workshop.homebrew.species.heavyArmorNeverSlows")}
        </label>
      </div>
      <AbilityIncreases data={data} set={set} />
      <Languages data={data} set={set} />
      <Training data={data} set={set} />
      <SpeciesChoiceFields data={data} set={set} />
      <div className="space-y-1.5">
        <SpeciesTraitPicker traits={String(data.traits ?? "")} onChange={(traits) => set({ traits })} />
        <TextArea
          label={t("workshop.homebrew.species.traitsLabel")}
          value={String(data.traits ?? "")}
          onChange={(traits) => set({ traits })}
          placeholder={"**_Marsh Stride._** Difficult terrain in wetlands costs you no extra movement.\n\n**_Reed Sight._** You have advantage on Perception checks in tall grass."}
          rows={6}
          maxLength={6000}
          hint={t("workshop.homebrew.species.traitsHint")}
        />
        <TraitsRead traits={String(data.traits ?? "")} />
        <Resistances traits={String(data.traits ?? "")} onChange={(traits) => set({ traits })} />
        <DraconicNote traits={String(data.traits ?? "")} choice={Boolean(data.variants)} />
      </div>
    </div>
  );
}

// The traits the table reads off the text, as the builder and the server
// read them (src/lib/content/mechanics.ts traitHeading), so a paragraph
// written another way is seen to be missing here as well as in the findings.
function TraitsRead({ traits }: { traits: string }) {
  const t = useT();
  const names = heldTraitNames(traits);
  return (
    <p data-species-traits className="text-[11px] text-stone-400">
      {names.length ? t("workshop.homebrew.species.traitsRead", { list: names.join(", ") }) : t("workshop.homebrew.species.traitsReadNone")}
    </p>
  );
}

// The damage the species resists at the table, and a pick for another. The
// damage engine reads a resistance from a trait's name ("Fire Resistance"),
// so a pick writes the trait that way, where it stays editable.
function Resistances({ traits, onChange }: { traits: string; onChange: (traits: string) => void }) {
  const t = useT();
  const resisted = resistedByTraits(traits);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400" data-species-resists>
      <span>{resisted.length ? t("workshop.homebrew.species.resistsLine", { list: resisted.join(", ") }) : t("workshop.homebrew.species.resistsNone")}</span>
      <AddFromList
        prompt={t("workshop.homebrew.species.addResistance")}
        options={DAMAGE_TYPES.filter((type) => !resisted.includes(type))}
        onPick={(type) => onChange(withTrait(traits, resistanceTrait(type)))}
      />
    </div>
  );
}

// A species with the Dragonborn's ancestry (a Half-Dragon, say): what the
// player will be asked, and the breath that goes with it. A breath with no
// ancestry has no damage type of its own. A species with a player's choice
// of its own says what its options breathe in the findings instead.
function DraconicNote({ traits, choice }: { traits: string; choice: boolean }) {
  const t = useT();
  const rules = { traitNames: heldTraitNames(traits) };
  const ancestry = speciesHoldsTrait(rules, "draconic ancestry");
  const breath = speciesHoldsTrait(rules, "breath weapon");
  if (choice || (!ancestry && !breath)) return null;
  return (
    <p className="live-in text-[11px] text-stone-400" data-draconic-note>
      {ancestry && breath
        ? t("workshop.homebrew.species.draconicBoth")
        : ancestry
          ? t("workshop.homebrew.species.draconicAncestryOnly")
          : t("workshop.homebrew.species.draconicBreathOnly")}
    </p>
  );
}
