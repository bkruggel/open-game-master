"use client";

import { ImageIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { InfoButton } from "@/components/ui/InfoDialog";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { GENRE_PRESETS } from "@/lib/genres";
import {
  TABLE_LANGUAGE_LABELS,
  TABLE_LANGUAGES,
  type Genre,
  type TableLanguage,
} from "@/lib/schemas/game-settings-options";
import type { WorldPackSummary } from "@/lib/worlds/types";
import { FieldLabel } from "@/app/create-campaign/fields";
import type { StepProps } from "@/app/create-campaign/draft";
import { useLocale, useT } from "@/lib/locale";
import {
  arrivalTypeIn,
  dmFlavorText,
  portalCards,
  typeInPlan,
  worldFacts,
  type TypeInPlan,
} from "@/app/create-campaign/portals";

// The setting dialog's middle block: one line per portal, from the data
// file's own names and blurbs (the worlds' words stay the data's).
const settingList = () => GENRE_PRESETS.map((preset) => `**${preset.name}**: ${preset.blurb}`).join("\n\n");

// The setting as eight painted portals, its custom description, the theme the
// preset writes (and the person may overwrite) and the premise. One component
// because the portals and the theme field share the type-in: picking a
// portal writes the preset's line into the theme while it plays.
export function WorldFields({
  draft,
  patch,
  gates,
  active,
  onPickGenre,
}: StepProps & {
  // True while this is the step on screen; entrances wait for it.
  active: boolean;
  // Picking a bare genre by hand leaves the pack and lets the preset write
  // the theme, so the dialog owns the handler that does all three.
  onPickGenre: (genre: Genre) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const showsAiFill = gates.aiNarrates && draft.aiStorySetup;
  // The type-in is a clip played over the input while its own text hides;
  // `run` re-keys it so a second pick replays it.
  const [typing, setTyping] = useState<(TypeInPlan & { run: number }) | null>(null);
  const [arrived, setArrived] = useState(false);
  if (active && !arrived) {
    setArrived(true);
    const plan = arrivalTypeIn(draft, locale);
    if (plan) {
      setTyping({ ...plan, run: 0 });
    }
  }

  const pick = (genre: Genre) => {
    const plan = typeInPlan(draft, genre, locale);
    onPickGenre(genre);
    setTyping((current) => (plan ? { ...plan, run: (current?.run ?? 0) + 1 } : null));
  };

  // Only while the line on screen is the line being typed: a pack, saved
  // defaults, or anything else that rewrote the theme, ends it.
  const typingNow = typing !== null && typing.text === draft.theme;
  const themeNote = draft.themeTouched
    ? t("creator.themeNote.own")
    : draft.worldPack
      ? t("creator.themeNote.pack")
      : draft.theme
        ? t("creator.themeNote.preset")
        : t("creator.themeNote.empty");

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel className="mb-0">
          <span className="flex items-center gap-1">
            {t("creator.field.setting")}
            <InfoButton label={t("creator.setting.infoLabel")} text={t("creator.setting.info", { list: settingList() })} />
          </span>
        </FieldLabel>
        <div className="cc-portal-grid">
          {portalCards(draft.genre, t).map((card) => (
            <div key={card.id} className="cc-portal-slot" style={{ "--cc-delay": `${card.delayMs}ms` } as CSSProperties}>
              <button type="button" onClick={() => pick(card.id)} aria-pressed={card.chosen} className="cc-portal motion-card">
                <span
                  role="img"
                  aria-label={t("creator.genre.coverAria", { name: t(`creator.genre.${card.id}`) })}
                  className="cc-plate"
                  style={{ backgroundImage: `url("${card.plate}")` }}
                >
                  <span className="cc-plate-name">{t(`creator.genre.${card.id}`)}</span>
                  {card.humansOnly ? <span className="cc-humans">{t("creator.genre.humansOnly")}</span> : null}
                </span>
                <span className="cc-portal-body">
                  <span className="cc-portal-blurb">{card.blurb}</span>
                  <span className="cc-portal-foot">
                    <span className="cc-chip">{t(`creator.climate.${card.climate}`)}</span>
                    <span className="cc-cta">{card.chosen ? t("creator.chosen") : t("creator.tapToChoose")}</span>
                  </span>
                </span>
              </button>
              {card.chosen ? (
                <span className="cc-chosen" aria-hidden="true">
                  ✓ {t("creator.chosen")}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {draft.genre === "custom" ? (
          <div className="cc-custom mt-2">
            <span className="cc-eyebrow mb-1 block">{t("creator.custom.heading")}</span>
            <p className="cc-prose mb-2 text-[13px] leading-relaxed text-stone-300">{t("creator.custom.body")}</p>
            <span className="cc-serif block">
              <textarea
                value={draft.customGenreText}
                onChange={(event) => patch({ customGenreText: event.target.value })}
                rows={2}
                maxLength={500}
                aria-label={t("creator.custom.aria")}
                placeholder={t("creator.custom.placeholder")}
                className="cc-bare"
              />
            </span>
          </div>
        ) : null}
      </div>

      <label
        className={cn("cc-field block", typingNow && "cc-typing")}
        data-written={draft.theme ? "true" : "false"}
        style={
          typingNow
            ? ({
                "--cc-type-ms": `${typing.typeMs}ms`,
                "--cc-type-steps": typing.chars,
                "--cc-sweep-ms": `${typing.sweepMs}ms`,
              } as CSSProperties)
            : undefined
        }
      >
        <span key={typingNow ? typing.run : "rest"} className="cc-sweep" aria-hidden="true" />
        <span className="cc-field-head">
          <span className="cc-eyebrow">{t("creator.field.theme")}</span>
          <span className="cc-note">{themeNote}</span>
        </span>
        <span className="cc-type-row cc-serif block">
          <input
            value={draft.theme}
            onChange={(event) => {
              setTyping(null);
              patch({ theme: event.target.value, themeTouched: true });
            }}
            maxLength={120}
            placeholder={t("creator.theme.placeholder")}
            className="cc-bare"
          />
          {typingNow ? (
            <span key={typing.run} className="cc-typed" aria-hidden="true">
              <span
                onAnimationEnd={(event) => {
                  if (event.animationName === "cc-typeline") {
                    setTyping(null);
                  }
                }}
              >
                {typing.text}
              </span>
            </span>
          ) : null}
        </span>
      </label>

      <label className="cc-field block">
        <span className="cc-field-head">
          <span className="cc-eyebrow">{t("creator.field.premise")}</span>
          <span className="cc-note">
            {t("creator.optional")}
            {showsAiFill ? t("creator.premise.aiFill") : ""}
          </span>
        </span>
        <span className="cc-serif block">
          <textarea
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value, descriptionTouched: true })}
            rows={2}
            maxLength={500}
            className="cc-bare"
          />
        </span>
      </label>
    </div>
  );
}

// What the chosen setting tells the Dungeon Master (read-only), the language
// the story is written in, and where cover art comes from. Cover art is only
// pointed at: the upload and the AI painter live in the campaign's details
// dialog, because a cover needs a campaign row to hang off.
export function WorldDetailsFields({
  draft,
  patch,
  selectedPack,
}: Pick<StepProps, "draft" | "patch"> & { selectedPack: WorldPackSummary | null }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="cc-field">
        <div className="cc-field-head">
          <span className="cc-eyebrow">{t("creator.details.voiceHeading")}</span>
          <span className="cc-note">
            {selectedPack ? t("creator.details.packVoice", { name: selectedPack.name }) : t("creator.details.readOnly")}
          </span>
        </div>
        <p key={draft.genre} className="cc-flavor cc-prose text-[13px] leading-relaxed text-stone-300">
          {dmFlavorText(draft.genre)}
        </p>
        <div key={`facts-${draft.genre}`} className="cc-facts">
          {worldFacts(draft.genre, t).map((fact, index) => (
            <span key={fact.key} className="cc-fact" style={{ animationDelay: `${index * 70}ms` }}>
              <span className="cc-fact-key">{fact.key}</span>
              <span className="cc-fact-value">{fact.value}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="cc-field">
        <div className="cc-field-head">
          <span className="cc-eyebrow">{t("creator.details.language")}</span>
          <span className="cc-note">{t("creator.details.languageNote")}</span>
        </div>
        <Select<TableLanguage>
          value={draft.tableLanguage}
          onChange={(tableLanguage) => patch({ tableLanguage })}
          label={t("creator.details.language")}
          className="w-full"
          options={TABLE_LANGUAGES.map((value) => ({ value, label: TABLE_LANGUAGE_LABELS[value] }))}
        />
        <p className="mt-1 text-xs text-stone-500">{t("creator.language.help")}</p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-stone-800 bg-stone-950/40 p-3">
        <ImageIcon className="mt-0.5 size-4 shrink-0 text-amber-300/70" aria-hidden="true" />
        <div>
          <span className="block text-stone-300">{t("creator.details.cover")}</span>
          <p className="mt-0.5 text-xs text-stone-500">{t("creator.details.coverNote")}</p>
        </div>
      </div>
    </div>
  );
}
