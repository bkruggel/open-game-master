"use client";

import { Plus, X } from "lucide-react";
import {
  ARMOR_CATEGORIES,
  EFFECT_KINDS,
  GEAR_LIMITS,
  ITEM_KINDS,
  RARITIES,
  WEAPON_CATEGORIES,
  WEAPON_PROPERTIES,
  describeEffect,
  type ItemKind,
} from "@/lib/homebrew/gear";
import { SRD_ARMOR } from "@/lib/srd/armor";
import { ITEM_TAGS, type ItemTag } from "@/lib/schemas/item-tags";
import { SRD_WEAPONS } from "@/lib/srd/weapons";
import type { MagicItemEffect } from "@/lib/srd/magic-items";
import { WORN_PLACES, WORN_PLACE_BLURBS, WORN_PLACE_LABELS, isWornPlace } from "@/lib/srd/worn-places";
import {
  CheckField,
  Field,
  NumberField,
  SelectField,
  TextField,
  ToggleChips,
} from "@/app/workshop/homebrew/fields";
import { DAMAGE_TYPES } from "@/app/workshop/homebrew/types";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { SectionHead } from "@/components/ui/SectionHead";
import { Select } from "@/components/ui/Select";
import { FieldLabel, addChip, rowIcon } from "@/app/workshop/kit";
import type { Data } from "@/app/workshop/homebrew/draft";
import {
  ArmorRidersBlock,
  AttunementBlock,
  ChargesBlock,
  ChecksBlock,
  ItemSpellsBlock,
  WeaponRidersBlock,
} from "@/app/workshop/homebrew/ItemMagicFields";
import { DAMAGE_TYPE_BLURBS, WEAPON_PROPERTY_BLURBS, glossaryFor } from "@/lib/help/terms";
import { useT } from "@/lib/locale";

// "1d8 slashing" as the two things a DM actually decides. A type the list
// does not know (a homebrew "1d6 chitin-shredding") stays in the dice box
// so nothing typed is ever lost.
function splitDamage(damage: string): { dice: string; type: string } {
  const trimmed = damage.trim();
  const match = /^(.*?)\s+([a-z]+)$/i.exec(trimmed);
  if (match && (DAMAGE_TYPES as readonly string[]).includes(match[2].toLowerCase())) {
    return { dice: match[1].trim(), type: match[2].toLowerCase() };
  }
  return { dice: trimmed, type: "" };
}

function joinDamage(dice: string, type: string): string {
  return [dice.trim(), type.trim()].filter(Boolean).join(" ");
}

// The item form: what kind of thing it is, then the block that kind carries.
// A weapon's block is an SRD weapon; an armour's an SRD armour; a magic
// item's the effects magic-items.json speaks. The "start from" rows offer
// the SRD tables themselves, because a +1 longsword is a longsword first.

// Each tag in words (src/lib/srd/item-tags.ts).
const TAG_LABELS: Partial<Record<ItemTag, string>> = Object.fromEntries(ITEM_TAGS.map((tag) => [tag, tag.replace(/_/g, " ")]));

const KIND_LABELS: Record<ItemKind, string> = {
  weapon: "workshop.homebrew.item.kindWeapon",
  armor: "workshop.homebrew.item.kindArmor",
  gear: "workshop.homebrew.item.kindGear",
  magic_item: "workshop.homebrew.item.kindMagicItem",
};

type Weapon = Record<string, unknown>;
type Armor = Record<string, unknown>;

function num(value: unknown): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function WeaponBlock({ weapon, onChange }: { weapon: Weapon; onChange: (next: Weapon) => void }) {
  const t = useT();
  const set = (patch: Weapon) => onChange({ ...weapon, ...patch });
  const properties = Array.isArray(weapon.properties) ? (weapon.properties as string[]) : [];
  return (
    <div className="panel space-y-2 rounded-xl p-3">
      <SectionHead
        title={t("workshop.homebrew.item.weaponTitle")}
        glyph="tab-battle"
        className="mb-1"
      />
      <div className="max-w-sm">
        <Select
          value=""
          label={t("workshop.homebrew.item.startWeapon")}
          placeholder={t("workshop.homebrew.item.startWeaponPlaceholder")}
          options={SRD_WEAPONS.map((entry) => ({
            value: entry.name,
            label: entry.name,
            hint: entry.damage,
            icon: { kind: "item" as const, key: entry.name, family: "item-weapon" },
          }))}
          onChange={(name) => {
            const srd = SRD_WEAPONS.find((entry) => entry.name === name);
            if (srd) {
              onChange({
                category: srd.category,
                kind: srd.kind,
                damage: srd.damage,
                properties: srd.properties ?? [],
                ...(srd.rangeFt ? { rangeFt: srd.rangeFt } : {}),
              });
            }
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField
          label="Category"
          value={String(weapon.category ?? "simple")}
          options={WEAPON_CATEGORIES.map((value) => ({ value, label: value }))}
          onChange={(category) => set({ category })}
        />
        <SelectField
          label={t("workshop.bestiary.attack.reach")}
          value={String(weapon.kind ?? "melee")}
          options={[
            { value: "melee", label: t("workshop.homebrew.item.meleeLabel") },
            { value: "ranged", label: t("workshop.homebrew.item.rangedLabel") },
          ]}
          onChange={(kind) => set({ kind })}
        />
        {/* Stored as one string ("1d8 slashing") because that is what the
            weapon engine reads; edited as dice plus a type picked from the
            list the monster editor already offers, so nobody has to spell a
            damage type from memory. */}
        <TextField
          label={t("workshop.homebrew.hazard.damageDice")}
          value={splitDamage(String(weapon.damage ?? "")).dice}
          onChange={(dice) =>
            set({ damage: joinDamage(dice, splitDamage(String(weapon.damage ?? "")).type) })
          }
          placeholder="1d8"
          maxLength={20}
        />
        <SelectField
          label={t("workshop.homebrew.hazard.damageType")}
          value={splitDamage(String(weapon.damage ?? "")).type}
          options={[
            { value: "", label: t("workshop.homebrew.item.pickType") },
            ...DAMAGE_TYPES.map((value) => ({ value, label: value })),
          ]}
          onChange={(type) => set({ damage: joinDamage(splitDamage(String(weapon.damage ?? "")).dice, type) })}
          hint={t("workshop.homebrew.item.damageTypeHint")}
          glossary={{ title: t("workshop.homebrew.item.damageTypesTitle"), entries: glossaryFor(DAMAGE_TYPES, DAMAGE_TYPE_BLURBS) }}
        />
        <NumberField
          label={t("workshop.homebrew.item.rangeFt")}
          value={num(weapon.rangeFt)}
          min={0}
          max={600}
          onChange={(rangeFt) => set({ rangeFt: rangeFt === "" ? undefined : rangeFt })}
        />
      </div>
      <Field
        label={t("workshop.homebrew.item.properties")}
        glossary={{ title: t("workshop.homebrew.item.propertiesTitle"), entries: glossaryFor(WEAPON_PROPERTIES, WEAPON_PROPERTY_BLURBS) }}
      >
        <ToggleChips
          options={WEAPON_PROPERTIES}
          selected={properties}
          onChange={(next) => set({ properties: next })}
        />
      </Field>
    </div>
  );
}

function ArmorBlock({ armor, onChange }: { armor: Armor; onChange: (next: Armor) => void }) {
  const t = useT();
  const set = (patch: Armor) => onChange({ ...armor, ...patch });
  const category = String(armor.category ?? "light");
  return (
    <div className="panel space-y-2 rounded-xl p-3">
      <SectionHead title={t("workshop.homebrew.item.armorTitle")} glyph="rest-ac" className="mb-1" />
      <div className="max-w-sm">
        <Select
          value=""
          label={t("workshop.homebrew.item.startArmor")}
          placeholder={t("workshop.homebrew.item.startArmorPlaceholder")}
          options={SRD_ARMOR.map((entry) => ({
            value: entry.name,
            label: entry.name,
            hint: t("workshop.bestiary.rows.acLine", { ac: entry.baseAc }),
            icon: { kind: "item" as const, key: entry.name, family: "item-armor" },
          }))}
          onChange={(name) => {
            const srd = SRD_ARMOR.find((entry) => entry.name === name);
            if (srd) {
              onChange({
                category: srd.category,
                baseAc: srd.baseAc,
                ...(srd.dexCap !== undefined ? { dexCap: srd.dexCap } : {}),
                ...(srd.strengthRequirement ? { strengthRequirement: srd.strengthRequirement } : {}),
                stealthDisadvantage: Boolean(srd.stealthDisadvantage),
                weightLb: srd.weightLb,
              });
            }
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField
          label="Category"
          value={category}
          options={ARMOR_CATEGORIES.map((value) => ({ value, label: value }))}
          onChange={(next) => set({ category: next })}
        />
        <NumberField
          label={category === "shield" ? t("workshop.homebrew.item.addsToAc") : t("workshop.homebrew.item.baseAc")}
          value={num(armor.baseAc)}
          min={category === "shield" ? 1 : GEAR_LIMITS.acMin}
          max={category === "shield" ? GEAR_LIMITS.shieldMax : GEAR_LIMITS.acMax}
          onChange={(baseAc) => set({ baseAc: baseAc === "" ? undefined : baseAc })}
        />
        {category === "medium" ? (
          <NumberField
            label={t("workshop.homebrew.item.dexCap")}
            value={num(armor.dexCap) === "" ? 2 : num(armor.dexCap)}
            min={0}
            max={5}
            onChange={(dexCap) => set({ dexCap: dexCap === "" ? 2 : dexCap })}
            hint={t("workshop.homebrew.item.dexCapHint")}
          />
        ) : null}
        {category === "heavy" || category === "medium" ? (
          <NumberField
            label={t("workshop.homebrew.item.strengthNeeded")}
            value={num(armor.strengthRequirement)}
            min={0}
            max={30}
            onChange={(strengthRequirement) =>
              set({ strengthRequirement: strengthRequirement === "" ? undefined : strengthRequirement })
            }
          />
        ) : null}
        <NumberField
          label={t("workshop.homebrew.item.weightLb")}
          value={num(armor.weightLb)}
          min={0}
          max={500}
          onChange={(weightLb) => set({ weightLb: weightLb === "" ? 0 : weightLb })}
        />
      </div>
      {category !== "shield" ? (
        <CheckField
          label={t("workshop.homebrew.item.stealthDisadvantage")}
          checked={armor.stealthDisadvantage === true}
          onChange={(stealthDisadvantage) => set({ stealthDisadvantage })}
        />
      ) : null}
    </div>
  );
}

const EFFECT_LABELS: Record<(typeof EFFECT_KINDS)[number], string> = {
  ac_bonus: "workshop.homebrew.item.effectAcBonus",
  ac_unarmored: "workshop.homebrew.item.effectAcUnarmored",
  save_bonus: "workshop.homebrew.item.effectSaveBonus",
  set_ability: "workshop.homebrew.item.effectSetAbility",
  resistance: "workshop.homebrew.item.effectResistance",
};

function EffectsBlock({
  effects,
  onChange,
}: {
  effects: MagicItemEffect[];
  onChange: (next: MagicItemEffect[]) => void;
}) {
  const t = useT();
  const update = (index: number, next: MagicItemEffect) =>
    onChange(effects.map((effect, at) => (at === index ? next : effect)));
  return (
    <div className="space-y-1.5 text-sm">
      <SectionHead title={t("workshop.homebrew.item.standingEffects")} glyph="cue-arcane" className="mb-1" />
      <FieldLabel>{t("workshop.homebrew.item.engineApplies")}</FieldLabel>
      {effects.map((effect, index) => (
        <div key={index} className="flex flex-wrap items-center gap-1.5">
          <span className="w-56">
          <Select<(typeof EFFECT_KINDS)[number]>
            value={effect.kind}
            label={t("workshop.homebrew.item.effectKind")}
            options={EFFECT_KINDS.map((kind) => ({ value: kind, label: t(EFFECT_LABELS[kind]) }))}
            onChange={(kind) => {
              update(
                index,
                kind === "set_ability"
                  ? { kind, ability: "str", score: 19 }
                  : kind === "resistance"
                    ? { kind, types: ["fire"] }
                    : { kind, amount: 1 },
              );
            }}
          />
          </span>
          {"amount" in effect ? (
            <NumberStepper
              label={t("workshop.homebrew.item.amount")}
              value={effect.amount}
              min={-GEAR_LIMITS.bonusMax}
              max={GEAR_LIMITS.bonusMax}
              onChange={(amount) => update(index, { ...effect, amount })}
            />
          ) : null}
          {effect.kind === "set_ability" ? (
            <>
              <span className="w-32">
                <Select
                  value={effect.ability}
                  label={t("workshop.bestiary.spells.ability")}
                  options={(["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => ({
                    value: ability,
                    label: ability.toUpperCase(),
                    icon: { kind: "glyph" as const, key: `ability-${ability}` },
                  }))}
                  onChange={(ability) => update(index, { ...effect, ability })}
                />
              </span>
              <NumberStepper label={t("workshop.homebrew.item.score")} value={effect.score} min={3} max={30} onChange={(score) => update(index, { ...effect, score })} />
            </>
          ) : null}
          {effect.kind === "resistance" ? (
            <ToggleChips
              options={DAMAGE_TYPES}
              selected={effect.types}
              onChange={(types) => update(index, { ...effect, types })}
            />
          ) : null}
          <span className="text-[11px] text-stone-500">{describeEffect(effect)}</span>
          <button
            type="button"
            aria-label={t("workshop.homebrew.item.removeEffect")}
            onClick={() => onChange(effects.filter((_, at) => at !== index))}
            className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {effects.length < GEAR_LIMITS.effectsMax ? (
        <button
          type="button"
          onClick={() => onChange([...effects, { kind: "ac_bonus", amount: 1 }])}
          className={cn(ui.btnSmall, addChip, "text-xs")}
        >
          <Plus className="size-3" /> {t("workshop.homebrew.item.addEffect")}
        </button>
      ) : null}
    </div>
  );
}

export function ItemFields({ data, onChange }: { data: Data; onChange: (next: Data) => void }) {
  const t = useT();
  const set = (patch: Data) => onChange({ ...data, ...patch });
  const itemKind = ITEM_KINDS.includes(data.itemKind as ItemKind) ? (data.itemKind as ItemKind) : "gear";
  const weapon = (data.weapon ?? {}) as Weapon;
  const armor = (data.armor ?? {}) as Armor;
  const effects = Array.isArray(data.effects) ? (data.effects as MagicItemEffect[]) : [];

  return (
    <div className="space-y-3">
      <SectionHead title={t("workshop.bestiary.editor.whatItIs")} glyph="tab-loot" className="mb-1" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SelectField
          label={t("workshop.bestiary.attack.kind")}
          value={itemKind}
          options={ITEM_KINDS.map((value) => ({ value, label: t(KIND_LABELS[value]) }))}
          onChange={(next) => set({ itemKind: next })}
        />
        <SelectField
          label={t("workshop.homebrew.item.rarity")}
          value={String(data.rarity ?? "")}
          options={[{ value: "", label: t("workshop.homebrew.item.mundane") }, ...RARITIES.map((value) => ({ value, label: value }))]}
          onChange={(rarity) => set({ rarity })}
        />
        <TextField label={t("workshop.homebrew.item.cost")} value={String(data.cost ?? "")} onChange={(cost) => set({ cost })} placeholder="15 gp" maxLength={40} />
        <NumberField
          label={t("workshop.homebrew.item.weightLb")}
          value={num(data.weight)}
          min={0}
          max={GEAR_LIMITS.weightMax}
          step={0.5}
          onChange={(weight) => set({ weight: weight === "" ? undefined : weight })}
        />
        {/* Where it is worn, so a homebrew cloak keeps the one-cloak rule
            with the published ones (src/lib/srd/wear-slots.ts). A weapon
            is held, and armour places itself. */}
        {(itemKind === "gear" || itemKind === "magic_item") && !data.armor && !data.weapon ? (
          <SelectField
            label={t("workshop.homebrew.item.wornOn")}
            value={isWornPlace(data.wornOn) ? data.wornOn : ""}
            options={[
              { value: "", label: t("workshop.homebrew.item.notWorn") },
              ...WORN_PLACES.map((value) => ({ value, label: WORN_PLACE_LABELS[value] })),
            ]}
            onChange={(wornOn) => set({ wornOn: wornOn || undefined })}
            hint={t("workshop.homebrew.item.wornHint")}
            glossary={{
              title: t("workshop.homebrew.item.placesTitle"),
              entries: WORN_PLACES.map((value) => ({ name: WORN_PLACE_LABELS[value], blurb: WORN_PLACE_BLURBS[value] })),
            }}
            className="col-span-2"
          />
        ) : null}
      </div>
      <Field
        label={t("workshop.homebrew.item.tableReadsAs")}
        hint={t("workshop.homebrew.item.tableReadsHint")}
      >
        <ToggleChips
          options={ITEM_TAGS}
          selected={Array.isArray(data.tags) ? (data.tags as string[]) : []}
          onChange={(next) => set({ tags: next.length ? next : undefined })}
          labels={TAG_LABELS}
        />
      </Field>

      {itemKind === "weapon" ? <WeaponBlock weapon={weapon} onChange={(next) => set({ weapon: next })} /> : null}
      {itemKind === "armor" ? <ArmorBlock armor={armor} onChange={(next) => set({ armor: next })} /> : null}

      {itemKind === "magic_item" ? (
        <div className="panel reveal space-y-3 rounded-xl p-3">
          <SectionHead title={t("workshop.homebrew.item.magicTitle")} glyph="cue-wonder" className="mb-1" />
          <div className="flex flex-wrap items-center gap-3">
            <CheckField
              label={t("workshop.homebrew.item.requiresAttunement")}
              checked={data.requiresAttunement === true}
              onChange={(requiresAttunement) => set({ requiresAttunement })}
            />
          </div>
          <EffectsBlock effects={effects} onChange={(next) => set({ effects: next })} />
          <div className="flex flex-wrap gap-3">
            <CheckField
              label={t("workshop.homebrew.item.alsoWeapon")}
              checked={Boolean(data.weapon)}
              onChange={(on) => set({ weapon: on ? { category: "martial", kind: "melee", damage: "1d8 slashing" } : undefined })}
            />
            <CheckField
              label={t("workshop.homebrew.item.alsoArmor")}
              checked={Boolean(data.armor)}
              onChange={(on) => set({ armor: on ? { category: "light", baseAc: 12 } : undefined })}
            />
          </div>
          {data.weapon ? <WeaponBlock weapon={weapon} onChange={(next) => set({ weapon: next })} /> : null}
          {data.weapon ? <WeaponRidersBlock data={data} set={set} /> : null}
          {data.armor ? <ArmorBlock armor={armor} onChange={(next) => set({ armor: next })} /> : null}
          {data.armor ? <ArmorRidersBlock data={data} set={set} /> : null}
          <ChargesBlock data={data} set={set} />
          <ItemSpellsBlock data={data} set={set} />
          <ChecksBlock data={data} set={set} />
          <AttunementBlock data={data} set={set} />
          <SentienceBlock data={data} set={set} />
        </div>
      ) : null}
    </div>
  );
}

// A sentient item's mind (SRD 5.1, Sentient Magic Items): an NPC the DM
// runs, carried onto the holder's sheet and shown to the DM with the rule
// for a conflict (src/lib/homebrew/sentience.ts).
function SentienceBlock({ data, set }: { data: Data; set: (patch: Data) => void }) {
  const t = useT();
  const mind = (data.sentience ?? null) as Record<string, unknown> | null;
  const put = (patch: Record<string, unknown>) => set({ sentience: { ...(mind ?? {}), ...patch } });
  return (
    <div className="space-y-2">
      <CheckField
        label={t("workshop.homebrew.item.sentient")}
        checked={Boolean(mind)}
        onChange={(on) => set({ sentience: on ? { int: 10, wis: 10, cha: 10, communication: "emotion", senses: "hearing and normal vision out to 30 feet" } : undefined })}
      />
      {mind ? (
        <div className="reveal grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["int", "wis", "cha"] as const).map((ability) => (
            <NumberField
              key={ability}
              label={t(ability === "int" ? "sheet.ability.int" : ability === "wis" ? "sheet.ability.wis" : "sheet.ability.cha")}
              value={typeof mind[ability] === "number" ? (mind[ability] as number) : 10}
              min={1}
              max={30}
              onChange={(value) => put({ [ability]: value === "" ? 10 : value })}
            />
          ))}
          <SelectField
            label={t("workshop.homebrew.item.communicatesBy")}
            value={String(mind.communication ?? "emotion")}
            options={[
              { value: "emotion", label: "emotion" },
              { value: "speech", label: "speech" },
              { value: "telepathy", label: "telepathy" },
            ]}
            onChange={(communication) => put({ communication })}
          />
          <TextField label={t("workshop.bestiary.stats.alignment")} value={String(mind.alignment ?? "")} onChange={(alignment) => put({ alignment })} maxLength={40} />
          <TextField label={t("workshop.homebrew.item.senses")} value={String(mind.senses ?? "")} onChange={(senses) => put({ senses })} maxLength={120} className="sm:col-span-3" />
          <TextField label={t("workshop.homebrew.item.specialPurpose")} value={String(mind.purpose ?? "")} onChange={(purpose) => put({ purpose })} maxLength={200} className="col-span-2 sm:col-span-4" placeholder="Slay every dragon it meets" />
          <TextField label={t("workshop.homebrew.item.personality")} value={String(mind.personality ?? "")} onChange={(personality) => put({ personality })} maxLength={400} className="col-span-2 sm:col-span-4" />
        </div>
      ) : null}
    </div>
  );
}
