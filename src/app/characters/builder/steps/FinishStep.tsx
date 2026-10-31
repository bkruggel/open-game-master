"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { contentSlug } from "@/lib/help";
import { formatModifier, proficiencyBonus } from "@/lib/srd";
import { racialFeatCount } from "@/lib/srd/race-id";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import { HpExplainerButton } from "../AbilityExplainers";
import { armorClassLine, hitPointsLine, purseViewFor } from "../derivedReasons";
import type { BackgroundOption, ClassOption, RaceOption } from "../useBuilderOptions";
import type { TableRulesState } from "../useTableRules";
import type { BuilderDerived } from "../useBuilderDerived";
import type { BuilderState } from "../useBuilderState";
import type { BlockerTarget } from "../submit";
import type { SummaryRow } from "../summary";
import { hpExplainerInput } from "./AbilitiesStep";
import { Chip, Field, StepPanel } from "./shared";
import { SummaryPanel } from "./SummaryPanel";
import { BuilderLevelTable } from "../LevelProgressionTable";

export type BuilderRole = "pc" | "companion";

// Step 6: the summary (an edit opens on it, a new build ends on it), the
// numbers the sheet will open with, who plays them (library only) and extra
// feats. The name, alignment, portrait, looks and story are the identity
// step's, just before this one (backlog F4). The save button is the wizard
// footer.
export type FinishEditStep = "calling" | "ancestry" | "abilities" | "spells-gear" | "identity";
export function FinishStep({
  state,
  derived,
  race,
  klass,
  background,
  table,
  error,
  onEdit,
  summary,
  onFix,
  role,
}: {
  state: BuilderState;
  derived: BuilderDerived;
  race: RaceOption | undefined;
  klass: ClassOption | undefined;
  background: BackgroundOption | undefined;
  table: TableRulesState;
  error: string;
  // Back to the step that holds a choice ("calling", "identity"...).
  onEdit?: (step: FinishEditStep) => void;
  // The summary's rows (summary.ts) and its Fix, which goes to the step and
  // the field that takes a pick still owed.
  summary: SummaryRow[];
  onFix: (target: BlockerTarget) => void;
  // Offered by the library page only, and only when the link that opened
  // it did not say (door.ts): a campaign already knows which door the
  // character comes through. It starts on a player character and is asked
  // here, at the end, because it changes nothing on the sheet.
  role?: { value: BuilderRole; onChange: (role: BuilderRole) => void };
}) {
  const t = useT();
  const { preview, acInfo, ac, effectiveLevel } = derived;
  const hp = hpExplainerInput(derived, klass);
  // Hit points, armor class and coin are the server's to work out, so they
  // are shown with their reasons and never typed.
  const hpLine =
    preview && klass
      ? hitPointsLine(t, {
          hitDie: klass.hitDie,
          level: effectiveLevel,
          maxHp: preview.maxHp,
          range: preview.hpRange,
          method: preview.hpMethod,
          kept: preview.hpKept,
          atTable: Boolean(table.rules),
          ...(derived.multiclass ? { dice: [klass.hitDie, ...derived.extras.map((entry) => entry.klass.hitDie)] } : {}),
        })
      : null;
  const acLine = armorClassLine(t, acInfo?.ac ?? ac, acInfo?.parts);
  const purse = purseViewFor(t, {
    purse: derived.purse,
    keepsStoredGear: state.keepsStoredGear,
    backgroundName: background?.name ?? "chosen",
    backgroundPurse: background?.purse ?? 0,
    classId: klass?.id ?? "",
    className: klass?.name ?? "character",
    table,
  });
  // Feats come with Ability Score Improvements (picked on the Abilities
  // step) or, for a variant human, with the race (picked on the Ancestry
  // step, issue #124). What is left here is what the character already
  // holds from play, shown so an edit does not lose it unseen.
  const racialFeat = race ? racialFeatCount(race.id) > 0 : false;
  return (
    <div className="space-y-4">
      {/* The playable character leads: each step's picks with a way back to
          it and anything still owed, then the numbers the sheet opens with. */}
      <SummaryPanel rows={summary} onEdit={(key) => onEdit?.(key)} onFix={onFix} />

      {preview && race ? (
        <StepPanel title={t("builder.finish.derivedTitle")} ornate className="border-amber-500/30">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-stone-300 sm:grid-cols-4">
            <Field
              label={
                <span className="flex items-center gap-0.5">
                  {t("builder.finish.maxHp")}
                  {hp ? <HpExplainerButton hp={hp} compact /> : null}
                </span>
              }
            >
              <span key={hpLine?.value} className="reveal font-mono text-base text-amber-100">
                {hpLine?.value}
              </span>
              <span className="mt-1 block text-sm text-stone-500">{hpLine?.reason}</span>
            </Field>
            <Field label={t("builder.finish.ac")}>
              <span key={acLine.value} className="reveal font-mono text-base text-amber-100">
                {acLine.value}
              </span>
              <span className="mt-1 block text-sm text-stone-500">{acLine.reason}</span>
            </Field>
            <Field label={t("builder.finish.gold")} className="col-span-2">
              <span key={`${purse.gold}-${purse.copper}`} className="reveal font-mono text-base text-amber-100">
                {purse.gold} gp{purse.copper ? ` ${purse.copper} cp` : ""}
              </span>
              <span className="mt-1 block text-sm text-stone-500">
                {purse.wealth?.rolled
                  ? t("builder.finish.rolledBy", { gold: purse.wealth.rolled.gold, dice: purse.wealth.dice })
                  : ""}
                {purse.source}
              </span>
            </Field>
            <span className="self-end">{t("builder.finish.speed", { speed: race.speed })}</span>
            <span className="self-end">{t("builder.finish.prof", { bonus: formatModifier(proficiencyBonus(effectiveLevel)) })}</span>
            <span>{t("builder.finish.initiative", { mod: formatModifier(preview.derived.initiative) })}</span>
            <span>{t("builder.finish.passive", { value: preview.derived.passivePerception })}</span>
            {preview.derived.spellSaveDc ? <span>{t("builder.finish.spellDc", { value: preview.derived.spellSaveDc })}</span> : null}
            {preview.derived.spellAttack !== null ? (
              <span>{t("builder.finish.spellAttack", { mod: formatModifier(preview.derived.spellAttack) })}</span>
            ) : null}
          </div>
        </StepPanel>
      ) : null}

      {/* What each level up to this one grants, with the picks (backlog F8),
          folded under the numbers the sheet opens with: reference, not a
          choice, so it never stands between the summary and the save. */}
      <BuilderLevelTable state={state} derived={derived} klass={klass} />

      {role ? (
        <StepPanel title={t("builder.finish.placeTitle")} help={t("builder.finish.placeHelp")}>
          <SegmentedControl
            label={t("builder.finish.placeTitle")}
            value={role.value}
            onChange={role.onChange}
            options={[
              { value: "pc", label: t("builder.finish.rolePc") },
              { value: "companion", label: t("builder.finish.roleCompanion") },
            ]}
            className="w-full sm:max-w-md"
          />
          <p className="mt-1.5 text-xs text-stone-500">
            {role.value === "companion" ? t("builder.finish.companionNote") : t("builder.finish.pcNote")}
          </p>
        </StepPanel>
      ) : null}

      {!racialFeat && state.feats.length ? (
        <StepPanel
          title={t("builder.finish.featsTitle")}
          help={t("builder.finish.featsHelp")}
        >
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.feats.map((feat) => (
              <Chip
                key={feat}
                label={feat}
                info={{ reference: { kind: "feats", slug: contentSlug(feat), name: feat } }}
                onRemove={() => state.setFeats((current) => current.filter((entry) => entry !== feat))}
              />
            ))}
          </div>
        </StepPanel>
      ) : null}

      {table.rulesError ? (
        <p role="alert" className="reveal flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
          {table.rulesError}
          <button type="button" onClick={table.retryRules} className={ui.btnSmall}>
            {t("builder.finish.tryAgain")}
          </button>
        </p>
      ) : null}
      {error ? (
        // Every reason the server gave, not just the first (U:UB8).
        error.includes("\n") ? (
          <div className="motion-shake text-sm text-red-400" role="alert">
            <p>{t("builder.finish.saveFailedHead")}</p>
            <ul className="stagger mt-1 list-disc space-y-0.5 pl-5">
              {error.split("\n").map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="motion-shake text-sm text-red-400" role="alert">
            {error}
          </p>
        )
      ) : null}
    </div>
  );
}
