"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
import { VoicePreviewButton } from "@/components/VoicePreviewButton";
import { InfoButton } from "@/components/ui/InfoDialog";
import {
  BOUNDARIES,
  STRICTNESS,
  TONES,
  TONE_MAX,
  type Boundaries,
  type GmSettings,
  type SafetySettings,
  type Strictness,
  type Tone,
} from "@/lib/dm/safety-logic";
import type { Personality } from "@/lib/dm/personalities";
import { personalityKey } from "@/lib/dm/personality-labels";

// Safety, strictness and tone (docs/vtt-parity-implementation-plan.md
// section 9), shared by the creation wizard's Feel step and the lobby's
// settings. Lines and veils are typed as lists; the boundary, strictness
// and tone are chips; a personality preset fills strictness, tone and the
// narrator's voice at once. The words are the dictionaries' (creator.*),
// except the tone chips, which are the GM brief's own vocabulary.

const chip = "rounded-md border px-2 py-0.5 text-[11px]";
const on = "border-amber-700 bg-amber-950/40 text-amber-100";
const off = "border-stone-700 text-stone-400 hover:text-stone-200";

export const BOUNDARY_LABELS: Record<Boundaries, string> = { family: "creator.summary.boundary.family", standard: "creator.summary.boundary.standard", mature: "creator.summary.boundary.mature" };
export const STRICTNESS_LABELS: Record<Strictness, string> = { lenient: "creator.safety.strictness.lenient", standard: "creator.safety.strictness.standard", harsh: "creator.safety.strictness.harsh" };

function ListField({ label, hint, value, onChange }: { label: string; hint: string; value: string[]; onChange: (next: string[]) => void }) {
  // Typed as one line and kept as a list on blur, so a half-typed entry is
  // never cut at its comma. A list changed from outside (saved defaults laid
  // over a new campaign) replaces the line, so the box never shows an old one.
  const joined = value.join(", ");
  const [text, setText] = useState(joined);
  const [shown, setShown] = useState(joined);
  if (joined !== shown) {
    setShown(joined);
    setText(joined);
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-stone-400">{label}</span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onChange(text.split(",").map((entry) => entry.trim()).filter(Boolean).slice(0, 12))}
        placeholder={hint}
        className="w-full rounded-md border border-stone-700 bg-stone-950 px-2 py-1 text-xs text-stone-200 outline-none focus:border-amber-600"
      />
    </label>
  );
}

// Every personality and what it does, for the ⓘ beside them: a preset's
// blurb was only ever a hover title. A stock preset reads its keyed name and
// blurb; a personality a user wrote reads its own words.
function personalitiesInfo(t: (key: string, vars?: Record<string, string | number>) => string, presets: Personality[], setsVoice: boolean): string {
  const lines = presets.map((preset) => {
    const nameKey = personalityKey("name", preset.name);
    const blurbKey = personalityKey("blurb", preset.name);
    return `**${nameKey ? t(nameKey) : preset.name}**: ${blurbKey ? t(blurbKey) : preset.blurb}`;
  });
  return `${lines.join("\n\n")}\n\n${t("creator.personality.infoTail", { tail: setsVoice ? t("creator.safety.voiceTail") : "" })}`;
}

export function SafetyToneFields({
  safety,
  gm,
  ttsVoice,
  onSafety,
  onGm,
  onVoice,
  showPresets = true,
}: {
  safety: SafetySettings;
  gm: GmSettings;
  ttsVoice?: string;
  onSafety: (next: SafetySettings) => void;
  onGm: (next: GmSettings) => void;
  onVoice?: (voice: string) => void;
  showPresets?: boolean;
}) {
  const t = useT();
  const [presets, setPresets] = useState<Personality[]>([]);
  useEffect(() => {
    if (!showPresets) {
      return;
    }
    let cancelled = false;
    fetch("/api/personalities")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { personalities?: Personality[] } | null) => {
        if (!cancelled) {
          setPresets(data?.personalities ?? []);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showPresets]);
  const chosenPreset = presets.find(
    (preset) => preset.gm.strictness === gm.strictness && preset.gm.tone.join() === gm.tone.join() && (!ttsVoice || preset.ttsVoice === ttsVoice),
  );
  const toggleTone = (tone: Tone) => {
    const has = gm.tone.includes(tone);
    if (!has && gm.tone.length >= TONE_MAX) {
      return;
    }
    onGm({ ...gm, tone: has ? gm.tone.filter((entry) => entry !== tone) : [...gm.tone, tone] });
  };
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-stone-500">{t("creator.safety.heading")}</p>
        <div data-pill-group="" className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={safety.xCard} onClick={() => onSafety({ ...safety, xCard: !safety.xCard })} className={cn(chip, safety.xCard ? on : off)}>
            {safety.xCard ? t("creator.summary.xCard.on") : t("creator.summary.xCard.off")}
          </button>
          {BOUNDARIES.map((boundary) => (
            <button data-on={safety.boundaries === boundary ? "" : undefined} key={boundary} type="button" aria-pressed={safety.boundaries === boundary} onClick={() => onSafety({ ...safety, boundaries: boundary })} className={cn(chip, safety.boundaries === boundary ? on : off)}>
              {t(BOUNDARY_LABELS[boundary])}
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <ListField label={t("creator.safety.linesLabel")} hint={t("creator.safety.linesHint")} value={safety.lines} onChange={(lines) => onSafety({ ...safety, lines })} />
          <ListField label={t("creator.safety.veilsLabel")} hint={t("creator.safety.veilsHint")} value={safety.veils} onChange={(veils) => onSafety({ ...safety, veils })} />
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-stone-500">{t("creator.safety.strictnessLabel")}</p>
        <div data-pill-group="" className="flex flex-wrap items-center gap-1.5">
          {STRICTNESS.map((level) => (
            <button data-on={gm.strictness === level ? "" : undefined} key={level} type="button" aria-pressed={gm.strictness === level} onClick={() => onGm({ ...gm, strictness: level })} className={cn(chip, gm.strictness === level ? on : off)}>
              {t(STRICTNESS_LABELS[level])}
            </button>
          ))}
        </div>
        <div className="stagger-pop mt-1.5 flex flex-wrap items-center gap-1.5">
          {TONES.map((tone) => (
            <button key={tone} type="button" aria-pressed={gm.tone.includes(tone)} onClick={() => toggleTone(tone)} className={cn(chip, gm.tone.includes(tone) ? on : off)}>
              {tone}
            </button>
          ))}
          <span className="text-[10px] text-stone-600">{t("creator.safety.upToThree")}</span>
        </div>
      </div>
      {showPresets && presets.length ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wide text-stone-500">
            {t("creator.safety.orPick")}
            <InfoButton label={t("creator.safety.personalities")} text={personalitiesInfo(t, presets, Boolean(onVoice))} />
          </p>
          <div className="stagger-pop flex flex-wrap items-center gap-1.5">
            {presets.map((preset) => {
              const active = preset.gm.strictness === gm.strictness && preset.gm.tone.join() === gm.tone.join() && (!ttsVoice || preset.ttsVoice === ttsVoice);
              const nameKey = personalityKey("name", preset.name);
              const blurbKey = personalityKey("blurb", preset.name);
              const name = nameKey ? t(nameKey) : preset.name;
              const blurb = blurbKey ? t(blurbKey) : preset.blurb;
              return (
                <button
                  key={preset.id}
                  type="button"
                  title={blurb}
                  aria-pressed={active}
                  onClick={() => {
                    onGm({ strictness: preset.gm.strictness, tone: [...preset.gm.tone] });
                    onVoice?.(preset.ttsVoice);
                  }}
                  className={cn(chip, active ? on : off)}
                >
                  {name}
                </button>
              );
            })}
            {ttsVoice ? <VoicePreviewButton voice={ttsVoice} /> : null}
          </div>
          {/* The chosen personality says what it is without a hover, which a
              finger never makes. */}
          {chosenPreset ? (
            <p className="mt-1 text-[11px] text-stone-500">
              {personalityKey("name", chosenPreset.name) ? t(personalityKey("name", chosenPreset.name)!) : chosenPreset.name}:{" "}
              {personalityKey("blurb", chosenPreset.name) ? t(personalityKey("blurb", chosenPreset.name)!) : chosenPreset.blurb}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
