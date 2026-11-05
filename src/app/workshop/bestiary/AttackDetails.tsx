"use client";

import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { CONDITIONS, DAMAGE_TYPES } from "@/lib/bestiary/kit";
import { BLOCK_LIMITS, SAVE_ABILITY_IDS } from "@/lib/bestiary/block-check";
import { SIZES } from "@/lib/bestiary/monster-draft";
import type { EnemyAttack } from "@/lib/bestiary/statblock";
import type { OnHitRider } from "@/lib/bestiary/attack-text";
import { useT } from "@/lib/locale";
import { Field, FieldLabel, OptionalStepper, addChip, rowIcon } from "@/app/workshop/kit";

// The half of an attack line the engine reads besides its bonus and dice
// (src/lib/dm/enemy-profile.ts, enemy-attack.ts, enemy-hit.ts): whether it
// is a melee or ranged swing, a bonus action's, its reach and range in feet,
// the dice that ride the hit under their own damage type, what a hit does
// besides damage (a save, a condition, a grapple's escape DC), and the
// weaker blow a swarm deals at half its hit points. Opened from the attack
// row; everything is optional and an attack without any of it swings as
// before.

type Patch = Partial<EnemyAttack>;

function withoutUnset<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== "")) as T;
}

export function AttackDetails({ attack, onChange }: { attack: EnemyAttack; onChange: (next: EnemyAttack) => void }) {
  const t = useT();
  const conditionList = useId();
  const typeList = useId();
  const set = (patch: Patch) => onChange(withoutUnset({ ...attack, ...patch }));
  const onHit = attack.onHit ?? {};
  const setOnHit = (patch: Partial<OnHitRider>) => {
    const next = withoutUnset({ ...onHit, ...patch });
    set({ onHit: Object.keys(next).length ? next : undefined });
  };
  const riders = attack.riders ?? [];
  const setRiders = (next: typeof riders) => set({ riders: next.length ? next : undefined });
  // The weaker blow at half its hit points (src/lib/dm/enemy-profile.ts
  // alternativeBlow); a ranged alternative read from a pack line is kept.
  const bloodied = attack.alternatives?.find((entry) => entry.when === "bloodied");
  const setBloodied = (damage: string, type: string) => {
    const others = (attack.alternatives ?? []).filter((entry) => entry.when !== "bloodied");
    const next = damage.trim() ? [...others, { when: "bloodied" as const, damage: damage.replace(/\s+/g, ""), type: type || "untyped" }] : others;
    set({ alternatives: next.length ? next : undefined });
  };

  const modeOptions = [
    { value: "", label: t("workshop.bestiary.attack.modeUnstated") },
    { value: "melee", label: t("workshop.bestiary.attack.modeMelee") },
    { value: "ranged", label: t("workshop.bestiary.attack.modeRanged") },
    { value: "both", label: t("workshop.bestiary.attack.modeBoth") },
  ];
  const saveOptions = [
    { value: "", label: t("workshop.bestiary.attack.noSave") },
    ...SAVE_ABILITY_IDS.map((ability) => ({ value: ability as string, label: t("workshop.bestiary.attack.abilitySave", { ability: ability.toUpperCase() }) })),
  ];
  const sizeOptions = [
    { value: "", label: t("workshop.bestiary.attack.anySize") },
    ...SIZES.map((size) => ({ value: size as string, label: t("workshop.bestiary.attack.sizeOrSmaller", { size }) })),
  ];

  return (
    <div className="reveal grid gap-3 rounded-lg border border-stone-800 bg-stone-950/50 p-3">
      <datalist id={conditionList}>
        {CONDITIONS.map((condition) => (
          <option key={condition} value={condition} />
        ))}
      </datalist>
      <datalist id={typeList}>
        {DAMAGE_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("workshop.bestiary.attack.kind")}>
          <span className="block w-40">
            <Select
              label={t("workshop.bestiary.attack.modeSelect")}
              size="sm"
              value={attack.mode ?? ""}
              onChange={(mode) => set({ mode: (mode || undefined) as EnemyAttack["mode"] })}
              options={modeOptions}
            />
          </span>
        </Field>
        <Field label={t("workshop.bestiary.attack.spellAttack")}>
          <Switch label={t("workshop.bestiary.attack.spellAttackSwitch")} on={attack.spellAttack === true} onChange={(on) => set({ spellAttack: on || undefined })} />
        </Field>
        <Field label={t("workshop.bestiary.attack.bonusAction")}>
          <Switch label={t("workshop.bestiary.attack.bonusActionSwitch")} on={attack.bonusAction === true} onChange={(on) => set({ bonusAction: on || undefined })} />
        </Field>
        <Field label={t("workshop.bestiary.attack.reach")}>
          <OptionalStepper label={t("workshop.bestiary.attack.reachStepper")} min={0} max={60} step={5} suffix="ft" fallback={5} value={attack.reach} onChange={(reach) => set({ reach: reach === "" ? undefined : reach })} />
        </Field>
        <Field label={t("workshop.bestiary.attack.range")}>
          <span className="flex items-center gap-1">
            <OptionalStepper
              label={t("workshop.bestiary.attack.rangeNormal")}
              min={5}
              max={1000}
              step={5}
              suffix="ft"
              fallback={30}
              value={attack.range?.normal}
              onChange={(normal) =>
                set({ range: normal === "" ? undefined : { normal, long: Math.max(normal, attack.range?.long ?? normal * 4) } })
              }
            />
            {attack.range ? (
              <>
                <span className="text-[11px] text-stone-500">/</span>
                <OptionalStepper
                  label={t("workshop.bestiary.attack.rangeLong")}
                  min={attack.range.normal}
                  max={2000}
                  step={5}
                  suffix="ft"
                  fallback={attack.range.normal}
                  value={attack.range.long}
                  onChange={(long) => set({ range: { normal: attack.range!.normal, long: long === "" ? attack.range!.normal : long } })}
                />
              </>
            ) : null}
          </span>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>{t("workshop.bestiary.attack.ridersTitle")}</FieldLabel>
        {riders.map((rider, index) => (
          <div key={index} className="live-in flex flex-wrap items-center gap-1.5">
            <input
              value={rider.dice}
              aria-label={t("workshop.bestiary.attack.riderDiceAria")}
              placeholder="2d6"
              onChange={(event) => setRiders(riders.map((row, at) => (at === index ? { ...row, dice: event.target.value } : row)))}
              className={cn(ui.input, "w-24")}
            />
            <input
              list={typeList}
              value={rider.type}
              aria-label={t("workshop.bestiary.attack.riderTypeAria")}
              placeholder="fire"
              onChange={(event) => setRiders(riders.map((row, at) => (at === index ? { ...row, type: event.target.value } : row)))}
              className={cn(ui.input, "w-28")}
            />
            <button type="button" aria-label={t("workshop.bestiary.attack.removeRider")} onClick={() => setRiders(riders.filter((_, at) => at !== index))} className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}>
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {riders.length < BLOCK_LIMITS.riders ? (
          <button type="button" onClick={() => setRiders([...riders, { dice: "1d6", type: "fire" }])} className={cn(ui.btnSmall, addChip, "w-fit")}>
            <Plus className="size-3" /> {t("workshop.bestiary.attack.riderChip")}
          </button>
        ) : null}
        <span className="text-[11px] text-stone-500">{t("workshop.bestiary.attack.ridersHint")}</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field as="label" label={t("workshop.bestiary.attack.bloodiedLabel")}>
          <input
            value={bloodied?.damage ?? ""}
            placeholder="1d6"
            onChange={(event) => setBloodied(event.target.value, bloodied?.type ?? attack.type.split("/")[0])}
            className={cn(ui.input, "w-24")}
          />
        </Field>
        {bloodied ? (
          <Field as="label" label={t("workshop.bestiary.attack.type")}>
            <input list={typeList} value={bloodied.type} placeholder="piercing" onChange={(event) => setBloodied(bloodied.damage, event.target.value)} className={cn(ui.input, "w-28")} />
          </Field>
        ) : null}
        <span className="basis-full text-[11px] text-stone-500">{t("workshop.bestiary.attack.bloodiedHint")}</span>
      </div>

      <div className="grid gap-2">
        <FieldLabel>{t("workshop.bestiary.attack.onHitTitle")}</FieldLabel>
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t("workshop.bestiary.attack.save")}>
            <span className="block w-32">
              <Select label={t("workshop.bestiary.attack.saveSelect")} size="sm" value={onHit.save ?? ""} onChange={(save) => setOnHit({ save: (save || undefined) as OnHitRider["save"], dc: save ? onHit.dc ?? 13 : undefined })} options={saveOptions} />
            </span>
          </Field>
          {onHit.save ? (
            <Field label={t("workshop.bestiary.attack.dc")}>
              <OptionalStepper label={t("workshop.bestiary.attack.saveDc")} min={1} max={30} fallback={13} value={onHit.dc} onChange={(dc) => setOnHit({ dc: dc === "" ? 13 : dc })} />
            </Field>
          ) : null}
          <Field as="label" label={t("workshop.bestiary.attack.condition")}>
            <input list={conditionList} value={onHit.condition ?? ""} placeholder="grappled" onChange={(event) => setOnHit({ condition: event.target.value.toLowerCase() || undefined })} className={cn(ui.input, "w-32")} />
          </Field>
          <Field as="label" label={t("workshop.bestiary.attack.also")}>
            <input list={conditionList} value={onHit.alsoCondition ?? ""} placeholder="restrained" onChange={(event) => setOnHit({ alsoCondition: event.target.value.toLowerCase() || undefined })} className={cn(ui.input, "w-32")} />
          </Field>
          <Field label={t("workshop.bestiary.attack.escapeDc")}>
            <OptionalStepper label={t("workshop.bestiary.attack.escapeDc")} min={1} max={30} fallback={13} value={onHit.escapeDc} onChange={(escapeDc) => setOnHit({ escapeDc: escapeDc === "" ? undefined : escapeDc })} />
          </Field>
          <Field label={t("workshop.bestiary.attack.rounds")}>
            <OptionalStepper label={t("workshop.bestiary.attack.roundsStepper")} min={1} max={100} fallback={10} value={onHit.rounds} onChange={(rounds) => setOnHit({ rounds: rounds === "" ? undefined : rounds })} />
          </Field>
          <Field label={t("workshop.bestiary.attack.saveAgain")}>
            <Switch label={t("workshop.bestiary.attack.saveAgainSwitch")} on={onHit.repeatSave === true} onChange={(on) => setOnHit({ repeatSave: on || undefined })} />
          </Field>
          <Field label={t("workshop.bestiary.attack.worksOn")}>
            <span className="block w-40">
              <Select label={t("workshop.bestiary.attack.maxSize")} size="sm" value={onHit.maxSize ?? ""} onChange={(maxSize) => setOnHit({ maxSize: maxSize || undefined })} options={sizeOptions} />
            </span>
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field as="label" label={t("workshop.bestiary.attack.damageOnFail")}>
            <input value={onHit.damage ?? ""} placeholder="3d6" onChange={(event) => setOnHit({ damage: event.target.value || undefined, damageType: event.target.value ? onHit.damageType ?? "poison" : undefined })} className={cn(ui.input, "w-24")} />
          </Field>
          {onHit.damage ? (
            <>
              <Field as="label" label={t("workshop.bestiary.attack.type")}>
                <input list={typeList} value={onHit.damageType ?? ""} placeholder="poison" onChange={(event) => setOnHit({ damageType: event.target.value || undefined })} className={cn(ui.input, "w-28")} />
              </Field>
              <Field label={t("workshop.bestiary.attack.halfOnSuccess")}>
                <Switch label={t("workshop.bestiary.attack.halfOnSaveSwitch")} on={onHit.halfOnSave === true} onChange={(on) => setOnHit({ halfOnSave: on || undefined })} />
              </Field>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
