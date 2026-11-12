"use client";

import { InfoButton } from "@/components/ui/InfoDialog";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { NarratorLanguageNote, VoicePicker } from "@/components/VoicePicker";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import type { GameSettings } from "@/lib/schemas/game-settings";
import { COMPANION_LABELS } from "@/lib/schemas/game-settings-options";
import { FieldLabel, ToggleCard } from "@/app/create-campaign/fields";
import { SheetRows } from "@/app/create-campaign/SheetRows";
import type { StepProps } from "@/app/create-campaign/draft";
import { useT } from "@/lib/locale";

// Where a campaign's characters get their own voices once it has any:
// CharacterVoices inside the Game settings panel, which the lobby shows and
// the table's Settings tab shows again.
export const CHARACTER_VOICES_PLACE = "the Character voices list in Table settings (Narration and character voices), in the lobby or the table's Settings tab";

export const CASTING_INFO = `Two choices decide who reads a line aloud.\n\n**The narrator's voice and pace** read the story, and every speaker who has no voice of their own.\n\n**Character voices** belong to one speaker each. With *Each speaker gets a voice*, everyone who speaks (an innkeeper, a monster, a companion) is given one of this server's voices the first time they talk and keeps it from then on. With *The narrator reads them*, nobody is given one automatically, and any voice you do give a character still plays.\n\nEither way, a voice can be given or changed per character once the campaign has people in it: ${CHARACTER_VOICES_PLACE}. Each player can also choose the voice their own character speaks in there.\n\nThis is the table's spoken narration. Live voice chat between players is a separate setting.`;

// Spoken narration and who voices the characters, together, because one
// decides whether the other matters. The narrator and casting choices stay
// in the draft while narration is off, so turning it back on finds them as
// they were. A server with no speech service keeps the switch visible and
// says why it is off.
export function NarrationFields(props: StepProps & { onFlip?: () => void }) {
  const t = useT();
  const { draft, patch, gates } = props;
  return (
    <div className="space-y-3">
      <SheetRows {...props} keys={["ttsEnabled"]} />
      {!gates.ttsAvailable ? (
        <p className="text-xs text-stone-500">
          {t("narrator.noService")}
        </p>
      ) : null}
      {draft.ttsEnabled ? (
        <>
          <div className="block">
            <FieldLabel>{t("narrator.voiceLabel")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <VoicePicker value={draft.ttsVoice} onChange={(ttsVoice) => patch({ ttsVoice })} label={t("narrator.voiceLabel")} className="grow" language={draft.tableLanguage} />
              <VoicePreviewButton voice={draft.ttsVoice} />
              <span className="flex items-center gap-2 text-xs text-stone-400">
                {t("narrator.pace")}
                <span className="w-28">
                  <Slider
                    label={t("narrator.paceLabel")}
                    min={0.7}
                    max={1.4}
                    step={0.05}
                    value={draft.ttsSpeed}
                    onChange={(ttsSpeed) => patch({ ttsSpeed })}
                    bubble={(speed) => speed.toFixed(2)}
                  />
                </span>
                <span className="w-8 text-stone-500">{draft.ttsSpeed.toFixed(2)}</span>
              </span>
            </div>
            <NarratorLanguageNote language={draft.tableLanguage} />
          </div>
          <div>
            <FieldLabel className="mb-1.5">
              <span className="flex items-center gap-1">
                {t("narrator.whoTitle")}
                <InfoButton label={t("narrator.whoLabel")} text={t("creator.info.casting")} />
              </span>
            </FieldLabel>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ToggleCard
                active={!draft.ttsAutoCast}
                onClick={() => patch({ ttsAutoCast: false })}
                label={t("narrator.readThem")}
                hint={t("narrator.readThemHint")}
              />
              <ToggleCard
                active={draft.ttsAutoCast}
                onClick={() => patch({ ttsAutoCast: true })}
                label={t("narrator.eachVoice")}
                hint={t("narrator.eachVoiceHint")}
              />
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
              {draft.ttsAutoCast
                ? t("narrator.eachNote")
                : t("narrator.readNote")}
              {t("narrator.changeLater", { place: t("creator.casting.place") })}
            </p>
          </div>
        </>
      ) : gates.ttsAvailable ? (
        <p className="text-xs text-stone-500">
          {t("narrator.offNote")}
        </p>
      ) : null}
    </div>
  );
}

// Who else the AI brings to the table. Allies only exist when the AI
// narrates; the limits appear once a mode that uses them is chosen.
export function AlliesFields({ draft, patch, gates }: StepProps) {
  const t = useT();
  const { aiNarrates, solo } = gates;
  if (!aiNarrates) {
    return null;
  }
  return (
    <div>
      <FieldLabel className="mb-1.5">{t("narrator.allies")}</FieldLabel>
      <Select<GameSettings["companions"]>
        value={draft.companions}
        onChange={(companions) => patch({ companions })}
        label={t("narrator.allies")}
        className="w-full"
        options={(Object.keys(COMPANION_LABELS) as Array<GameSettings["companions"]>).map((mode) => ({ value: mode, label: COMPANION_LABELS[mode] }))}
      />
      <p className="mt-1 text-xs text-stone-500">
        {solo
          ? t("narrator.alliesSolo")
          : t("narrator.alliesTable")}
      </p>
      {draft.companions !== "off" ? (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {draft.companions !== "guests" ? (
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t("narrator.partyAtOnce")}</span>
              <Select<string>
                value={String(draft.maxCompanions)}
                onChange={(count) => patch({ maxCompanions: Number(count) })}
                label={t("narrator.partyAtOnce")}
                className="w-full"
                options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs text-stone-500">Guests at once</span>
            <Select<string>
              value={String(draft.maxGuests)}
              onChange={(count) => patch({ maxGuests: Number(count) })}
              label="Guests at once"
              className="w-full"
              options={[1, 2, 3, 4].map((count) => ({ value: String(count), label: String(count) }))}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
