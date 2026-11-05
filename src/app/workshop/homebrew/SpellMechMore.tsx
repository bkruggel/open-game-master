"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { CONDITIONS } from "@/lib/bestiary/kit";
import { CREATURE_TYPES } from "@/lib/bestiary/creature-type";
import { checkSpellMech } from "@/lib/homebrew/spell-mech-schema";
import { CheckField, NumberField, SelectField, TextField, ToggleChips } from "@/app/workshop/homebrew/fields";
import { DAMAGE_TYPES } from "@/app/workshop/homebrew/types";
import { ABILITY_OPTIONS, MechGroup, clean, list, num, sub, type Mech, type MechProps } from "@/app/workshop/homebrew/MechGroup";
import { useT } from "@/lib/locale";

// The rarer groups of a spell's block: what a failed save does besides
// damage, a buff's numbers, healing and revival, an aura, a hit point pool,
// and the whole block as text for whatever the form has no field for.

const CREATURE_WORDS = CREATURE_TYPES.map((type) => type as string);
const BUFF_WORDS = ["blessed", "hasted", "shielded", "invisible", "inspired", "aided", "heroic", "warded"];

export function RidersGroup({ mech, setMech }: MechProps) {
  const t = useT();
  const riders = sub(mech.riders);
  const set = (patch: Mech) => setMech({ riders: clean({ ...riders, ...patch }) });
  const summary = [
    riders.pushFeet ? t("workshop.homebrew.spellMore.pushedSummary", { feet: num(riders.pushFeet) as number }) : "",
    riders.losesAction ? t("workshop.homebrew.spellMore.losesAction") : "",
    riders.disintegrates ? t("workshop.homebrew.spellMore.disintegrates") : "",
    riders.concentrationSave ? t("workshop.homebrew.spellMore.concentrationSave") : "",
    riders.hpFloor !== undefined ? t("workshop.homebrew.spellMore.cannotKill") : "",
    riders.damageIgnoresSave ? t("workshop.homebrew.spellMore.damageWhateverSave") : "",
  ].filter(Boolean).join(", ");
  return (
    <MechGroup title={t("workshop.homebrew.spellMore.failedSaveAlso")} summary={summary || t("workshop.homebrew.spellMore.nothingMore")} open={Object.keys(riders).length > 0}>
      <NumberField label={t("workshop.homebrew.spellMore.pushedFeet")} value={riders.pushFeet === undefined ? "" : num(riders.pushFeet)} min={0} max={120} step={5} onChange={(pushFeet) => set({ pushFeet: pushFeet === "" ? undefined : pushFeet })} />
      <NumberField label={t("workshop.homebrew.spellMore.hpFloor")} value={riders.hpFloor === undefined ? "" : num(riders.hpFloor)} min={0} max={1000} onChange={(hpFloor) => set({ hpFloor: hpFloor === "" ? undefined : hpFloor })} hint={t("workshop.homebrew.spellMore.harmHint")} />
      <div className="col-span-2 flex flex-wrap items-end gap-3 pb-1">
        <CheckField label={t("workshop.homebrew.spellMore.losesNextAction")} checked={riders.losesAction === true} onChange={(on) => set({ losesAction: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.shrinksMaxHp")} checked={riders.shrinksMaxHp === true} onChange={(on) => set({ shrinksMaxHp: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.concentrationSave")} checked={riders.concentrationSave === "con"} onChange={(on) => set({ concentrationSave: on ? "con" : undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.disintegratesAt0")} checked={riders.disintegrates === true} onChange={(on) => set({ disintegrates: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.advantageInFight")} checked={riders.advantageInFight === true} onChange={(on) => set({ advantageInFight: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.damageLandsWhatever")} checked={riders.damageIgnoresSave === true} onChange={(on) => set({ damageIgnoresSave: on || undefined })} />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.spellMore.saveDisadvantage")}</span>
        <ToggleChips options={CREATURE_WORDS} selected={list(riders.saveDisadvantageFor)} onChange={(next) => set({ saveDisadvantageFor: next.length ? next : undefined })} />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.spellMore.takeMaxDice")}</span>
        <ToggleChips options={CREATURE_WORDS} selected={list(riders.maxDamageFor)} onChange={(next) => set({ maxDamageFor: next.length ? next : undefined })} />
      </div>
    </MechGroup>
  );
}

export function BuffGroup({ mech, setMech }: MechProps) {
  const t = useT();
  const buff = sub(mech.buff);
  const tempHp = sub(buff.tempHp);
  const maxHp = sub(buff.maxHp);
  const set = (patch: Mech) => setMech({ buff: clean({ target: "self", rounds: 10, ...buff, ...patch }) });
  return (
    <MechGroup title={t("workshop.homebrew.spellMore.buffTitle")} summary={buff.condition ? t("workshop.homebrew.spellMore.buffSummary", { condition: String(buff.condition), target: String(buff.target ?? "self"), count: num(buff.rounds, 10) as number }) : t("workshop.homebrew.hazard.none")} open>
      <TextField label={t("workshop.homebrew.spellMore.conditionGranted")} value={String(buff.condition ?? "")} onChange={(condition) => set({ condition: condition || undefined })} suggestions={[...BUFF_WORDS, ...CONDITIONS]} maxLength={40} />
      <SelectField label={t("workshop.homebrew.spellMore.on")} value={String(buff.target ?? "self")} options={[{ value: "self", label: t("workshop.homebrew.spellMore.theCaster") }, { value: "ally", label: t("workshop.homebrew.spellMore.oneAlly") }, { value: "allies", label: t("workshop.homebrew.spellMore.severalAllies") }]} onChange={(target) => set({ target })} />
      <NumberField label={t("workshop.homebrew.spellMore.forRounds")} value={num(buff.rounds, 10)} min={1} max={144000} onChange={(rounds) => set({ rounds: rounds === "" ? 10 : rounds })} />
      <div className="flex items-end pb-1">
        <CheckField label={t("workshop.homebrew.spellMore.tempHpEachTurn")} checked={buff.tempHpEachTurn === true} onChange={(on) => set({ tempHpEachTurn: on || undefined })} />
      </div>
      <NumberField label={t("workshop.homebrew.spellMore.tempHp")} value={tempHp.base === undefined ? "" : num(tempHp.base)} min={0} max={500} onChange={(base) => set({ tempHp: base === "" ? undefined : clean({ ...tempHp, base }) })} />
      <TextField label={t("workshop.homebrew.spellMore.tempHpDice")} value={String(tempHp.dice ?? "")} onChange={(dice) => set({ tempHp: clean({ base: num(tempHp.base), ...tempHp, dice: dice || undefined }) })} placeholder="1d4" maxLength={40} />
      <NumberField label={t("workshop.homebrew.spellMore.maxHpUp")} value={maxHp.base === undefined ? "" : num(maxHp.base)} min={0} max={500} onChange={(base) => set({ maxHp: base === "" ? undefined : clean({ ...maxHp, base }) })} hint={t("workshop.homebrew.spellMore.aidHint")} />
      <NumberField label={t("workshop.homebrew.spellMech.morePerSlot")} value={maxHp.perSlotLevel === undefined ? "" : num(maxHp.perSlotLevel)} min={0} max={100} onChange={(perSlotLevel) => set({ maxHp: maxHp.base === undefined ? undefined : clean({ ...maxHp, perSlotLevel: perSlotLevel === "" ? undefined : perSlotLevel }) })} />
    </MechGroup>
  );
}

export function HealGroup({ mech, setMech }: MechProps) {
  const t = useT();
  const healing = sub(mech.healing);
  const revive = sub(mech.revive);
  const cures = sub(mech.cures);
  const has = Boolean(mech.healing || mech.healPool || mech.revive || mech.cures || mech.dispel || mech.regainEachTurn || mech.maxHpDice);
  const summary = [
    healing.flat ? t("workshop.homebrew.spellMore.healsSummary", { amount: num(healing.flat) as number }) : "",
    mech.healPool ? t("workshop.homebrew.spellMore.poolSummary", { amount: num(mech.healPool) as number }) : "",
    revive.hp ? t("workshop.homebrew.spellMore.revives") : "",
    list(cures.conditions).length ? t("workshop.homebrew.spellMore.endsSummary", { list: list(cures.conditions).join("/") }) : "",
    mech.dispel ? t("workshop.homebrew.spellMore.dispels") : "",
  ].filter(Boolean).join(", ");
  return (
    <MechGroup title={t("workshop.homebrew.spellMore.healTitle")} summary={summary || t("workshop.homebrew.spellMech.diceFromProse")} open={has}>
      <NumberField label={t("workshop.homebrew.spellMore.healsFlat")} value={healing.flat === undefined ? "" : num(healing.flat)} min={1} max={1000} onChange={(flat) => setMech({ healing: flat === "" ? undefined : clean({ ...healing, flat }) })} hint={t("workshop.homebrew.spellMore.healHint")} />
      <NumberField label={t("workshop.homebrew.spellMech.morePerSlot")} value={healing.perSlotLevel === undefined ? "" : num(healing.perSlotLevel)} min={0} max={100} onChange={(perSlotLevel) => setMech({ healing: healing.flat === undefined ? undefined : clean({ ...healing, perSlotLevel: perSlotLevel === "" ? undefined : perSlotLevel }) })} />
      <NumberField label={t("workshop.homebrew.spellMore.sharedPool")} value={mech.healPool === undefined ? "" : num(mech.healPool)} min={1} max={2000} onChange={(healPool) => setMech({ healPool: healPool === "" ? undefined : healPool })} hint={t("workshop.homebrew.spellMore.massHealHint")} />
      <NumberField label={t("workshop.homebrew.spellMore.regainedEachTurn")} value={mech.regainEachTurn === undefined ? "" : num(mech.regainEachTurn)} min={1} max={100} onChange={(regainEachTurn) => setMech({ regainEachTurn: regainEachTurn === "" ? undefined : regainEachTurn })} />
      <SelectField label={t("workshop.homebrew.spellMore.revivesDead")} value={String(revive.hp ?? "")} options={[{ value: "", label: t("workshop.homebrew.hazard.no") }, { value: "one", label: t("workshop.homebrew.spellMore.with1Hp") }, { value: "all", label: t("workshop.homebrew.spellMore.withEveryHp") }]} onChange={(hp) => setMech({ revive: hp ? clean({ withinMinutes: 1, ...revive, hp }) : undefined })} />
      {revive.hp ? (
        <NumberField label={t("workshop.homebrew.spellMore.deadNoLongerThan")} value={num(revive.withinMinutes, 1)} min={1} max={200000000} onChange={(withinMinutes) => setMech({ revive: clean({ ...revive, withinMinutes: withinMinutes === "" ? 1 : withinMinutes }) })} hint={t("workshop.homebrew.spellMore.revivifyHint")} />
      ) : null}
      <div className="col-span-2 flex flex-wrap items-end gap-3 pb-1">
        <CheckField label={t("workshop.homebrew.spellMore.endsSpells")} checked={mech.dispel === true} onChange={(on) => setMech({ dispel: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.noModifierHealing")} checked={mech.healNoModifier === true} onChange={(on) => setMech({ healNoModifier: on || undefined })} />
        <CheckField label={t("workshop.homebrew.spellMore.endsEveryListed")} checked={cures.all === true} onChange={(all) => setMech({ cures: list(cures.conditions).length ? clean({ ...cures, all: all || undefined }) : undefined })} />
      </div>
      <div className="col-span-2 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.spellMore.endsOnTarget")}</span>
        <ToggleChips options={[...CONDITIONS, "cursed", "diseased"]} selected={list(cures.conditions)} onChange={(next) => setMech({ cures: next.length ? clean({ ...cures, conditions: next }) : undefined })} />
      </div>
    </MechGroup>
  );
}

export function AuraGroup({ mech, setMech }: MechProps) {
  const t = useT();
  const aura = sub(mech.aura);
  const set = (patch: Mech) => setMech({ aura: clean({ radiusFeet: 15, save: "wis", dice: "3d8", baseLevel: num(mech.level, 3), type: "radiant", halfOnSave: true, ...aura, ...patch }) });
  return (
    <MechGroup title={t("workshop.homebrew.spellMore.auraTitle")} summary={aura.dice ? `${num(aura.radiusFeet)} ft, ${String(aura.dice)} ${String(aura.type ?? "")}` : t("workshop.homebrew.hazard.none")} open={Boolean(mech.aura)}>
      <div className="col-span-2 flex items-end pb-1">
        <CheckField label={t("workshop.homebrew.spellMore.damagesEnemies")} checked={Boolean(mech.aura)} onChange={(on) => (on ? set({}) : setMech({ aura: undefined }))} />
      </div>
      {mech.aura ? (
        <>
          <NumberField label={t("workshop.homebrew.spellMore.radiusFeet")} value={num(aura.radiusFeet, 15)} min={5} max={120} step={5} onChange={(radiusFeet) => set({ radiusFeet: radiusFeet === "" ? 15 : radiusFeet })} />
          <SelectField label={t("workshop.bestiary.attack.save")} value={String(aura.save ?? "wis")} options={ABILITY_OPTIONS.filter((option) => option.value)} onChange={(save) => set({ save })} />
          <TextField label={t("workshop.homebrew.itemMagic.dice")} value={String(aura.dice ?? "")} onChange={(dice) => set({ dice })} maxLength={40} />
          <TextField label={t("workshop.homebrew.spellMore.perSlotLevel")} value={String(aura.perSlotLevel ?? "")} onChange={(perSlotLevel) => set({ perSlotLevel: perSlotLevel || undefined })} maxLength={40} />
          <SelectField label={t("workshop.bestiary.attack.type")} value={String(aura.type ?? "radiant")} options={DAMAGE_TYPES.map((value) => ({ value, label: value }))} onChange={(type) => set({ type })} />
          <div className="flex items-end pb-1">
            <CheckField label={t("workshop.bestiary.attack.halfOnSuccess")} checked={aura.halfOnSave === true} onChange={(halfOnSave) => set({ halfOnSave })} />
          </div>
        </>
      ) : null}
    </MechGroup>
  );
}

export function PoolGroup({ mech, setMech }: MechProps) {
  const t = useT();
  const pool = sub(mech.hitPointPool);
  const set = (patch: Mech) => setMech({ hitPointPool: clean({ dice: "5d8", perSlotLevel: "2d8", condition: "unconscious", rounds: 10, ...pool, ...patch }) });
  return (
    <MechGroup title={t("workshop.homebrew.spellMore.poolTitle")} summary={pool.dice ? `${String(pool.dice)}, ${String(pool.condition ?? "")}` : t("workshop.homebrew.hazard.none")} open={Boolean(mech.hitPointPool)}>
      <div className="col-span-2 flex items-end pb-1">
        <CheckField label={t("workshop.homebrew.spellMore.sleepStyle")} checked={Boolean(mech.hitPointPool)} onChange={(on) => (on ? set({}) : setMech({ hitPointPool: undefined }))} />
      </div>
      {mech.hitPointPool ? (
        <>
          <TextField label={t("workshop.homebrew.spellMore.poolDice")} value={String(pool.dice ?? "")} onChange={(dice) => set({ dice })} maxLength={40} />
          <TextField label={t("workshop.homebrew.spellMore.perSlotLevel")} value={String(pool.perSlotLevel ?? "")} onChange={(perSlotLevel) => set({ perSlotLevel })} maxLength={40} />
          <TextField label={t("workshop.bestiary.attack.condition")} value={String(pool.condition ?? "")} onChange={(condition) => set({ condition })} suggestions={CONDITIONS} maxLength={40} />
          <NumberField label={t("workshop.bestiary.attack.rounds")} value={num(pool.rounds, 10)} min={1} max={144000} onChange={(rounds) => set({ rounds: rounds === "" ? 10 : rounds })} />
          <div className="col-span-2 sm:col-span-4">
            <span className="text-[11px] text-stone-400">{t("workshop.homebrew.spellMore.passesOver")}</span>
            <ToggleChips options={CREATURE_WORDS} selected={list(pool.immuneTypes)} onChange={(next) => set({ immuneTypes: next.length ? next : undefined })} />
          </div>
        </>
      ) : null}
    </MechGroup>
  );
}

// The whole block as text: every field the engine reads, for the ones the
// form has no box for (Divine Word's tiers, Flesh to Stone's tally,
// Command's words). Checked by the same schema the server keeps it by.
export function AdvancedBlock({ mech, onChange }: { mech: Mech; onChange: (next: Mech | undefined) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  return (
    <div className="space-y-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setText(JSON.stringify(mech, null, 2));
          setProblem("");
          setOpen((value) => !value);
        }}
        className={cn(ui.btnSmall, "px-2 py-1 text-[11px]")}
      >
        {open ? t("workshop.homebrew.spellMore.closeBlockText") : t("workshop.homebrew.spellMore.editBlockText")}
      </button>
      {open ? (
        <div className="reveal space-y-1">
          <textarea value={text} rows={10} spellCheck={false} onChange={(event) => setText(event.target.value)} className={cn(ui.input, "w-full font-mono text-[11px]")} aria-label={t("workshop.homebrew.spellMore.blockTextAria")} />
          {problem ? <p className="motion-shake text-[11px] text-red-400">{problem}</p> : null}
          <button
            type="button"
            onClick={() => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(text);
              } catch {
                setProblem(t("workshop.homebrew.spellMore.notReadable"));
                return;
              }
              const checked = checkSpellMech(parsed);
              if ("error" in checked) {
                setProblem(checked.error);
                return;
              }
              onChange(checked.mech as Mech);
              setOpen(false);
            }}
            className={cn(ui.btnSecondary, "text-xs")}
          >
            {t("workshop.homebrew.spellMore.useThisBlock")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
