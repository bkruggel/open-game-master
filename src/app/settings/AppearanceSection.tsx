"use client";

import { PageSection } from "@/components/PageShell";
import { GameIcon } from "@/components/ui/GameIcon";
import { Slider } from "@/components/ui/Slider";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import { UI_SCALE_MAX, UI_SCALE_MIN, useThemePrefs, writeThemeChoice, writeUiScale, type ThemeChoice } from "@/lib/theme-mode";

// Appearance (docs/vtt-parity-implementation-plan.md section 14): the night
// or the day theme, the OS's choice by default, and how large the interface
// reads. Both are kept on this device, not on the account.
const CHOICES: Array<{ id: ThemeChoice; labelKey: string; glyph: string }> = [
  { id: "auto", labelKey: "appearance.theme.auto", glyph: "daypart-dusk" },
  { id: "dark", labelKey: "appearance.theme.dark", glyph: "daypart-night" },
  { id: "light", labelKey: "appearance.theme.light", glyph: "daypart-day" },
];

export function AppearanceSection() {
  const { choice, scale } = useThemePrefs();
  const t = useT();
  return (
    <PageSection
      heading={t("appearance.title")}
      glyph="sense-darkvision"
      intro={t("appearance.intro")}
    >
      <div data-pill-group="" role="group" aria-label={t("appearance.theme.aria")} className="flex flex-wrap gap-2">
        {CHOICES.map((entry) => (
          <button
            data-on={choice === entry.id ? "" : undefined}
            key={entry.id}
            type="button"
            aria-pressed={choice === entry.id}
            onClick={() => writeThemeChoice(entry.id)}
            className="theme-card motion-press"
          >
            <GameIcon icon={{ kind: "glyph", key: entry.glyph }} size="size-8" /> {t(entry.labelKey)}
          </button>
        ))}
      </div>
      <div className="mt-4 text-xs text-stone-400">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span>{t("appearance.scale")}</span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums text-stone-300">{Math.round(scale * 100)}%</span>
            {scale !== 1 ? (
              <button type="button" onClick={() => writeUiScale(1)} className={`${ui.btnSmall} reveal-pop px-2 py-1 text-[11px]`}>
                {t("action.reset")}
              </button>
            ) : null}
          </span>
        </div>
        <Slider
          label={t("appearance.scale")}
          min={UI_SCALE_MIN}
          max={UI_SCALE_MAX}
          step={0.05}
          value={scale}
          onChange={writeUiScale}
          bubble={(value) => `${Math.round(value * 100)}%`}
        />
      </div>
    </PageSection>
  );
}
