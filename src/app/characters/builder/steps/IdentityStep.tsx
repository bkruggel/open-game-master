"use client";

import { Camera, Dices, UserRound } from "lucide-react";
import { useId } from "react";
import { AttractionPicker, CHARACTER_ATTRACTION_HINT } from "@/components/AttractionPicker";
import { InfoButton } from "@/components/ui/InfoDialog";
import { LengthNote } from "@/components/ui/LengthNote";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/locale";
import type { CreateSheetInput } from "@/lib/schemas/sheet";
import { ui } from "@/lib/ui";
import { hostOffers, useCapabilities } from "@/lib/use-capabilities";
import type { WorldPack } from "@/lib/worlds/types";
import OptionPicker, { type PickerGroup } from "../OptionPicker";
import { rollHeroName } from "../heroNames";
import type { BuilderState } from "../useBuilderState";
import { Field, StepPanel, inputClass } from "./shared";

// The sheet schema's own limits on a backstory and on the hopes for the story
// (src/lib/schemas/sheet.ts HOPES_MAX, checked equal by
// scripts/test-story-hopes.mjs).
const BACKSTORY_MAX = 2000;
const HOPES_MAX = 500;

// The last step before the summary (backlog F4): who the hero is, once the
// player knows what they made. The name (its dice roll a name that fits the
// lineage already chosen), who they are drawn to (issue 501), alignment, the
// portrait and how they look, and their story. None of it changes a number
// on the sheet, so nothing before this step waits on it. How they play, the
// gender, the level and the background are asked on the steps before; the
// gender is said here beside the rest of who they are, with the way back to
// the class step that asks it.
export function IdentityStep({
  state,
  pack,
  initial,
  paintsPortraits,
  onUploadPortrait,
  alignmentGroups,
  alignmentInfo,
  onEditGender,
}: {
  state: BuilderState;
  pack: WorldPack | null;
  initial?: CreateSheetInput;
  // Whether this server can paint a portrait at all. Without an image
  // backend the section offers the upload alone and stops promising a
  // painting that would never arrive.
  paintsPortraits: boolean;
  onUploadPortrait: () => void;
  alignmentGroups: PickerGroup[];
  alignmentInfo: string;
  // To the gender on the class step, where the cards it changes are.
  onEditGender?: () => void;
}) {
  const t = useT();
  const { portrait, setPortrait } = state;
  const appearanceId = useId();
  const alignmentId = useId();
  const backstoryId = useId();
  const hopesId = useId();
  // Asked only where the host keeps it: an older host drops the field (an
  // app's screens may be newer than the host they are opened on).
  const asksHopes = hostOffers(useCapabilities(), "storyHopes");
  const keptSaved = Boolean(initial?.portrait && portrait?.url === initial.portrait.url);

  return (
    <div className="space-y-4">
      <StepPanel title={t("builder.identity.nameTitle")} ornate anchor="name">
        <span className="flex items-center gap-2">
          <input
            value={state.name}
            onChange={(event) => state.setName(event.target.value)}
            required
            maxLength={60}
            placeholder={pack?.nameHints || "Thornwick Ashvale"}
            className={inputClass}
            aria-label={t("builder.identity.nameAria")}
          />
          {/* The name dice: a name that fits the lineage chosen, or the
              world's own people when the table has a pack. */}
          <button
            type="button"
            onClick={() =>
              state.setName(
                rollHeroName({ raceId: state.raceId, packNames: pack?.nameSeeds.people ?? [], current: state.name }),
              )
            }
            aria-label={t("builder.identity.rollName")}
            title={t("builder.identity.rollName")}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-stone-700 text-amber-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
          >
            <Dices className="size-5" aria-hidden="true" />
          </button>
        </span>
        {pack?.nameSeeds.people.length ? (
          <span className="mt-2 flex flex-wrap gap-1">
            {pack.nameSeeds.people.slice(0, 8).map((seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => state.setName(seed)}
                className="rounded-md border border-stone-700/70 px-1.5 py-0.5 text-sm text-stone-400 transition-colors hover:border-amber-500/40 hover:text-amber-100"
              >
                {seed}
              </button>
            ))}
          </span>
        ) : null}
      </StepPanel>

      <StepPanel title={t("builder.identity.details")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("builder.shared.gender")}>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-300">{state.gender || t("builder.shared.notChosen")}</span>
              {onEditGender ? (
                <button type="button" onClick={onEditGender} className={cn(ui.btnSmall, "min-h-10")}>
                  {t("builder.identity.changeOnClass")}
                </button>
              ) : null}
            </span>
          </Field>
          <AttractionPicker value={state.attraction} onChange={state.setAttraction} hint={CHARACTER_ATTRACTION_HINT} />
        </div>
      </StepPanel>

      <StepPanel
        title={
          <span className="inline-flex items-center gap-1">
            <span id={alignmentId}>{t("builder.identity.alignment")}</span>
            <InfoButton label={t("builder.identity.alignment")} text={alignmentInfo} />
          </span>
        }
        help={t("builder.identity.alignmentHelp")}
      >
        <div className="sm:max-w-sm">
          <OptionPicker value={state.alignment} groups={alignmentGroups} labelledBy={alignmentId} className={inputClass} onChange={state.setAlignment} />
        </div>
      </StepPanel>

      <StepPanel title={t("builder.identity.portrait")} ornate>
        <div className="flex items-center gap-3">
          {portrait?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portrait.url}
              // Named for the hero, as the roster names it.
              alt={state.name.trim() || t("builder.identity.portraitAlt")}
              className="size-16 shrink-0 rounded-lg border border-amber-500/30 object-cover"
            />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-stone-700/60 bg-stone-950 text-stone-600">
              <UserRound className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* The upload is offered everywhere, whether or not a painter
                  exists: a photo is always a way to give a hero a face. */}
              <button type="button" onClick={onUploadPortrait} className={ui.btnSmall}>
                <Camera className="size-3.5" />
                {portrait ? t("builder.identity.replacePhoto") : t("builder.identity.uploadPhoto")}
              </button>
              {/* Clearing the saved portrait means "paint me a new one", which
                  only makes sense where a painter exists. A freshly uploaded
                  photo can always be taken back. */}
              {portrait && (paintsPortraits || !keptSaved) ? (
                <button type="button" onClick={() => setPortrait(null)} className={ui.btnSmall}>
                  {keptSaved ? t("builder.identity.regenerate") : t("builder.identity.removePhoto")}
                </button>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
              {portrait
                ? paintsPortraits
                  ? t("builder.identity.photoUsedPaint")
                  : t("builder.identity.photoUsed")
                : paintsPortraits
                  ? t("builder.identity.paintHint")
                  : t("builder.identity.uploadHint")}
            </p>
          </div>
        </div>
        <Field label={t("builder.identity.appearance")} className="mt-4" captionId={appearanceId}>
          <p id={`${appearanceId}-help`} className="mb-2 text-xs text-stone-500">
            {paintsPortraits
              ? t("builder.identity.appearancePaint")
              : t("builder.identity.appearancePlain")}
          </p>
          <textarea
            value={state.appearance}
            onChange={(event) => state.setAppearance(event.target.value)}
            aria-labelledby={appearanceId}
            aria-describedby={`${appearanceId}-help`}
            rows={2}
            maxLength={500}
            placeholder={t("builder.identity.appearancePlaceholder")}
            className={cn(inputClass, "resize-y")}
          />
        </Field>
      </StepPanel>

      <StepPanel
        title={t("builder.identity.backstory")}
        help={t("builder.identity.backstoryHelp")}
      >
        <textarea
          value={state.backstory}
          onChange={(event) => state.setBackstory(event.target.value)}
          rows={4}
          maxLength={BACKSTORY_MAX}
          placeholder={t("builder.identity.backstoryPlaceholder")}
          className={cn(inputClass, "resize-y")}
          aria-label={t("builder.identity.backstoryAria")}
          aria-describedby={`${backstoryId}-length`}
        />
        <LengthNote id={`${backstoryId}-length`} length={state.backstory.length} max={BACKSTORY_MAX} from={0.75} />
      </StepPanel>

      {asksHopes ? (
        <StepPanel
          title={t("builder.identity.hopes")}
          help={t("builder.identity.hopesHelp")}
        >
          <textarea
            value={state.hopes}
            onChange={(event) => state.setHopes(event.target.value)}
            rows={3}
            maxLength={HOPES_MAX}
            placeholder={t("builder.identity.hopesPlaceholder")}
            className={cn(inputClass, "resize-y")}
            aria-label={t("builder.identity.hopesAria")}
            aria-describedby={`${hopesId}-length`}
          />
          <LengthNote id={`${hopesId}-length`} length={state.hopes.length} max={HOPES_MAX} from={0.75} />
        </StepPanel>
      ) : null}
    </div>
  );
}
