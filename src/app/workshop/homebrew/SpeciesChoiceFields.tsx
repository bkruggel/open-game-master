"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { SectionHead } from "@/components/ui/SectionHead";
import { Select } from "@/components/ui/Select";
import { SelectField, TextArea, TextField, ToggleChips } from "@/app/workshop/homebrew/fields";
import { ChipList } from "@/app/workshop/plugin/fields";
import { list, sub } from "@/app/workshop/homebrew/MechGroup";
import { ChoiceOptionList } from "@/app/workshop/homebrew/ChoiceOptionList";
import { addChip, rowIcon } from "@/app/workshop/kit";
import type { Data } from "@/app/workshop/homebrew/draft";
import { LANGUAGES, TOOL_PROFICIENCIES } from "@/lib/workshop/pickers";
import { SKILL_IDS } from "@/lib/homebrew/item-magic-schema";
import { DAMAGE_TYPES } from "@/lib/dm/damage-logic";
import { raceMechanics } from "@/lib/content/mechanics";
import { readSpeciesSpells } from "@/lib/content/species-spells";
import { SpeciesSpellFields } from "@/app/workshop/homebrew/SpeciesSpellFields";
import { hostOffers, useCapabilities } from "@/lib/use-capabilities";
import { ABILITIES, type Ability } from "@/lib/schemas/abilities";
import { useT } from "@/lib/locale";
import {
  BREATH_AREAS,
  VARIANT_LIMITS,
  variantSummary,
  type BreathShape,
  type SpeciesVariantOption,
} from "@/lib/content/species-variants";

// A species whose player picks one of several packages: a Half-Dragon's
// ancestry, a lineage, a bloodline (issue #538). Hidden behind one button
// until the author asks for it, since most species offer none. Each option
// holds only what the table runs (scores, resistances, a breath, skills,
// tools, languages, spells from issue #833) and the words its player reads;
// the save checks it whole (src/lib/content/species-variants.ts).

type Props = { data: Data; set: (patch: Data) => void };

const L = VARIANT_LIMITS;
const ABILITY_KEYS: Record<Ability, string> = {
  str: "sheet.ability.str", dex: "sheet.ability.dex", con: "sheet.ability.con", int: "sheet.ability.int", wis: "sheet.ability.wis", cha: "sheet.ability.cha",
};
const SKILL_LABELS = Object.fromEntries(SKILL_IDS.map((id) => [id, id.replace(/_/g, " ")])) as Record<(typeof SKILL_IDS)[number], string>;
const TOOLS = TOOL_PROFICIENCIES.map((tool) => tool.toLowerCase());

// An option as the draft holds it, read for its summary line.
function readOption(raw: Data): SpeciesVariantOption {
  const breath = sub(raw.breath);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    asi: sub(raw.asi) as Partial<Record<Ability, number>>,
    resistances: list(raw.resistances),
    skills: list(raw.skills),
    tools: list(raw.tools),
    languages: list(raw.languages),
    ...(readSpeciesSpells(raw.spells) ? { spells: readSpeciesSpells(raw.spells) } : {}),
    ...(breath.damageType
      ? { breath: { damageType: String(breath.damageType), save: (breath.save ?? "dex") as Ability, shape: (breath.shape ?? "cone") as BreathShape } }
      : {}),
  };
}

// A field emptied is left out, so the entry holds only what it gives.
export function withField(option: Data, key: string, value: unknown): Data {
  const next: Data = { ...option, [key]: value };
  if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) {
    delete next[key];
  }
  return next;
}

function Increases({ option, put }: { option: Data; put: (asi: Data | undefined) => void }) {
  const t = useT();
  const asi = sub(option.asi);
  const rows = Object.entries(asi).map(([ability, value]): [Ability, number] => [ability as Ability, Number(value) || 1]);
  const write = (next: Array<[Ability, number]>) => put(next.length ? Object.fromEntries(next) : undefined);
  const free = ABILITIES.filter((ability) => !(ability in asi));
  return (
    <div className="col-span-2 space-y-1.5 sm:col-span-4">
      <span className="text-[11px] text-stone-400">{t("workshop.homebrew.speciesChoice.asiTitle")}</span>
      {rows.map(([ability, value], index) => (
        // Keyed by place, not by ability: a row keyed by the ability it
        // picks remounted with the pick, and the keyboard's focus, back on
        // the picker as the menu closed, fell to the dialog instead.
        <div key={index} className="live-in flex flex-wrap items-center gap-1.5">
          <span className="w-44">
            <Select<Ability>
              value={ability}
              label={t("workshop.bestiary.spells.ability")}
              options={[ability, ...free].map((entry) => ({ value: entry, label: t(ABILITY_KEYS[entry]) }))}
              onChange={(next) => write(rows.map(([held, amount], at): [Ability, number] => [at === index ? next : held, amount]))}
            />
          </span>
          <NumberStepper
            label={t("workshop.homebrew.speciesChoice.increaseTo", { ability: t(ABILITY_KEYS[ability]) })}
            value={value}
            min={1}
            max={2}
            onChange={(amount) => write(rows.map(([held, old], at): [Ability, number] => [held, at === index ? amount : old]))}
          />
          <button
            type="button"
            aria-label={t("workshop.homebrew.speciesChoice.removeIncreaseTo", { ability: t(ABILITY_KEYS[ability]) })}
            onClick={() => write(rows.filter((_, at) => at !== index))}
            className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {rows.length < L.asiTotal && free.length ? (
        <button
          type="button"
          onClick={() => write([...rows, [free[0], 1]])}
          className={cn(ui.btnSmall, addChip)}
        >
          <Plus className="size-3" /> {t("workshop.homebrew.species.addIncrease")}
        </button>
      ) : null}
    </div>
  );
}

function OptionFields({ option, put, spells }: { option: Data; put: (next: Data) => void; spells: boolean }) {
  const t = useT();
  const field = (key: string, value: unknown) => put(withField(option, key, value));
  const optionName = String(option.name ?? "").trim() || t("workshop.homebrew.speciesChoice.thisOption");
  const breath = sub(option.breath);
  const breathType = String(breath.damageType ?? "");
  const putBreath = (patch: Data) => {
    const next = { damageType: breathType, save: breath.save ?? "dex", shape: breath.shape ?? "cone", ...patch };
    field("breath", next.damageType ? next : undefined);
  };
  return (
    <>
      <TextField
        label={t("workshop.homebrew.speciesChoice.optionName")}
        value={String(option.name ?? "")}
        onChange={(name) => put({ ...option, name })}
        maxLength={L.name}
        className="col-span-2"
      />
      <div className="col-span-2 sm:col-span-4">
        <TextArea
          label={t("workshop.homebrew.speciesChoice.whatItSays")}
          value={String(option.description ?? "")}
          onChange={(description) => field("description", description)}
          maxLength={L.description}
          rows={3}
          hint={t("workshop.homebrew.speciesChoice.whatItSaysHint")}
        />
      </div>
      <Increases option={option} put={(asi) => field("asi", asi)} />
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.speciesChoice.damageResists")}</span>
        <ToggleChips options={DAMAGE_TYPES} selected={list(option.resistances)} max={L.resistances} onChange={(next) => field("resistances", next)} />
      </div>
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.skillsProficient")}</span>
        <ToggleChips options={SKILL_IDS} labels={SKILL_LABELS} selected={list(option.skills)} max={L.skills} onChange={(next) => field("skills", next)} />
      </div>
      <div className="col-span-2 space-y-1">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.species.toolsProficient")}</span>
        <ChipList items={list(option.tools)} onChange={(next) => field("tools", next)} options={TOOLS} prompt={t("workshop.homebrew.background.addTool")} max={L.tools} />
      </div>
      <div className="col-span-2 space-y-1">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.speciesChoice.languagesSpeaks")}</span>
        <ChipList items={list(option.languages)} onChange={(next) => field("languages", next)} options={LANGUAGES} prompt={t("workshop.homebrew.background.addLanguage")} max={L.languages} />
      </div>
      <SelectField
        label={t("workshop.homebrew.speciesChoice.breathWeapon")}
        value={breathType}
        options={[{ value: "", label: t("workshop.homebrew.hazard.none") }, ...DAMAGE_TYPES.map((type) => ({ value: type, label: type }))]}
        onChange={(damageType) => putBreath({ damageType })}
        className="col-span-2"
        hint={breathType ? t("workshop.homebrew.speciesChoice.breathHint") : undefined}
      />
      {breathType ? (
        <>
          <SelectField
            label={t("workshop.bestiary.attack.save")}
            value={String(breath.save ?? "dex") as Ability}
            options={ABILITIES.map((ability) => ({ value: ability, label: t(ABILITY_KEYS[ability]) }))}
            onChange={(save) => putBreath({ save })}
          />
          <SelectField
            label={t("workshop.homebrew.speciesChoice.shape")}
            value={String(breath.shape ?? "cone") as BreathShape}
            options={(Object.keys(BREATH_AREAS) as BreathShape[]).map((shape) => ({ value: shape, label: BREATH_AREAS[shape] }))}
            onChange={(shape) => putBreath({ shape })}
          />
        </>
      ) : null}
      {/* Spells the option gives (issue #833), on a host that keeps them. */}
      {spells ? (
        <SpeciesSpellFields
          value={option.spells}
          put={(next) => field("spells", next)}
          title={t("workshop.homebrew.speciesChoice.spellTitle")}
          hint={t("workshop.homebrew.speciesChoice.spellGivesHint")}
          pickLabel={t("workshop.homebrew.speciesChoice.spellPickLabel", { name: optionName })}
        />
      ) : null}
    </>
  );
}

export function SpeciesChoiceFields({ data, set }: Props) {
  const t = useT();
  const spells = hostOffers(useCapabilities(), "speciesSpells");
  const raw = data.variants;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return (
      <div className="space-y-1.5 text-sm" data-species-choice>
        <SectionHead title={t("workshop.homebrew.speciesChoice.title")} glyph="tab-characters" className="mb-1" />
        <p className="text-[11px] text-stone-400">
          {t("workshop.homebrew.speciesChoice.blurb")}
        </p>
        <button type="button" onClick={() => set({ variants: { label: "", options: [] } })} className={cn(ui.btnSmall, addChip)}>
          <Plus className="size-3" /> {t("workshop.homebrew.speciesChoice.letChoose")}
        </button>
      </div>
    );
  }
  const group = raw as Data;
  const options = Array.isArray(group.options) ? (group.options as Data[]) : [];
  const putGroup = (patch: Data) => set({ variants: { ...group, ...patch } });
  const baseAsi = raceMechanics({ asi: data.asi }).asi;
  return (
    <div className="space-y-2 text-sm" data-species-choice>
      <SectionHead title={t("workshop.homebrew.speciesChoice.title")} glyph="tab-characters" className="mb-1" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TextField
          label={t("workshop.homebrew.speciesChoice.whatPlayerChooses")}
          value={String(group.label ?? "")}
          onChange={(label) => putGroup({ label })}
          placeholder="Draconic ancestry, Bloodline"
          maxLength={L.label}
          hint={t("workshop.homebrew.speciesChoice.whatPlayerChoosesHint")}
        />
      </div>
      {/* The option rows a subclass's choice shares (ChoiceOptionList.tsx). */}
      <ChoiceOptionList
        options={options}
        putOptions={(next) => putGroup({ options: next })}
        renderFields={(option, put) => <OptionFields option={option} spells={spells} put={put} />}
        summary={(option) => variantSummary(readOption(option))}
        attr="species"
        limits={{ options: L.options, minOptions: L.minOptions, name: L.name }}
        placeholder="Ashen"
      />
      {options.length ? (
        <div className="space-y-0.5" data-species-choice-preview>
          <span className="text-[11px] text-stone-400">{t("workshop.homebrew.speciesChoice.previewLabel")}</span>
          <ul className="space-y-0.5 text-[11px] text-stone-300">
            {options.map((option, index) => (
              <li key={String(option.id ?? "") || `at-${index}`}>
                <span className="text-amber-200/90">{String(option.name ?? "").trim() || t("workshop.homebrew.speciesChoice.optionN", { index: index + 1 })}</span>:{" "}
                {variantSummary(readOption(option), baseAsi)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" onClick={() => set({ variants: undefined })} className={cn(ui.btnSmall, addChip, "hover:text-red-300")}>
        <X className="size-3" /> {t("workshop.homebrew.speciesChoice.removeChoice")}
      </button>
    </div>
  );
}
