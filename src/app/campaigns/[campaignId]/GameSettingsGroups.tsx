"use client";

import { STAGES, isStageEnabled } from "@/lib/dm/stages";
import { DELEGATIONS } from "@/lib/dm/delegation";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { InfoButton } from "@/components/ui/InfoDialog";
import { SettingToggle, panelField } from "./PanelKit";
import { cn } from "@/lib/cn";
import { GENRE_PRESETS } from "@/lib/genres";
import type { WorldPackSummary } from "@/lib/worlds/types";
import { WorldPackGallery } from "@/components/WorldPackGallery";
import { VoicePicker } from "@/components/VoicePicker";
import { NarrationNote } from "@/app/campaigns/[campaignId]/NarrationNote";
import { CharacterVoices } from "@/app/campaigns/[campaignId]/CharacterVoices";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import { SafetyToneFields } from "@/components/SafetyToneFields";
import type { GameSettings } from "@/lib/schemas/game-settings";
import { REROLL_LOW_DEFAULT, rerollBelowFor, rerollChoiceOf, type RerollChoice } from "@/lib/srd/ability-rerolls";
import {
  CAMPAIGN_LENGTHS,
  COMPANION_LABELS,
  CONSCIENCE_SETTINGS,
  HP_METHODS,
  STARTING_WEALTH,
  TABLE_LANGUAGE_LABELS,
  TABLE_LANGUAGES,
  type CampaignLengthSetting,
  type ConscienceSetting,
  type DicePolicy,
  type Genre,
  type TableLanguage,
} from "@/lib/schemas/game-settings-options";
import { alliesShown, conscienceShown } from "@/app/campaigns/[campaignId]/table-settings-groups";
import { NarrationStyleRows } from "@/app/campaigns/[campaignId]/NarrationStyleRows";
import { useT } from "@/lib/locale";

// The bodies of the table settings' named groups (table-settings-groups.ts
// names them and says what each holds on its closed face). Every control is
// the one the single long panel drew, with the same tooltip and the same
// immediate PATCH; only the grouping changed. The words are the dictionaries'
// (table.settings.*), so each group reads in the interface's language.

type Patch = (update: Partial<GameSettings>) => void;
type Base = { settings: GameSettings; patch: Patch };

// Short forms of the character-rule settings for a settings row, as message
// keys; the long forms live in game-settings-options.ts.
export const HP_METHOD_SHORT: Record<GameSettings["hpMethod"], string> = {
  average: "table.settings.hp.short.average",
  rolled: "table.settings.hp.short.rolled",
  max: "table.settings.hp.short.max",
};
export const WEALTH_SHORT: Record<GameSettings["startingWealth"], string> = {
  equipment: "table.settings.wealth.short.equipment",
  rolled: "table.settings.wealth.short.rolled",
};

// A select is as wide as its longest option, and a flex item will not
// shrink below that on its own, so a world pack with a long name used to
// push the whole panel sideways on a phone. Capped at the row's width and
// ellipsised instead.
const selectClass = "min-w-0 max-w-full";

export function WorldGroup({
  settings,
  patch,
  packs,
  selectedPack,
}: Base & { packs: WorldPackSummary[]; selectedPack: WorldPackSummary | null }) {
  const t = useT();
  const aiNarrates = settings.dmMode !== "human";
  return (
    <>
      {packs.length ? (
        <div className="reveal flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.world")}</span>
          <Select
            size="sm"
            label={t("table.settings.world.pack")}
            value={settings.worldPack}
            placeholder={t("creator.pack.none")}
            onChange={(value) => {
              const next = packs.find((entry) => entry.id === value);
              // Genre moves with the pack, so a campaign never ends up in a
              // world whose base genre contradicts it.
              patch(next ? { worldPack: next.id, genre: next.baseGenre } : { worldPack: "" });
            }}
            options={[{ value: "", label: t("creator.pack.none") }, ...packs.map((entry) => ({ value: entry.id, label: entry.name, hint: entry.inspiredBy }))]}
            className={selectClass}
          />
          <span className="text-stone-500">
            {selectedPack ? selectedPack.inspiredBy : t("table.settings.world.packHint")}
          </span>
        </div>
      ) : null}
      {selectedPack?.cover ? (
        <div className="reveal flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPack.cover}
            alt=""
            className="h-20 w-36 rounded-md border border-amber-500/30 object-cover shadow-[0_2px_8px_rgba(4,2,12,0.5)]"
          />
        </div>
      ) : null}
      {selectedPack ? <WorldPackGallery packId={selectedPack.id} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("creator.field.setting")}</span>
        <Select<Genre>
          size="sm"
          label={t("creator.field.setting")}
          value={settings.genre}
          onChange={(genre) =>
            // Changing the genre by hand drops the pack, for the same reason
            // the creation dialog does: a pack IS its baseGenre plus
            // overrides, so the two must never disagree.
            patch({ genre, ...(settings.worldPack ? { worldPack: "" } : {}) })
          }
          options={GENRE_PRESETS.map((entry) => ({ value: entry.id as Genre, label: t(`creator.genre.${entry.id}`) }))}
          className={selectClass}
        />
        <span className="text-stone-500">{t(`creator.genre.blurb.${settings.genre}`)}</span>
      </div>
      {settings.genre === "custom" ? (
        <div className="reveal flex items-start gap-2">
          <span className="pk-rowlabel pt-1">{t("table.settings.row.world")}</span>
          <textarea
            defaultValue={settings.customGenreText}
            rows={2}
            maxLength={500}
            onBlur={(event) => patch({ customGenreText: event.target.value })}
            placeholder={t("creator.custom.placeholder")}
            aria-label={t("creator.custom.aria")}
            className={cn(panelField, "w-auto flex-1")}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.language")}</span>
        <Select<TableLanguage>
          size="sm"
          label={t("creator.details.language")}
          value={settings.tableLanguage}
          onChange={(tableLanguage) => patch({ tableLanguage })}
          options={TABLE_LANGUAGES.map((value) => ({ value, label: TABLE_LANGUAGE_LABELS[value] }))}
          className={selectClass}
        />
        <span className="text-stone-500">{t("creator.language.help")}</span>
      </div>
      {aiNarrates ? (
        <div className="reveal flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.length")}</span>
          <Tooltip content={t("table.settings.length.tip")}>
            <span className="inline-flex min-w-0 max-w-full">
              <Select<CampaignLengthSetting>
                size="sm"
                label={t("creator.field.length")}
                value={settings.campaignLength}
                onChange={(campaignLength) => patch({ campaignLength })}
                options={CAMPAIGN_LENGTHS.map((value) => ({ value, label: t(`creator.length.option.${value}`) }))}
                className={selectClass}
              />
            </span>
          </Tooltip>
        </div>
      ) : null}
    </>
  );
}

export function CharacterGroup({ settings, patch, serverRerollLabel }: Base & { serverRerollLabel: string }) {
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("creator.field.dice")}</span>
        <Tooltip content={t("table.settings.dice.tip")}>
          <span className="inline-flex min-w-0 max-w-full">
            <Select<DicePolicy>
              size="sm"
              label={t("table.settings.dice.policy")}
              value={settings.dicePolicy}
              onChange={(dicePolicy) => patch({ dicePolicy })}
              options={[
                { value: "digital_only", label: t("creator.dice.digital"), icon: { kind: "glyph", key: "tab-dice" } },
                { value: "real_allowed", label: t("creator.dice.real"), icon: { kind: "glyph", key: "die-d20" } },
              ]}
              className={selectClass}
            />
          </span>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.heroes")}</span>
        <Tooltip content={t("table.settings.hp.tip")}>
          <span className="inline-flex min-w-0 max-w-full">
            <Select
              size="sm"
              label={t("creator.field.hpPerLevel")}
              value={settings.hpMethod ?? "average"}
              onChange={(value) => patch({ hpMethod: value as GameSettings["hpMethod"] })}
              options={HP_METHODS.map((method) => ({ value: method, label: t(HP_METHOD_SHORT[method]) }))}
              className={selectClass}
            />
          </span>
        </Tooltip>
        <Tooltip content={t("table.settings.wealth.tip")}>
          <span className="inline-flex min-w-0 max-w-full">
            <Select
              size="sm"
              label={t("creator.field.startingWealth")}
              value={settings.startingWealth ?? "equipment"}
              onChange={(value) => patch({ startingWealth: value as GameSettings["startingWealth"] })}
              options={STARTING_WEALTH.map((method) => ({ value: method, label: t(WEALTH_SHORT[method]) }))}
              className={selectClass}
            />
          </span>
        </Tooltip>
        <Tooltip content={t("table.settings.reroll.tip")}>
          <span className="inline-flex min-w-0 max-w-full">
            <Select
              size="sm"
              label={t("creator.field.rolledStats")}
              value={settings.abilityRerollBelow == null ? "server" : rerollChoiceOf(settings.abilityRerollBelow)}
              onChange={(value) =>
                patch({
                  abilityRerollBelow:
                    value === "server"
                      ? null
                      : rerollBelowFor(value as RerollChoice, settings.abilityRerollBelow ?? REROLL_LOW_DEFAULT),
                })
              }
              options={[
                { value: "server", label: t("table.settings.stats", { rule: serverRerollLabel }) },
                { value: "keep", label: t("table.settings.reroll.keep") },
                { value: "low", label: t("table.settings.reroll.low", { total: rerollBelowFor("low", settings.abilityRerollBelow ?? REROLL_LOW_DEFAULT) }) },
                { value: "free", label: t("table.settings.reroll.free") },
              ]}
              className={selectClass}
            />
          </span>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.classes")}</span>
        <Tooltip content={t("table.settings.multiclass.tip")}>
          <SettingToggle on={settings.multiclassingEnabled} onToggle={() => patch({ multiclassingEnabled: !settings.multiclassingEnabled })}>
            {settings.multiclassingEnabled ? t("table.settings.multiclass.on") : t("table.settings.multiclass.off")}
          </SettingToggle>
        </Tooltip>
      </div>
    </>
  );
}

export function NarrationGroup({
  settings,
  patch,
  campaignId,
  narrating,
  narrationOff,
}: Base & { campaignId: string; narrating: boolean; narrationOff: boolean }) {
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.narration")}</span>
        <SettingToggle label={t("table.settings.row.narration")} on={narrating} disabled={narrationOff} onToggle={() => patch({ ttsEnabled: !settings.ttsEnabled })}>
          {narrating ? t("table.settings.narration.on") : narrationOff ? t("table.settings.narration.offServer") : t("table.settings.narration.off")}
        </SettingToggle>
        {narrating ? (
          <>
            <VoicePicker size="sm" label={t("table.settings.narration.voice")} value={settings.ttsVoice} onChange={(ttsVoice) => patch({ ttsVoice })} />
            <VoicePreviewButton voice={settings.ttsVoice} />
          </>
        ) : null}
      </div>
      {narrating ? <CharacterVoices campaignId={campaignId} settings={settings} steersStory patch={patch} /> : null}
      {narrating || narrationOff ? <NarrationNote /> : null}
      <p className="text-stone-500">{t("table.settings.narration.note")}</p>
    </>
  );
}

export function AtmosphereGroup({
  settings,
  patch,
  steersAudio,
  ambienceInstalled,
  ambienceCounts,
}: Base & {
  steersAudio: boolean;
  ambienceInstalled: boolean;
  ambienceCounts: Record<"bed" | "music" | "sting", { installed: number; total: number }> | null;
}) {
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.maps")}</span>
        <SettingToggle on={settings.mapsEnabled} onToggle={() => patch({ mapsEnabled: !settings.mapsEnabled })}>
          {settings.mapsEnabled ? t("table.settings.maps.on") : t("table.settings.maps.off")}
        </SettingToggle>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.faces")}</span>
        <Tooltip content={t("table.settings.theatre.tip")}>
          <SettingToggle on={settings.presentation === "theatre"} onToggle={() => patch({ presentation: settings.presentation === "theatre" ? "plain" : "theatre" })}>
            {settings.presentation === "theatre" ? t("table.settings.theatre.on") : t("table.settings.theatre.off")}
          </SettingToggle>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.ambience")}</span>
        <SettingToggle label={t("table.settings.row.ambience")} on={settings.ambienceEnabled} onToggle={() => patch({ ambienceEnabled: !settings.ambienceEnabled })}>
          {settings.ambienceEnabled ? t("table.settings.ambience.on") : t("table.settings.ambience.off")}
        </SettingToggle>
        {settings.ambienceEnabled ? (
          <Tooltip content={t("table.settings.ambienceAuto.tip")}>
            <SettingToggle on={settings.ambienceAuto} onToggle={() => patch({ ambienceAuto: !settings.ambienceAuto })}>
              {settings.ambienceAuto ? t("table.settings.ambienceAuto.on") : t("table.settings.ambienceAuto.off")}
            </SettingToggle>
          </Tooltip>
        ) : null}
        {steersAudio && settings.ambienceEnabled && !ambienceInstalled ? (
          // The catalog knows the cues but no audio is on disk, so the
          // toggle above is currently a promise of silence. Say so where
          // it is being switched on rather than letting the table wonder.
          <span className="text-stone-500">{t("table.settings.ambience.missing")}</span>
        ) : steersAudio && settings.ambienceEnabled && ambienceCounts ? (
          <span className="text-stone-500">
            {t("table.settings.ambience.coverage", {
              beds: ambienceCounts.bed.installed,
              bedTotal: ambienceCounts.bed.total,
              music: ambienceCounts.music.installed,
              musicTotal: ambienceCounts.music.total,
              stings: ambienceCounts.sting.installed,
              stingTotal: ambienceCounts.sting.total,
            })}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function SafetyGroup({ settings, patch }: Base) {
  return (
    <SafetyToneFields
      safety={settings.safety}
      gm={settings.gm}
      ttsVoice={settings.ttsVoice}
      onSafety={(safety) => patch({ safety })}
      onGm={(gm) => patch({ gm })}
      onVoice={(ttsVoice) => patch({ ttsVoice })}
    />
  );
}

// The Living World explainer, shared with the campaign creator's info
// button so the two never drift.
export const LIVING_WORLD_INFO = [
  "On: the world moves without you. Off-screen storylines advance on background dice each turn, so rival factions, threats, and distant events keep developing while you play.",
  "NPCs pursue their own goals between chapters and during rests and travel. Schemes progress, pressure builds, and rivals can collide with each other.",
  "The GM quietly records what happened off-screen and weaves it into future scenes, ambushes, and rumors. These simulation notes are GM-only until the party discovers them in play.",
  "Off: all of that pauses. The world changes only when your party acts or the story arc calls for it. Your main story arc, chapters, quests, and XP work exactly the same either way.",
  "You can switch this at any time. Turning it back on resumes from the world as it currently stands.",
].join("\n\n");

export function AiGroup({ settings, patch }: Base) {
  const t = useT();
  const aiNarrates = settings.dmMode !== "human";
  return (
    <>
      {settings.dmMode === "assisted" ? (
        // Only in the middle setting. A table the AI runs has nothing to
        // delegate and a table running itself has chosen not to, so showing
        // three switched-off switches in either would be noise.
        <div className="flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.aiHelps")}</span>
          {DELEGATIONS.map((which) => (
            <Tooltip key={which} content={t(`table.settings.assist.${which}.tip`)}>
              <SettingToggle
                on={settings.dmAssist[which]}
                onToggle={() => patch({ dmAssist: { ...settings.dmAssist, [which]: !settings.dmAssist[which] } })}
              >
                {t(`table.settings.assist.${which}.label`)}
              </SettingToggle>
            </Tooltip>
          ))}
        </div>
      ) : null}
      {aiNarrates ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.setup")}</span>
          <SettingToggle on={settings.aiStorySetup} onToggle={() => patch({ aiStorySetup: !settings.aiStorySetup })}>
            {settings.aiStorySetup ? t("table.settings.storySetup.on") : t("table.settings.storySetup.off")}
          </SettingToggle>
          <span className="text-stone-500">
            {settings.aiStorySetup ? t("table.settings.storySetup.hint.on") : t("table.settings.storySetup.hint.off")}
          </span>
        </div>
      ) : null}
      {aiNarrates ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.prose")}</span>
          <Tooltip content={t("table.settings.guard.tip")}>
            <SettingToggle on={settings.narrationGuard} onToggle={() => patch({ narrationGuard: !settings.narrationGuard })}>
              {settings.narrationGuard ? t("table.settings.guard.on") : t("table.settings.guard.off")}
            </SettingToggle>
          </Tooltip>
          <span className="text-stone-500">
            {settings.narrationGuard ? t("table.settings.guard.hint.on") : t("table.settings.guard.hint.off")}
          </span>
        </div>
      ) : null}
      {aiNarrates ? <NarrationStyleRows settings={settings} patch={patch} /> : null}
      {aiNarrates ? (
        <div className="reveal flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.world")}</span>
          <Tooltip content={t("table.settings.livingWorld.tip")}>
            <SettingToggle on={settings.worldSimulation} onToggle={() => patch({ worldSimulation: !settings.worldSimulation })}>
              {settings.worldSimulation ? t("table.settings.livingWorld.on") : t("table.settings.livingWorld.off")}
            </SettingToggle>
          </Tooltip>
          <InfoButton label={t("creator.info.livingWorld")} text={t("table.settings.info.livingWorld")} />
          <span className="text-stone-500">
            {settings.worldSimulation
              ? t("table.settings.livingWorld.hint.on")
              : t("table.settings.livingWorld.hint.off")}
          </span>
        </div>
      ) : null}
      {/* At a table a person runs, Auto already allows the lasting allies
          the DM plays by hand, so the row stays out of the way; it shows
          when an Off or guests-only setting carried over from an AI table
          shuts them out, which is where the Party panel's handoff points
          (issue 209). */}
      {alliesShown(settings) ? (
        <div data-settings-row="allies" className="reveal flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.group.allies")}</span>
          <Tooltip content={t("table.settings.allies.tip")}>
            <span className="inline-flex min-w-0 max-w-full">
              <Select<GameSettings["companions"]>
                size="sm"
                label={t("table.settings.allies.label")}
                value={settings.companions}
                onChange={(companions) => patch({ companions })}
                options={(Object.keys(COMPANION_LABELS) as Array<GameSettings["companions"]>).map((mode) => ({ value: mode, label: t(`table.settings.companions.${mode}`) }))}
                className={selectClass}
              />
            </span>
          </Tooltip>
          {settings.companions !== "off" ? (
            <>
              {settings.companions !== "guests" ? (
                <span className="inline-flex min-w-0 max-w-full" title={t("table.settings.maxCompanions.tip")}>
                  <Select
                    size="sm"
                    label={t("table.settings.maxCompanions.tip")}
                    value={String(settings.maxCompanions)}
                    onChange={(value) => patch({ maxCompanions: Number(value) })}
                    options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: t("table.settings.maxCompanions.option", { count }) }))}
                    className={selectClass}
                  />
                </span>
              ) : null}
              <span className="inline-flex min-w-0 max-w-full" title={t("table.settings.maxGuests.tip")}>
                <Select
                  size="sm"
                  label={t("table.settings.maxGuests.tip")}
                  value={String(settings.maxGuests)}
                  onChange={(value) => patch({ maxGuests: Number(value) })}
                  options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: t("table.settings.maxGuests.option", { count }) }))}
                  className={selectClass}
                />
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// The narrator's pipeline. Optional tuning: every table starts with all of
// it on, and the line under the switches says so.
export function MemoryGroup({ settings, patch }: Base) {
  const t = useT();
  return (
    <>
      <p className="text-stone-500">{t("table.settings.memory.intro")}</p>
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {STAGES.map((stage) => {
          const on = isStageEnabled(settings.stages, stage.id);
          return (
            <Tooltip key={stage.id} content={`${stage.description} ${stage.cost}`}>
              <SettingToggle on={on} onToggle={() => patch({ stages: { ...settings.stages, [stage.id]: !on } })}>
                {stage.label} {on ? t("table.settings.word.on") : t("table.settings.word.off")}
                {/* Only a model-call stage buys back GPU time; saying so
                    stops an operator disabling recall expecting a speedup. */}
                <span className="ml-1 text-[11px] text-stone-500">
                  {stage.callsModel ? t("table.settings.stage.model") : t("table.settings.stage.engine")}
                </span>
              </SettingToggle>
            </Tooltip>
          );
        })}
      </div>
    </>
  );
}

export function BondsGroup({ settings, patch, lastingCompanions = false }: Base & { lastingCompanions?: boolean }) {
  const t = useT();
  return (
    <>
    <div className="flex flex-wrap items-center gap-2">
      <span className="pk-rowlabel">{t("table.settings.row.bonds")}</span>
      <Tooltip content={t("table.settings.bonds.tip")}>
        <SettingToggle on={settings.relationships !== "off"} onToggle={() => patch({ relationships: settings.relationships === "off" ? "on" : "off" })}>
          {settings.relationships !== "off" ? t("table.settings.bonds.on") : t("table.settings.bonds.off")}
        </SettingToggle>
      </Tooltip>
      {settings.relationships !== "off" ? (
        <Tooltip content={t("table.settings.romance.tip")}>
          <SettingToggle on={settings.romance !== "off"} onToggle={() => patch({ romance: settings.romance === "off" ? "on" : "off" })}>
            {settings.romance !== "off" ? t("table.settings.romance.on") : t("table.settings.romance.off")}
          </SettingToggle>
        </Tooltip>
      ) : null}
      <span className="text-stone-500">
        {settings.relationships === "off"
          ? t("table.settings.bonds.hint.off")
          : settings.romance !== "off"
            ? t("table.settings.bonds.hint.romance")
            : t("table.settings.bonds.hint.only")}
      </span>
    </div>
    {/* Only where it can matter: bonds on and a lasting companion possible
        at this table (AGENTS.md settings rule 4). */}
    {conscienceShown(settings, lastingCompanions) ? (
      <div data-settings-row="conscience" className="reveal flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.conscience")}</span>
        <Tooltip content={t("table.settings.conscience.tip")}>
          <span className="inline-flex min-w-0 max-w-full">
            <Select<ConscienceSetting>
              size="sm"
              label={t("table.settings.conscience.label")}
              value={settings.companionConscience ?? "leave"}
              onChange={(companionConscience) => patch({ companionConscience })}
              options={CONSCIENCE_SETTINGS.map((setting) => ({ value: setting, label: t(`table.settings.conscience.choice.${setting}`) }))}
              className={selectClass}
            />
          </span>
        </Tooltip>
        <InfoButton label={t("table.settings.conscience.info")} text={t("table.settings.info.conscience")} />
        <span key={settings.companionConscience ?? "leave"} className="live-in text-stone-500">
          {t(`table.settings.conscience.hint.${settings.companionConscience ?? "leave"}`)}
        </span>
      </div>
    ) : null}
    </>
  );
}

// Wait for the table (src/lib/dm/table-wait.ts) as one picker: the DM answers
// the first post, or waits for everyone with a choice of how long a quiet
// table holds it (15 to 900 seconds allowed). A stored length that is not
// one of the choices is offered as itself.
const WAIT_CHOICES = [30, 60, 120, 180, 300, 600, 900];
function waitLabel(t: (key: string, vars?: Record<string, string | number>) => string, seconds: number) {
  return t("table.settings.pacing.wait", { time: seconds % 60 ? `${seconds}s` : `${seconds / 60} min` });
}
function pacingOptions(t: (key: string, vars?: Record<string, string | number>) => string, seconds: number) {
  const lengths = WAIT_CHOICES.includes(seconds) ? WAIT_CHOICES : [...WAIT_CHOICES, seconds].sort((a, b) => a - b);
  // "0": no wait, the first post wakes the DM.
  return [{ value: "0", label: t("table.settings.pacing.first") }, ...lengths.map((length) => ({ value: String(length), label: waitLabel(t, length) }))];
}

// `solo`: a table of one, where nobody else could be waited for.
export function PlayersGroup({ settings, patch, solo = false }: Base & { solo?: boolean }) {
  const t = useT();
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.joining")}</span>
        <Tooltip content={t("table.settings.join.tip")}>
          <SettingToggle on={settings.midGameJoinOpen} onToggle={() => patch({ midGameJoinOpen: !settings.midGameJoinOpen })}>
            {settings.midGameJoinOpen ? t("table.settings.join.on") : t("table.settings.join.off")}
          </SettingToggle>
        </Tooltip>
        <Tooltip content={t("table.settings.hold.tip")}>
          <SettingToggle on={settings.holdSubmissions} onToggle={() => patch({ holdSubmissions: !settings.holdSubmissions })}>
            {settings.holdSubmissions ? t("table.settings.hold.on") : t("table.settings.hold.off")}
          </SettingToggle>
        </Tooltip>
      </div>
      {/* Only where it can matter: an AI turn to hold, and someone else to
          wait for. */}
      {!solo && settings.dmMode !== "human" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="pk-rowlabel">{t("table.settings.row.pacing")}</span>
          <Select
            size="sm"
            label={t("table.settings.pacing.label")}
            value={settings.waitForTable ? String(settings.waitForTableSeconds) : "0"}
            onChange={(value) => patch(Number(value) ? { waitForTable: true, waitForTableSeconds: Number(value) } : { waitForTable: false })}
            options={pacingOptions(t, settings.waitForTableSeconds)}
            className={selectClass}
          />
          <InfoButton label={t("table.settings.pacing.info")} text={t("table.settings.info.pacing")} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.items")}</span>
        <Tooltip content={t("table.settings.items.tip")}>
          <SettingToggle on={settings.inventoryApprovals} onToggle={() => patch({ inventoryApprovals: !settings.inventoryApprovals })}>
            {settings.inventoryApprovals ? t("table.settings.items.on") : t("table.settings.items.off")}
          </SettingToggle>
        </Tooltip>
        <span className="text-stone-500">
          {settings.inventoryApprovals
            ? t("table.settings.items.hint.on")
            : t("table.settings.items.hint.off")}
        </span>
      </div>
      <div className="pk-row">
        <span className="pk-rowlabel">{t("table.settings.row.vitals")}</span>
        <Tooltip content={t("table.settings.vitals.tip")}>
          <SettingToggle on={settings.vitalsApprovals} onToggle={() => patch({ vitalsApprovals: !settings.vitalsApprovals })}>
            {settings.vitalsApprovals ? t("table.settings.vitals.on") : t("table.settings.vitals.off")}
          </SettingToggle>
        </Tooltip>
        <span className="text-stone-500">
          {settings.vitalsApprovals
            ? t("table.settings.vitals.hint.on")
            : t("table.settings.vitals.hint.off")}
        </span>
      </div>
    </>
  );
}

// Only the DM seat is ever nudged, so this group does not exist for a table
// the AI narrates: there, the story is typed by definition.
export function ConsoleGroup({ settings, patch }: Base) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="pk-rowlabel">{t("table.settings.row.remind")}</span>
      <Tooltip content={t("table.settings.remind.tip")}>
        <span className="inline-flex min-w-0 max-w-full">
          <Select
            size="sm"
            label={t("table.settings.remind.actions.label")}
            value={String(settings.beatReminder.messages)}
            onChange={(value) => patch({ beatReminder: { ...settings.beatReminder, messages: Number(value) } })}
            options={[0, 5, 10, 20, 40].map((count) => ({ value: String(count), label: count === 0 ? t("table.settings.remind.actions.never") : t("table.settings.summary.remindActions", { count }) }))}
            className={selectClass}
          />
        </span>
      </Tooltip>
      <span className="inline-flex min-w-0 max-w-full" title={t("table.settings.remind.rolls.tempo")}>
        <Select
          size="sm"
          label={t("table.settings.remind.rolls.label")}
          value={String(settings.beatReminder.rolls)}
          onChange={(value) => patch({ beatReminder: { ...settings.beatReminder, rolls: Number(value) } })}
          options={[0, 6, 12, 24, 48].map((count) => ({ value: String(count), label: count === 0 ? t("table.settings.remind.rolls.never") : t("table.settings.summary.remindRolls", { count }) }))}
          className={selectClass}
        />
      </span>
    </div>
  );
}

export function BoardGroup({ settings, patch }: Base) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="pk-rowlabel">{t("table.settings.row.board")}</span>
      <Tooltip content={t("table.settings.board.tip")}>
        <SettingToggle on={settings.boardDrawing} onToggle={() => patch({ boardDrawing: !settings.boardDrawing })}>
          {settings.boardDrawing ? t("table.settings.board.players") : t("table.settings.board.gm")}
        </SettingToggle>
      </Tooltip>
      <Tooltip content={t("table.settings.intent.tip")}>
        <SettingToggle on={settings.enemyIntent} onToggle={() => patch({ enemyIntent: !settings.enemyIntent })}>
          {settings.enemyIntent ? t("table.settings.intent.on") : t("table.settings.intent.off")}
        </SettingToggle>
      </Tooltip>
    </div>
  );
}

// Live voice chat. The rules below are a list rather than a single
// proximity checkbox on purpose: "players only hear people within 30 feet"
// is one table's house rule, and the next table will want a different one.
// They are all inputs to one function (src/lib/voice/audibility.ts).
export function VoiceChatGroup({ settings, patch, transcribes }: Base & { transcribes: boolean }) {
  const t = useT();
  const rules = settings.voice.rules;
  const setRule = (change: Partial<GameSettings["voice"]["rules"]>) => patch({ voice: { ...settings.voice, rules: { ...rules, ...change } } });
  return (
    <>
      <p className="text-stone-500">{t("table.settings.voice.intro")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pk-rowlabel">{t("table.settings.row.voice")}</span>
        <Tooltip content={t("table.settings.voice.tip")}>
          <SettingToggle on={settings.voice.enabled} onToggle={() => patch({ voice: { ...settings.voice, enabled: !settings.voice.enabled } })}>
            {settings.voice.enabled ? t("table.settings.voice.on") : t("table.settings.voice.off")}
          </SettingToggle>
        </Tooltip>
        {settings.voice.enabled ? (
          <>
            <Tooltip content={t("table.settings.turnFloor.tip")}>
              <span className="inline-flex min-w-0 max-w-full">
                <Select<"off" | "soft" | "strict">
                  size="sm"
                  label={t("table.settings.turnFloor.label")}
                  value={settings.voice.turnEnforcement}
                  onChange={(turnEnforcement) => patch({ voice: { ...settings.voice, turnEnforcement } })}
                  options={[
                    { value: "off", label: t("creator.voiceChat.turns.off") },
                    { value: "soft", label: t("creator.voiceChat.turns.soft") },
                    { value: "strict", label: t("creator.voiceChat.turns.strict") },
                  ]}
                  className={selectClass}
                />
              </span>
            </Tooltip>
            <Tooltip content={transcribes ? t("table.settings.transcribe.tip.on") : t("table.settings.transcribe.tip.off")}>
              <SettingToggle
                on={settings.voice.transcribe && transcribes}
                disabled={!transcribes}
                onToggle={() => patch({ voice: { ...settings.voice, transcribe: !settings.voice.transcribe } })}
              >
                {!transcribes
                  ? t("table.settings.transcribe.offServer")
                  : settings.voice.transcribe
                    ? t("table.settings.transcribe.on")
                    : t("table.settings.transcribe.off")}
              </SettingToggle>
            </Tooltip>
            <Tooltip content={t("table.settings.proximity.tip")}>
              <SettingToggle on={rules.proximity} onToggle={() => setRule({ proximity: !rules.proximity })}>
                {rules.proximity ? t("table.settings.proximity.on") : t("table.settings.proximity.off")}
              </SettingToggle>
            </Tooltip>
            {rules.proximity ? (
              <>
                <span className="inline-flex min-w-0 max-w-full" title={t("table.settings.range.tip")}>
                  <Select
                    size="sm"
                    label={t("table.settings.range.tip")}
                    value={String(rules.hearingRangeFeet)}
                    onChange={(value) => setRule({ hearingRangeFeet: Number(value) })}
                    options={[15, 30, 60, 120].map((feet) => ({ value: String(feet), label: t("creator.voiceChat.feet", { feet }) }))}
                    className={selectClass}
                  />
                </span>
                <Tooltip content={t("table.settings.sayRange.tip")}>
                  <SettingToggle on={rules.sayRange} onToggle={() => setRule({ sayRange: !rules.sayRange })}>
                    {rules.sayRange ? t("table.settings.sayRange.on") : t("table.settings.sayRange.off")}
                  </SettingToggle>
                </Tooltip>
                <Tooltip content={t("table.settings.walls.tip")}>
                  <SettingToggle on={rules.wallsAttenuate} onToggle={() => setRule({ wallsAttenuate: !rules.wallsAttenuate })}>
                    {rules.wallsAttenuate ? t("table.settings.walls.on") : t("table.settings.walls.off")}
                  </SettingToggle>
                </Tooltip>
              </>
            ) : null}
            <Tooltip content={t("table.settings.downed.tip")}>
              <SettingToggle on={rules.downedGoDeaf} onToggle={() => setRule({ downedGoDeaf: !rules.downedGoDeaf })}>
                {rules.downedGoDeaf ? t("table.settings.downed.on") : t("table.settings.downed.off")}
              </SettingToggle>
            </Tooltip>
          </>
        ) : null}
      </div>
    </>
  );
}
