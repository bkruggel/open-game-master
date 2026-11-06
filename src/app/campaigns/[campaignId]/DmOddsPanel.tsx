"use client";

import { useMemo, useState } from "react";
import { ui } from "@/lib/ui";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select, optionsFrom } from "@/components/ui/Select";
import { DeskCard, FieldLabel } from "@/app/campaigns/[campaignId]/DmConsoleParts";
import { asPercent, forecastAttack, roundsToDrop } from "@/lib/srd/odds";
import { useT } from "@/lib/locale";

// The consequence preview: hit chance, expected damage, and how long a target
// lasts. Pure arithmetic from src/lib/srd/odds.ts, so it is instant, always
// available, and needs nothing from the server.

// The only two table rules that change what a crit is worth. Named here so
// the same shape threads down from the panel without dragging the whole
// GameSettings type through three components.
export type CritRules = { powerfulCritical: boolean; criticalDamageMods: boolean };

type Roll = "none" | "advantage" | "disadvantage";
// The rolls' words by value; the keys live with the odds group.
const ROLL_KEYS = {
  none: "dm.odds.roll.none",
  advantage: "dm.odds.roll.advantage",
  disadvantage: "dm.odds.roll.disadvantage",
} as const;

// Hit chance, expected damage, and how long a target lasts. Pure arithmetic
// from src/lib/srd/odds.ts, so it is instant and always available.
export function OddsCalculator({
  variantRules,
}: {
  // The table's optional crit rules. The forecast runs them through the
  // engine's own critDamageExpression, so what it predicts is what the
  // server would actually roll.
  variantRules: CritRules;
}) {
  const t = useT();
  const [attackBonus, setAttackBonus] = useState(5);
  const [ac, setAc] = useState(15);
  const [damage, setDamage] = useState("1d8+3");
  const [advantage, setAdvantage] = useState<Roll>("none");
  const [hitPoints, setHitPoints] = useState(30);
  const [attacksPerRound, setAttacksPerRound] = useState(1);
  const [extraCritDice, setExtraCritDice] = useState(0);

  const forecast = useMemo(
    () =>
      forecastAttack({
        attackBonus,
        ac,
        damage,
        advantage,
        extraCritDice,
        variantRules: {
          powerfulCritical: variantRules.powerfulCritical,
          multiplyNumeric: variantRules.criticalDamageMods,
        },
      }),
    [attackBonus, ac, damage, advantage, extraCritDice, variantRules],
  );
  const perRound = forecast.perAttack * Math.max(1, attacksPerRound);
  const rounds = roundsToDrop(hitPoints, perRound);

  return (
    <DeskCard glyph="tab-dice" title={t("dm.odds.title")}>
      {/* Divs, not labels: a label would press the stepper's minus button
          whenever its caption was tapped. Each control carries its name. */}
      <div className="grid grid-cols-1 gap-x-2 gap-y-2.5 min-[24rem]:grid-cols-2">
        <div>
          <FieldLabel>{t("dm.odds.attackBonus")}</FieldLabel>
          <NumberStepper value={attackBonus} onChange={setAttackBonus} label={t("dm.odds.attackBonus")} size="sm" />
        </div>
        <div>
          <FieldLabel>{t("dm.odds.ac")}</FieldLabel>
          <NumberStepper value={ac} onChange={setAc} label={t("dm.odds.ac")} size="sm" />
        </div>
        <div>
          <FieldLabel>{t("dm.odds.damage")}</FieldLabel>
          <input
            value={damage}
            onChange={(event) => setDamage(event.target.value)}
            placeholder="2d6+4"
            aria-label={t("dm.odds.damage")}
            className={ui.input}
          />
        </div>
        <div>
          <FieldLabel>{t("dm.odds.roll")}</FieldLabel>
          <Select value={advantage} onChange={setAdvantage} options={(Object.keys(ROLL_KEYS) as Roll[]).map((roll) => ({ value: roll, label: t(ROLL_KEYS[roll]) }))} label={t("dm.odds.roll")} />
        </div>
        <div>
          <FieldLabel>{t("dm.odds.hitPoints")}</FieldLabel>
          <NumberStepper value={hitPoints} onChange={setHitPoints} label={t("dm.odds.hitPoints")} size="sm" />
        </div>
        <div>
          <FieldLabel>{t("dm.odds.attacksPerRound")}</FieldLabel>
          <NumberStepper value={attacksPerRound} onChange={setAttacksPerRound} min={1} label={t("dm.odds.attacksPerRound")} size="sm" />
        </div>
        <div title={t("dm.odds.extraCritTitle")}>
          <FieldLabel>{t("dm.odds.extraCrit")}</FieldLabel>
          <NumberStepper value={extraCritDice} onChange={setExtraCritDice} min={0} max={4} label={t("dm.odds.extraCrit")} size="sm" />
        </div>
      </div>
      {forecast.exact ? null : (
        <p className="mt-2 text-xs text-amber-300/90">
          {t("dm.odds.notExact")}
        </p>
      )}
      <dl className="mt-3 rounded-lg border border-amber-500/20 bg-stone-950/50 px-2.5 py-1.5 text-xs">
        <div className="dm-readout flex justify-between gap-3 py-0.5">
          <dt className="text-stone-400">{t("dm.odds.chanceToHit")}</dt>
          <dd className="text-right font-medium text-amber-100">
            {asPercent(forecast.odds.hit)}
            <span className="text-stone-500"> {t("dm.odds.critPct", { pct: asPercent(forecast.odds.crit) })}</span>
          </dd>
        </div>
        <div className="dm-readout flex justify-between gap-3 py-0.5">
          <dt className="text-stone-400">{t("dm.odds.damageOnHit")}</dt>
          <dd className="text-right font-medium text-amber-100">
            {forecast.exact ? (
              <>
                {forecast.onHit.toFixed(1)}
                <span className="text-stone-500"> {t("dm.odds.critValue", { value: forecast.onCrit.toFixed(1) })}</span>
              </>
            ) : (
              t("dm.odds.unknown")
            )}
          </dd>
        </div>
        <div className="dm-readout flex justify-between gap-3 py-0.5">
          <dt className="text-stone-400">{t("dm.odds.perRound")}</dt>
          <dd className="text-right font-medium text-amber-100">{forecast.exact ? perRound.toFixed(1) : t("dm.odds.unknown")}</dd>
        </div>
        <div className="dm-readout flex justify-between gap-3 py-0.5">
          <dt className="text-stone-400">{t("dm.odds.roundsToDrop")}</dt>
          <dd className="text-right font-medium text-amber-100">
            {!forecast.exact ? t("dm.odds.unknown") : rounds === null ? t("dm.odds.never") : rounds}
          </dd>
        </div>
      </dl>
    </DeskCard>
  );
}
