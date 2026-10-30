"use client";

import { InfoButton } from "@/components/ui/InfoDialog";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import {
  REROLL_LOW_DEFAULT,
  describeReroll,
  rerollBelowFor,
  rerollChoiceOf,
  type RerollChoice,
} from "@/lib/srd/ability-rerolls";
import { useServerRerollBelow } from "@/app/characters/builder/useTableRules";
import {
  CAMPAIGN_DIFFICULTIES,
  CAMPAIGN_DIFFICULTY_HINTS,
  type CampaignDifficulty,
} from "@/lib/campaign-types";
import {
  CAMPAIGN_LENGTH_LABELS,
  CAMPAIGN_LENGTHS,
  HP_METHOD_LABELS,
  HP_METHODS,
  STARTING_WEALTH,
  STARTING_WEALTH_LABELS,
  type CampaignLengthSetting,
  type HpMethodSetting,
  type StartingWealthSetting,
} from "@/lib/schemas/game-settings-options";
import { FieldLabel, ToggleCard } from "@/app/create-campaign/fields";
import type { StepProps } from "@/app/create-campaign/draft";
import { useT } from "@/lib/locale";

// How many, how strong, how hard. A solo table has no player count
// (maxPlayers is pinned to 1 in the payload, from the solo entry point, never
// from the count chosen here).
export function PartyBasics({ draft, patch, gates }: StepProps) {
  const t = useT();
  const { solo } = gates;
  return (
    <div className={cn("grid gap-3", solo ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
      {!solo ? (
        <div className="block">
          <FieldLabel>{t("creator.field.players")}</FieldLabel>
          <NumberStepper min={1} max={8} value={draft.maxPlayers} onChange={(maxPlayers) => patch({ maxPlayers })} label={t("creator.field.players")} />
        </div>
      ) : null}
      <div className="block">
        <FieldLabel>{t("creator.field.startLevel")}</FieldLabel>
        <NumberStepper min={1} max={20} value={draft.startingLevel} onChange={(startingLevel) => patch({ startingLevel })} label={t("creator.field.startLevel")} />
      </div>
      <label className={cn("block", !solo && "col-span-2 sm:col-span-1")}>
        <FieldLabel>
          <span className="flex items-center gap-1">
            {t("creator.field.difficulty")}
            <InfoButton label={t("creator.field.difficulty")} text={t("creator.difficulty.info", { list: difficultyList() })} />
          </span>
        </FieldLabel>
        <Select<CampaignDifficulty>
          value={draft.difficulty}
          onChange={(difficulty) => patch({ difficulty })}
          label={t("creator.field.difficulty")}
          className="w-full"
          options={CAMPAIGN_DIFFICULTIES.map((value) => ({ value, label: value }))}
        />
        {/* The chosen tier says what it means without opening anything. */}
        <p className="mt-1 text-xs text-stone-500">{CAMPAIGN_DIFFICULTY_HINTS[draft.difficulty]}</p>
      </label>
    </div>
  );
}

// The difficulty dialog's middle block: one line per tier, from the data
// file's own hints (the tiers' words stay the data's).
const difficultyList = () =>
  CAMPAIGN_DIFFICULTIES.map((value) => `**${value}**: ${CAMPAIGN_DIFFICULTY_HINTS[value]}`).join("\n\n");

// How heroes are built here. Asked at creation because the first characters
// are built before anyone opens the lobby's settings.
export function CharacterRulesFields({ draft, patch, gates }: StepProps) {
  const t = useT();
  // Named in the "follow the server" choice, so it says what it means.
  const serverRerollBelow = useServerRerollBelow();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>{t("creator.field.hpPerLevel")}</FieldLabel>
          <Select<HpMethodSetting>
            value={draft.hpMethod}
            onChange={(hpMethod) => patch({ hpMethod })}
            label={t("creator.field.hpPerLevel")}
            className="w-full"
            options={HP_METHODS.map((value) => ({ value, label: HP_METHOD_LABELS[value] }))}
          />
          <p className="mt-1 text-xs text-stone-500">{t("creator.hp.note")}</p>
        </label>
        <label className="block">
          <FieldLabel>{t("creator.field.startingWealth")}</FieldLabel>
          <Select<StartingWealthSetting>
            value={draft.startingWealth}
            onChange={(startingWealth) => patch({ startingWealth })}
            label={t("creator.field.startingWealth")}
            className="w-full"
            options={STARTING_WEALTH.map((value) => ({ value, label: STARTING_WEALTH_LABELS[value] }))}
          />
          <p className="mt-1 text-xs text-stone-500">{t("creator.wealth.note")}</p>
        </label>
        <label className="block sm:col-span-2">
          <FieldLabel>{t("creator.field.rolledStats")}</FieldLabel>
          <Select<"server" | RerollChoice>
            value={draft.abilityRerollBelow === null ? "server" : rerollChoiceOf(draft.abilityRerollBelow)}
            onChange={(choice) =>
              patch({
                abilityRerollBelow:
                  choice === "server" ? null : rerollBelowFor(choice, draft.abilityRerollBelow ?? REROLL_LOW_DEFAULT),
              })
            }
            label={t("creator.field.rolledStats")}
            className="w-full"
            options={[
              {
                value: "server",
                label:
                  serverRerollBelow === null
                    ? t("creator.reroll.followServer")
                    : t("creator.reroll.followServerWith", { rule: describeReroll(serverRerollBelow).toLowerCase() }),
              },
              { value: "keep", label: t("creator.reroll.keep") },
              { value: "low", label: t("creator.reroll.low", { total: REROLL_LOW_DEFAULT }) },
              { value: "free", label: t("creator.reroll.free") },
            ]}
          />
          <p className="mt-1 text-xs text-stone-500">{t("creator.reroll.note")}</p>
        </label>
      </div>
      <DicePolicyField draft={draft} patch={patch} gates={gates} />
    </div>
  );
}

export function DicePolicyField({ draft, patch, gates }: StepProps) {
  const t = useT();
  return (
    <div>
      <FieldLabel className="mb-1.5">{t("creator.field.dice")}</FieldLabel>
      <div className="flex gap-2">
        <ToggleCard
          active={draft.dicePolicy === "digital_only"}
          onClick={() => patch({ dicePolicy: "digital_only" })}
          label={t("creator.dice.digital")}
          hint={t("creator.dice.digitalHint")}
        />
        <ToggleCard
          active={draft.dicePolicy === "real_allowed"}
          onClick={() => patch({ dicePolicy: "real_allowed" })}
          label={t("creator.dice.real")}
          hint={gates.solo ? t("creator.dice.realHint.solo") : t("creator.dice.realHint.party")}
        />
      </div>
    </div>
  );
}

// Only an AI narrator plans a story arc, so only then is its length asked.
export function CampaignLengthField({ draft, patch, gates }: StepProps) {
  const t = useT();
  if (!gates.aiNarrates) {
    return null;
  }
  return (
    <label className="block">
      <FieldLabel>
        <span className="flex items-center gap-1">
          {t("creator.field.length")}
          <InfoButton label={t("creator.field.length")} text={t("creator.length.info")} />
        </span>
      </FieldLabel>
      <Select<CampaignLengthSetting>
        value={draft.campaignLength}
        onChange={(campaignLength) => patch({ campaignLength })}
        label={t("creator.field.length")}
        className="w-full"
        options={CAMPAIGN_LENGTHS.map((value) => ({ value, label: CAMPAIGN_LENGTH_LABELS[value] }))}
      />
      <p className="mt-1 text-xs text-stone-500">{t("creator.length.note")}</p>
    </label>
  );
}
