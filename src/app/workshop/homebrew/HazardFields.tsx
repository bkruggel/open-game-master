"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { NumberField, SelectField, TextArea, TextField } from "@/app/workshop/homebrew/fields";
import { ChipList } from "@/app/workshop/plugin/fields";
import { MechGroup, list, num, sub, type Mech } from "@/app/workshop/homebrew/MechGroup";
import { addChip, rowIcon } from "@/app/workshop/kit";
import { useT } from "@/lib/locale";
import type { Data } from "@/app/workshop/homebrew/draft";

// A hazard: a trap apply_hazard springs by name, a poison or a disease the
// afflict tool lays on by name (src/lib/homebrew/hazard-data.ts). The blocks
// are the SRD's own shapes, so a copy of the Poison Needle or Wyvern Poison
// starts exact and stays editable.

type Props = { data: Data; onChange: (next: Data) => void };

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"].map((value) => ({ value, label: value.toUpperCase() }));
const DAMAGE = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
const DAMAGE_OPTIONS = DAMAGE.map((value) => ({ value, label: value }));
const CONDITIONS = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious"];
const KINDS = [
  { value: "trap", label: "workshop.homebrew.hazard.kindTrap" },
  { value: "poison", label: "workshop.homebrew.hazard.kindPoison" },
  { value: "disease", label: "workshop.homebrew.hazard.kindDisease" },
];
const optional = (value: number | "") => (value === "" ? undefined : value);
// A block with its emptied fields dropped, so the stored row stays clean.
const tidy = (block: Mech): Mech => Object.fromEntries(Object.entries(block).filter(([, value]) => value !== undefined && !(Array.isArray(value) && !value.length)));

function DamageParts({ title, parts, onChange }: { title: string; parts: Mech[]; onChange: (next: Mech[]) => void }) {
  const t = useT();
  return (
    <div className="col-span-2 space-y-1 sm:col-span-4">
      <span className="text-[11px] text-stone-400">{title}</span>
      {parts.map((part, index) => (
        <div key={index} className="live-in flex flex-wrap items-center gap-1.5">
          <input
            value={String(part.dice ?? "")}
            aria-label={t("workshop.homebrew.hazard.damageDiceAria")}
            placeholder="2d10"
            maxLength={40}
            onChange={(event) => onChange(parts.map((entry, at) => (at === index ? { ...entry, dice: event.target.value } : entry)))}
            className={cn(ui.input, "w-24 text-sm")}
          />
          <SelectField label="" value={String(part.type ?? "piercing")} options={DAMAGE_OPTIONS} onChange={(type) => onChange(parts.map((entry, at) => (at === index ? { ...entry, type } : entry)))} className="w-36" />
          <button type="button" aria-label={t("workshop.homebrew.hazard.removeDamage")} onClick={() => onChange(parts.filter((_, at) => at !== index))} className={cn(ui.iconAction, rowIcon, "hover:text-red-300")}>
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      {parts.length < 4 ? (
        <button type="button" onClick={() => onChange([...parts, { dice: "1d4", type: "piercing" }])} className={cn(ui.btnSmall, addChip)}>
          <Plus className="size-3" /> {t("workshop.homebrew.hazard.addDamage")}
        </button>
      ) : null}
    </div>
  );
}

function TrapBlock({ block, put }: { block: Mech; put: (patch: Mech) => void }) {
  const t = useT();
  const spot = sub(block.spot);
  const disarm = sub(block.disarm);
  const save = sub(block.save);
  const damage = sub(block.damage);
  const escape = sub(block.escape);
  return (
    <>
      <MechGroup title={t("workshop.homebrew.hazard.howItWorks")} summary={String(block.trigger ?? "") || t("workshop.homebrew.hazard.itsTrigger")} open>
        <SelectField label={t("workshop.bestiary.attack.kind")} value={String(block.kind ?? "mechanical")} options={[{ value: "mechanical", label: t("workshop.homebrew.hazard.kindMechanical") }, { value: "magic", label: t("workshop.homebrew.hazard.kindMagic") }]} onChange={(kind) => put({ kind })} />
        <div className="col-span-2 sm:col-span-3">
          <TextField label={t("workshop.homebrew.hazard.trigger")} value={String(block.trigger ?? "")} onChange={(trigger) => put({ trigger })} placeholder="a pressure plate under the third flagstone" maxLength={200} />
        </div>
        <NumberField label={t("workshop.homebrew.hazard.spotDc")} value={num(spot.dc, 0) || ""} min={1} max={30} onChange={(dc) => put({ spot: dc === "" ? undefined : { dc, skill: String(spot.skill ?? "perception") } })} />
        <SelectField label={t("workshop.homebrew.hazard.spottedWith")} value={String(spot.skill ?? "perception")} options={["perception", "investigation", "arcana"].map((value) => ({ value, label: value }))} onChange={(skill) => put({ spot: { dc: num(spot.dc, 10), skill } })} />
        <NumberField label={t("workshop.homebrew.hazard.disarmDc")} value={num(disarm.dc, 0) || ""} min={1} max={30} onChange={(dc) => put({ disarm: dc === "" ? undefined : { dc, how: String(disarm.how ?? "thieves' tools") } })} />
        <TextField label={t("workshop.homebrew.hazard.disarmedBy")} value={String(disarm.how ?? "")} onChange={(how) => put({ disarm: { dc: num(disarm.dc, 15), how } })} placeholder="thieves' tools" maxLength={200} />
      </MechGroup>
      <MechGroup title={t("workshop.homebrew.hazard.whatItDoes")} summary={[save.dc ? `DC ${num(save.dc)} ${String(save.ability ?? "").toUpperCase()}` : "", damage.dice ? `${String(damage.dice)} ${String(damage.type ?? "")}` : "", block.condition ? String(block.condition) : ""].filter(Boolean).join(", ") || t("workshop.homebrew.hazard.nothingYet")} open>
        <NumberField label={t("workshop.homebrew.hazard.attackBonus")} value={block.attackBonus === undefined ? "" : num(block.attackBonus)} min={-5} max={20} onChange={(value) => put({ attackBonus: optional(value) })} hint={t("workshop.homebrew.hazard.attackBonusHint")} />
        <NumberField label={t("workshop.homebrew.hazard.fall")} value={num(block.fallFeet, 0) || ""} min={0} max={500} step={5} onChange={(value) => put({ fallFeet: optional(value) || undefined })} />
        <DamageParts title={t("workshop.homebrew.hazard.damageNoSave")} parts={Array.isArray(block.hit) ? (block.hit as Mech[]) : []} onChange={(hit) => put({ hit: hit.length ? hit : undefined })} />
        <SelectField label={t("workshop.bestiary.attack.save")} value={String(save.ability ?? "")} options={[{ value: "", label: t("workshop.homebrew.hazard.none") }, ...ABILITIES]} onChange={(ability) => put({ save: ability ? { ability, dc: num(save.dc, 13), halfOnSave: save.halfOnSave !== false } : undefined })} />
        {save.ability ? (
          <>
            <NumberField label={t("workshop.bestiary.attack.saveDc")} value={num(save.dc, 13)} min={1} max={30} onChange={(dc) => put({ save: { ...save, dc: dc === "" ? 13 : dc } })} />
            <SelectField label={t("workshop.homebrew.hazard.onSuccess")} value={save.halfOnSave === false ? "none" : "half"} options={[{ value: "half", label: t("workshop.homebrew.hazard.halfDamage") }, { value: "none", label: t("workshop.homebrew.hazard.noDamage") }]} onChange={(value) => put({ save: { ...save, halfOnSave: value === "half" } })} />
            <TextField label={t("workshop.homebrew.hazard.damageDice")} value={String(damage.dice ?? "")} onChange={(dice) => put({ damage: dice ? { dice, type: String(damage.type ?? "piercing") } : undefined })} placeholder="4d10" maxLength={40} />
            <SelectField label={t("workshop.homebrew.hazard.damageType")} value={String(damage.type ?? "piercing")} options={DAMAGE_OPTIONS} onChange={(type) => put({ damage: { dice: String(damage.dice ?? "1d6"), type } })} />
            <SelectField label={t("workshop.homebrew.hazard.onFailureAlso")} value={String(block.condition ?? "")} options={[{ value: "", label: t("workshop.homebrew.hazard.nothing") }, ...CONDITIONS.map((value) => ({ value, label: value }))]} onChange={(condition) => put({ condition: condition || undefined })} />
          </>
        ) : null}
        <div className="col-span-2 space-y-1 sm:col-span-4">
          <span className="text-[11px] text-stone-400">{t("workshop.homebrew.hazard.onEveryone")}</span>
          <ChipList items={list(block.conditionsAlways)} onChange={(next) => put({ conditionsAlways: next.length ? next : undefined, ...(next.length ? {} : { escape: undefined }) })} options={CONDITIONS} prompt={t("workshop.homebrew.hazard.addCondition")} max={4} />
        </div>
        {list(block.conditionsAlways).length ? (
          <>
            <SelectField
              label={t("workshop.homebrew.hazard.brokenFreeBy")}
              value={String(escape.ability ?? "")}
              options={[{ value: "", label: t("workshop.homebrew.hazard.strVsSave") }, { value: "str", label: t("workshop.homebrew.hazard.strCheck") }, { value: "dex", label: t("workshop.homebrew.hazard.dexCheck") }]}
              onChange={(ability) => put({ escape: ability ? { ability, dc: num(escape.dc, num(save.dc, 10)) } : undefined })}
              hint={t("workshop.homebrew.hazard.escapeHint")}
            />
            {escape.ability ? <NumberField label={t("workshop.bestiary.attack.escapeDc")} value={num(escape.dc, 10)} min={1} max={30} onChange={(dc) => put({ escape: { ...escape, dc: dc === "" ? 10 : dc } })} /> : null}
          </>
        ) : null}
        <NumberField label={t("workshop.homebrew.hazard.forRounds")} value={num(block.rounds, 0) || ""} min={1} max={14400} onChange={(value) => put({ rounds: optional(value) })} hint={t("workshop.homebrew.hazard.roundsHint")} />
      </MechGroup>
    </>
  );
}

function PoisonBlock({ block, put }: { block: Mech; put: (patch: Mech) => void }) {
  const t = useT();
  const repeat = sub(block.repeat);
  return (
    <MechGroup title={t("workshop.homebrew.hazard.thePoison")} summary={[`DC ${num(block.dc, 10)} CON`, block.damage ? String(block.damage) : "", list(block.conditions).join(", ")].filter(Boolean).join(", ")} open>
      <SelectField label={t("workshop.homebrew.hazard.delivered")} value={String(block.type ?? "injury")} options={["contact", "ingested", "inhaled", "injury"].map((value) => ({ value, label: value }))} onChange={(type) => put({ type })} hint={t("workshop.homebrew.hazard.injuryHint")} />
      <NumberField label={t("workshop.homebrew.hazard.conSaveDc")} value={num(block.dc, 10)} min={1} max={30} onChange={(dc) => put({ dc: dc === "" ? 10 : dc })} />
      <TextField label={t("workshop.homebrew.hazard.poisonDamage")} value={String(block.damage ?? "")} onChange={(damage) => put({ damage: damage || undefined })} placeholder="3d6" maxLength={40} />
      <SelectField label={t("workshop.homebrew.hazard.onSuccess")} value={block.halfOnSave ? "half" : "none"} options={[{ value: "half", label: t("workshop.homebrew.hazard.halfDamage") }, { value: "none", label: t("workshop.homebrew.hazard.noDamage") }]} onChange={(value) => put({ halfOnSave: value === "half" || undefined })} />
      <div className="col-span-2 space-y-1 sm:col-span-4">
        <span className="text-[11px] text-stone-400">{t("workshop.homebrew.hazard.onFailure")}</span>
        <ChipList items={list(block.conditions)} onChange={(next) => put({ conditions: next.length ? next : undefined })} options={CONDITIONS} prompt={t("workshop.homebrew.hazard.addCondition")} max={4} />
      </div>
      <NumberField label={t("workshop.homebrew.hazard.forMinutes")} value={num(block.minutes, 0) || ""} min={1} max={525600} onChange={(value) => put({ minutes: optional(value) })} />
      <TextField label={t("workshop.homebrew.hazard.orHoursOf")} value={String(block.hoursDice ?? "")} onChange={(hoursDice) => put({ hoursDice: hoursDice || undefined })} placeholder="4d6" maxLength={40} />
      <NumberField label={t("workshop.homebrew.hazard.outCold")} value={num(block.unconsciousIfFailBy, 0) || ""} min={1} max={20} onChange={(value) => put({ unconsciousIfFailBy: optional(value) })} />
      <SelectField label={t("workshop.homebrew.hazard.damageWakes")} value={block.wakesOnDamage ? "yes" : "no"} options={[{ value: "no", label: t("workshop.homebrew.hazard.no") }, { value: "yes", label: t("workshop.homebrew.hazard.yes") }]} onChange={(value) => put({ wakesOnDamage: value === "yes" || undefined })} />
      <SelectField
        label={t("workshop.homebrew.hazard.savesAgain")}
        value={String(repeat.every ?? "")}
        options={[{ value: "", label: t("workshop.homebrew.hazard.never") }, { value: "turn_start", label: t("workshop.homebrew.hazard.turnStart") }, { value: "turn_end", label: t("workshop.homebrew.hazard.turnEnd") }, { value: "day", label: t("workshop.homebrew.hazard.every24h") }]}
        onChange={(every) => put({ repeat: every ? { every, successes: num(repeat.successes, 1), ...(repeat.damage ? { damage: repeat.damage } : {}) } : undefined })}
      />
      {repeat.every ? (
        <>
          <NumberField label={t("workshop.homebrew.hazard.successesToEnd")} value={num(repeat.successes, 1)} min={1} max={20} onChange={(successes) => put({ repeat: { ...repeat, successes: successes === "" ? 1 : successes } })} />
          <TextField label={t("workshop.homebrew.hazard.damageEachFailure")} value={String(repeat.damage ?? "")} onChange={(damage) => put({ repeat: { ...repeat, damage: damage || undefined } })} placeholder="1d6" maxLength={40} />
        </>
      ) : null}
      <SelectField label={t("workshop.homebrew.hazard.waitsForMidnight")} value={block.atMidnight ? "yes" : "no"} options={[{ value: "no", label: t("workshop.homebrew.hazard.no") }, { value: "yes", label: t("workshop.homebrew.hazard.yes") }]} onChange={(value) => put({ atMidnight: value === "yes" || undefined })} />
      <NumberField label={t("workshop.homebrew.hazard.price")} value={num(block.priceGp, 0)} min={0} max={100000} onChange={(priceGp) => put({ priceGp: priceGp === "" ? 0 : priceGp })} />
    </MechGroup>
  );
}

function DiseaseBlock({ block, put }: { block: Mech; put: (patch: Mech) => void }) {
  const t = useT();
  const infect = sub(block.infect);
  const onset = sub(block.onset);
  const rest = sub(block.rest);
  return (
    <>
      <MechGroup title={t("workshop.homebrew.hazard.catchingIt")} summary={`DC ${num(infect.dc, 11)} ${String(infect.ability ?? "con").toUpperCase()}, symptoms in ${String(onset.dice ?? "1d4")} ${String(onset.unit ?? "days")}`} open>
        <SelectField label={t("workshop.bestiary.attack.save")} value={String(infect.ability ?? "con")} options={ABILITIES} onChange={(ability) => put({ infect: { ...infect, ability } })} />
        <NumberField label={t("workshop.bestiary.attack.dc")} value={num(infect.dc, 11)} min={1} max={30} onChange={(dc) => put({ infect: { ability: infect.ability ?? "con", dc: dc === "" ? 11 : dc } })} />
        <TextField label={t("workshop.homebrew.hazard.symptomsAfter")} value={String(onset.dice ?? "1d4")} onChange={(dice) => put({ onset: { unit: onset.unit ?? "days", dice } })} placeholder="1d4" maxLength={40} />
        <SelectField label={t("workshop.homebrew.hazard.ofUnit")} value={String(onset.unit ?? "days")} options={[{ value: "hours", label: t("workshop.homebrew.hazard.hours") }, { value: "days", label: t("workshop.homebrew.hazard.days") }]} onChange={(unit) => put({ onset: { dice: onset.dice ?? "1d4", unit } })} />
      </MechGroup>
      <MechGroup title={t("workshop.homebrew.hazard.theSymptoms")} summary={[String(block.condition ?? ""), num(block.exhaustion) ? `${num(block.exhaustion)} exhaustion` : ""].filter(Boolean).join(", ") || t("workshop.homebrew.hazard.noneYet")} open>
        <TextField label={t("workshop.homebrew.hazard.conditionShowsAs")} value={String(block.condition ?? "")} onChange={(condition) => put({ condition })} placeholder="marsh fever" maxLength={40} />
        <NumberField label={t("workshop.homebrew.hazard.exhaustionLevels")} value={num(block.exhaustion)} min={0} max={5} onChange={(exhaustion) => put({ exhaustion: exhaustion === "" ? 0 : exhaustion })} />
        <div className="col-span-2 space-y-1">
          <span className="text-[11px] text-stone-400">{t("workshop.homebrew.hazard.andWhileSick")}</span>
          <ChipList items={list(block.conditions)} onChange={(next) => put({ conditions: next.length ? next : undefined })} options={CONDITIONS} prompt={t("workshop.homebrew.hazard.addCondition")} max={4} />
        </div>
      </MechGroup>
      <MechGroup title={t("workshop.homebrew.hazard.afterLongRest")} summary={rest.ability ? `DC ${num(rest.dc, 11)} ${String(rest.ability).toUpperCase()}` : t("workshop.homebrew.hazard.noSave")} open={Boolean(rest.ability)}>
        <SelectField label={t("workshop.bestiary.attack.save")} value={String(rest.ability ?? "")} options={[{ value: "", label: t("workshop.homebrew.hazard.none") }, ...ABILITIES]} onChange={(ability) => put({ rest: ability ? { ability, dc: num(rest.dc, 11), onSuccess: rest.onSuccess ?? "improve", onFail: rest.onFail ?? "worsen", successes: num(rest.successes, 1) } : undefined })} />
        {rest.ability ? (
          <>
            <NumberField label={t("workshop.bestiary.attack.dc")} value={num(rest.dc, 11)} min={1} max={30} onChange={(dc) => put({ rest: { ...rest, dc: dc === "" ? 11 : dc } })} />
            <SelectField label={t("workshop.homebrew.hazard.aSuccess")} value={String(rest.onSuccess ?? "improve")} options={[{ value: "improve", label: t("workshop.homebrew.hazard.shedsExhaustion") }, { value: "recover", label: t("workshop.homebrew.hazard.countsTowardCure") }]} onChange={(onSuccess) => put({ rest: { ...rest, onSuccess } })} />
            <SelectField label={t("workshop.homebrew.hazard.aFailure")} value={String(rest.onFail ?? "worsen")} options={[{ value: "worsen", label: t("workshop.homebrew.hazard.addsExhaustion") }, { value: "nothing", label: t("workshop.homebrew.hazard.changesNothing") }]} onChange={(onFail) => put({ rest: { ...rest, onFail } })} />
            {rest.onSuccess === "recover" ? (
              <NumberField label={t("workshop.homebrew.hazard.successesToCure")} value={num(rest.successes, 1)} min={1} max={10} onChange={(successes) => put({ rest: { ...rest, successes: successes === "" ? 1 : successes } })} />
            ) : null}
          </>
        ) : null}
      </MechGroup>
      <SelectField
        label={t("workshop.homebrew.hazard.runsAs")}
        value={String(block.runsAs ?? "")}
        options={[{ value: "", label: t("workshop.homebrew.hazard.ownBlock") }, { value: "cackle_fever", label: "Cackle Fever" }, { value: "sewer_plague", label: "Sewer Plague" }, { value: "sight_rot", label: "Sight Rot" }]}
        onChange={(runsAs) => put({ runsAs: runsAs || undefined })}
        hint={t("workshop.homebrew.hazard.runsAsHint")}
        className="w-72"
      />
    </>
  );
}

export function HazardFields({ data, onChange }: Props) {
  const t = useT();
  const kind = String(data.hazardKind ?? "trap");
  const block = sub(data[kind]);
  const put = (patch: Mech) => onChange({ ...data, [kind]: tidy({ ...block, ...patch }) });
  return (
    <div className="space-y-3">
      <SelectField label={t("workshop.homebrew.hazard.whatItIs")} value={kind} options={KINDS.map((option) => ({ ...option, label: t(option.label) }))} onChange={(hazardKind) => onChange({ ...data, hazardKind })} className="w-48" />
      <div key={kind} className="reveal space-y-3">
        {kind === "trap" ? <TrapBlock block={block} put={put} /> : null}
        {kind === "poison" ? <PoisonBlock block={block} put={put} /> : null}
        {kind === "disease" ? <DiseaseBlock block={block} put={put} /> : null}
      </div>
      <TextArea label={t("workshop.homebrew.hazard.tableTold")} value={String(block.summary ?? "")} onChange={(summary) => put({ summary })} rows={2} maxLength={600} hint={t("workshop.homebrew.hazard.tableToldHint")} />
    </div>
  );
}
