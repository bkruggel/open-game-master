"use client";

import { Select } from "@/components/ui/Select";
import type { GameSettings } from "@/lib/schemas/game-settings";
import { FieldLabel, ToggleCard } from "@/app/create-campaign/fields";
import { useT } from "@/lib/locale";

type VoiceSettings = GameSettings["voice"];

// Live voice for a multiplayer table: the master switch, then the turn
// floor and the proximity rules that only mean something once it is on.
// A solo table never mounts this block; there is nobody to talk to.
export function VoiceChatFields({
  value,
  onChange,
}: {
  value: VoiceSettings;
  onChange: (next: VoiceSettings) => void;
}) {
  const t = useT();
  const setRule = (rules: Partial<VoiceSettings["rules"]>) =>
    onChange({ ...value, rules: { ...value.rules, ...rules } });
  return (
    <div>
      <FieldLabel className="mb-1.5">{t("creator.voiceChat.label")}</FieldLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ToggleCard
          active={value.enabled}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          label={t("creator.voiceChat.label")}
          hint={t("creator.voiceChat.hint")}
        />
        {value.enabled ? (
          <>
            <label className="block">
              <span className="mb-1 block text-xs text-stone-500">{t("creator.voiceChat.turnFloor")}</span>
              <Select<VoiceSettings["turnEnforcement"]>
                value={value.turnEnforcement}
                onChange={(turnEnforcement) => onChange({ ...value, turnEnforcement })}
                label={t("creator.voiceChat.turnFloor")}
                className="w-full"
                options={[
                  { value: "off", label: t("creator.voiceChat.turns.off") },
                  { value: "soft", label: t("creator.voiceChat.turns.soft") },
                  { value: "strict", label: t("creator.voiceChat.turns.strict") },
                ]}
              />
            </label>
            <ToggleCard
              active={value.rules.proximity}
              onClick={() => setRule({ proximity: !value.rules.proximity })}
              label={t("creator.voiceChat.proximity")}
              hint={t("creator.voiceChat.proximityHint")}
            />
            {value.rules.proximity ? (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs text-stone-500">{t("creator.voiceChat.range")}</span>
                  <Select<string>
                    value={String(value.rules.hearingRangeFeet)}
                    onChange={(feet) => setRule({ hearingRangeFeet: Number(feet) })}
                    label={t("creator.voiceChat.range")}
                    className="w-full"
                    options={[15, 30, 60, 120].map((feet) => ({ value: String(feet), label: t("creator.voiceChat.feet", { feet }) }))}
                  />
                </label>
                <ToggleCard
                  active={value.rules.sayRange}
                  onClick={() => setRule({ sayRange: !value.rules.sayRange })}
                  label={t("creator.voiceChat.sayRange")}
                  hint={t("creator.voiceChat.sayRangeHint")}
                />
                <ToggleCard
                  active={value.rules.wallsAttenuate}
                  onClick={() => setRule({ wallsAttenuate: !value.rules.wallsAttenuate })}
                  label={t("creator.voiceChat.walls")}
                  hint={t("creator.voiceChat.wallsHint")}
                />
              </>
            ) : null}
            <ToggleCard
              active={value.rules.downedGoDeaf}
              onClick={() => setRule({ downedGoDeaf: !value.rules.downedGoDeaf })}
              label={t("creator.voiceChat.downed")}
              hint={t("creator.voiceChat.downedHint")}
            />
          </>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-stone-500">{t("creator.voiceChat.note")}</p>
    </div>
  );
}
