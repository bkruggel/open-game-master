"use client";

import { Dices } from "lucide-react";
import { useId, useMemo, type Ref } from "react";
import OptionPicker, { type PickerGroup } from "@/app/characters/builder/OptionPicker";
import { UnofficialPackNotice } from "@/components/UnofficialPackNotice";
import { DM_MODES } from "@/lib/schemas/game-settings-options";
import type { FranchiseGroup, WorldPackSummary } from "@/lib/worlds/types";
import { FieldLabel, inputClass, ToggleCard } from "@/app/create-campaign/fields";
import type { StepProps } from "@/app/create-campaign/draft";
import { rollCampaignTitle } from "@/app/create-campaign/titles";
import { useT } from "@/lib/locale";

// The campaign's name. The essentials step will not go on without one, and
// its held Continue brings the cursor back here.
// The dice roll a title in the genre's own words for someone who would
// rather name the campaign once they know what it is; it stays editable.
export function TitleField({ draft, patch, inputRef }: Pick<StepProps, "draft" | "patch"> & { inputRef?: Ref<HTMLInputElement> }) {
  const t = useT();
  return (
    <div>
      <label htmlFor="cc-title" className="block">
        <FieldLabel>{t("creator.field.title")}</FieldLabel>
      </label>
      <span className="flex items-center gap-2">
        <input
          id="cc-title"
          ref={inputRef}
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
          required
          maxLength={80}
          placeholder={t("creator.title.placeholder")}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => patch({ title: rollCampaignTitle(draft.genre, draft.title) })}
          title={t("creator.title.rollTooltip")}
          aria-label={t("creator.title.rollAria")}
          className="motion-press flex size-11 shrink-0 items-center justify-center rounded-lg border border-stone-700 text-amber-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
        >
          <Dices className="size-5" aria-hidden="true" />
        </button>
      </span>
      {!draft.title.trim() ? (
        <span className="mt-1 block text-[11px] text-stone-500">{t("creator.title.hint")}</span>
      ) : null}
    </div>
  );
}

// Each way to run a table, said from the seat the person creating it takes.
const DM_ROLE_KEYS: Record<(typeof DM_MODES)[number], string> = {
  ai: "creator.dmRole.ai",
  steered: "creator.dmRole.steered",
  human: "creator.dmRole.human",
  assisted: "creator.dmRole.assisted",
};

// Who holds the DM seat. A server that positively has no AI storyteller
// offers only the human seat; one whose storyteller is not answering keeps
// every seat and says so.
export function DmModeField({ draft, patch, gates }: StepProps) {
  const t = useT();
  const { storyKnownMissing, storyUnreachable, aiNarrates } = gates;
  return (
    <div>
      <FieldLabel className="mb-1.5">{t("creator.dmMode.label")}</FieldLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DM_MODES.filter(
          // "assisted" leans on the same missing backend, so it goes too.
          (mode) => mode === "human" || !storyKnownMissing,
        ).map((mode) => (
          <ToggleCard
            key={mode}
            active={draft.dmMode === mode}
            onClick={() => patch({ dmMode: mode })}
            label={t(`creator.dmMode.mode.${mode}`)}
            hint={
              <>
                <span className="block text-amber-200/90">{t(DM_ROLE_KEYS[mode])}</span>
                {t(`creator.dmHint.${mode}`)}
              </>
            }
          />
        ))}
      </div>
      {storyKnownMissing ? (
        <p className="mt-1.5 text-xs text-stone-500">{t("creator.dmMode.noAi")}</p>
      ) : null}
      {storyUnreachable && aiNarrates ? (
        <p className="mt-1.5 text-xs text-amber-300">{t("creator.dmMode.unreachable")}</p>
      ) : null}
      {draft.dmMode === "steered" ? (
        <p className="mt-1.5 text-xs text-stone-500">{t("creator.dmMode.steeredSeat")}</p>
      ) : draft.dmMode !== "ai" ? (
        <p className="mt-1.5 text-xs text-stone-500">{t("creator.dmMode.gmSeat")}</p>
      ) : null}
    </div>
  );
}

// An optional pre-built world. Every pack carries its own blurb behind a ⓘ,
// so a world can be read before it is chosen; a franchise with several eras
// keeps them grouped under its name. Hidden outright when the server has no
// pack installed.
export function WorldPackField({
  draft,
  packs,
  franchises,
  selectedPack,
  onChoosePack,
  onClearPack,
}: Pick<StepProps, "draft"> & {
  packs: WorldPackSummary[];
  franchises: FranchiseGroup[];
  selectedPack: WorldPackSummary | null;
  onChoosePack: (pack: WorldPackSummary) => void;
  onClearPack: () => void;
}) {
  const t = useT();
  const captionId = useId();
  const packGroups = useMemo<PickerGroup[]>(
    () => [
      { label: null, options: [{ id: "", name: t("creator.pack.none"), infoText: t("creator.pack.noPackInfo") }] },
      ...franchises.map((group) => ({
        label: group.editions.length === 1 ? null : group.franchise,
        options: group.editions.map((edition) => ({
          id: edition.id,
          name: group.editions.length === 1 ? edition.name : edition.edition || edition.name,
          infoText: edition.blurb,
        })),
      })),
    ],
    [franchises, t],
  );
  if (!franchises.length) {
    return null;
  }
  return (
    <div>
      <FieldLabel>
        <span id={captionId}>{t("creator.pack.label")}</span>
      </FieldLabel>
      <OptionPicker
        labelledBy={captionId}
        value={draft.worldPack}
        groups={packGroups}
        placeholder={t("creator.pack.none")}
        className={inputClass}
        onChange={(id) => {
          const next = packs.find((pack) => pack.id === id);
          if (next) {
            onChoosePack(next);
          } else {
            onClearPack();
          }
        }}
      />
      {selectedPack ? (
        <>
          {selectedPack.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedPack.cover}
              alt=""
              className="mt-2 aspect-video w-full max-w-sm rounded-lg border border-stone-800 object-cover"
            />
          ) : null}
          <p className="mt-1 text-xs text-stone-500">{selectedPack.blurb}</p>
          <UnofficialPackNotice
            rightsHolder={selectedPack.rightsHolder}
            inspiredBy={selectedPack.inspiredBy}
            className="mt-1.5"
          />
        </>
      ) : (
        <p className="mt-1 text-xs text-stone-500">{t("creator.pack.blurb")}</p>
      )}
    </div>
  );
}
