"use client";

import { ExternalLink, Map as MapIcon, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { Select } from "@/components/ui/Select";
import { KitButton } from "@/app/campaigns/[campaignId]/PanelKit";
import type { Pin, Region } from "@/lib/worldforge/model";
import { mapWouldLoop, REGION_COLORS } from "@/lib/worldforge/tree";
import type { WorldState } from "./useWorld";
import { EntityAvatar, EntityPicker, typeOf } from "./world-ui";
import { NotSaved } from "./AtlasEdit";
import { useT } from "@/lib/locale";

// What a pin or a region on the atlas is: its name, the entry it stands for,
// notes, and for a pin the map it opens (a map made inside it, or a jump to
// another map that keeps its own place in the tree).

export function AtlasCard({
  world,
  pin,
  region,
  making,
  subMapForm,
  regionActions,
  battleMaps,
  position,
  onMakeSubMap,
  onOpenMap,
  onOpenEntry,
  onSavePin,
  onDeletePin,
  onSaveRegion,
  onDeleteRegion,
  onClose,
}: {
  world: WorldState;
  pin: Pin | null;
  region: Region | null;
  making: { name: string; image: string } | null;
  subMapForm: ReactNode;
  // For a pin naming a place: placing it on the Region, or releasing it
  // (AtlasRegion's PinRegionActions).
  regionActions?: ReactNode;
  // For a pin naming a place: its battle maps and encounters
  // (PlaceBattleMaps), or a line on how to get them.
  battleMaps?: ReactNode;
  // Where it stands, as numbers: a pin's two, a region's corners (AtlasEdit).
  position?: ReactNode;
  onMakeSubMap: () => void;
  onOpenMap: (id: string) => void;
  onOpenEntry: (ref: string) => void;
  // Each resolves false when the save was refused.
  onSavePin: (pin: Pin) => Promise<boolean> | void;
  onDeletePin: (pin: Pin) => void;
  onSaveRegion: (region: Region) => Promise<boolean> | void;
  onDeleteRegion: (region: Region) => void;
  onClose: () => void;
}) {
  const { doc, entities } = world;
  const t = useT();
  const [draft, setDraft] = useState({ name: pin?.name ?? region?.name ?? "", notes: pin?.notes ?? region?.notes ?? "" });
  const [picking, setPicking] = useState(false);
  const ref = pin?.ref ?? region?.ref ?? "";
  const entity = entities.find((entry) => entry.ref === ref);
  // A refused save keeps the draft in the fields, with a way to try again
  // (audit WF-20); the row itself goes back to what the server holds.
  const [failed, setFailed] = useState<Partial<Pin & Region> | null>(null);
  const save = async (patch: Partial<Pin & Region>) => {
    const ok = pin ? await onSavePin({ ...pin, ...draft, ...patch } as Pin) : region ? await onSaveRegion({ ...region, ...draft, ...patch } as Region) : true;
    setFailed(ok === false ? patch : null);
  };
  const linked = pin?.linkedMapId ? doc.maps.find((atlas) => atlas.id === pin.linkedMapId) : null;
  const portals = pin ? doc.maps.filter((atlas) => atlas.id !== pin.mapId && !mapWouldLoop(doc.maps, doc.pins, pin, atlas.id)) : [];

  return (
    <div className="panel motion-pop flex flex-col gap-2 rounded-lg p-3" data-tour="world-atlas-card">
      <div className="flex items-center gap-2">
        <span className="eyebrow text-[10px] text-amber-400/80">{pin ? t("workshop.world.atlasCard.pin") : t("workshop.world.atlasCard.region")}</span>
        <input className={cn(ui.input, "py-1 text-sm")} aria-label={t("workshop.bestiary.block.name")} maxLength={80} placeholder={entity?.name ?? t("workshop.world.atlasCard.aName")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} onBlur={() => save({})} />
        <KitButton tone="iconDanger" always aria-label={t("action.delete")} onClick={() => (pin ? onDeletePin(pin) : region && onDeleteRegion(region))} data-testid="atlas-card-delete">
          <Trash2 className="size-4" />
        </KitButton>
        <KitButton tone="icon" always aria-label={t("action.close")} onClick={onClose}>
          <X className="size-4" />
        </KitButton>
      </div>
      {failed ? <NotSaved onRetry={() => void save(failed)} what={t("workshop.world.atlasCard.yourWords")} /> : null}
      <label className="flex items-center gap-1.5 text-[11px] text-stone-400">
        <input type="checkbox" checked={Boolean((pin ?? region)?.hidden)} onChange={(event) => void save({ hidden: event.target.checked ? true : undefined })} data-testid="atlas-card-hidden" />
        {t("workshop.world.atlasCard.hiddenFromParty")}
        <span className="text-stone-600">{t("workshop.world.atlasCard.hiddenParen")}</span>
      </label>
      {position}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-stone-500">{t("workshop.world.atlasCard.standsFor")}</span>
        {entity ? (
          <>
            <button type="button" onClick={() => onOpenEntry(entity.ref)} className="pk-chip motion-pop text-[11px]">
              <EntityAvatar entity={entity} type={typeOf(doc, entity)} size="size-4" /> {entity.name} <ExternalLink className="size-3" />
            </button>
            <button type="button" onClick={() => save({ ref: "" })} className="text-[11px] text-stone-500 hover:text-red-300">{t("workshop.world.atlasCard.unbind")}</button>
          </>
        ) : null}
        <KitButton tone="link" onClick={() => setPicking((value) => !value)}>{entity ? t("workshop.world.atlasCard.change") : t("workshop.world.atlasCard.pickEntry")}</KitButton>
      </div>
      {picking ? (
        <EntityPicker doc={doc} entities={entities} chosen={[ref]} label={t("workshop.world.atlasCard.pickerLabel")} onPick={(picked) => { save({ ref: picked.ref, name: draft.name || picked.name }); setDraft({ ...draft, name: draft.name || picked.name }); setPicking(false); }} />
      ) : null}
      {region ? (
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t("workshop.world.atlasCard.colour")}>
          {REGION_COLORS.map((color) => (
            <button key={color} type="button" role="radio" aria-checked={region.color === color} aria-label={color} onClick={() => save({ color })} className={cn("size-5 rounded-full border-2 motion-press", region.color === color ? "border-amber-100" : "border-transparent")} style={{ background: color }} />
          ))}
        </div>
      ) : null}
      <textarea className={cn(ui.input, "min-h-14 text-xs")} aria-label={t("table.tab.notes")} placeholder={t("table.tab.notes")} maxLength={400} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} onBlur={() => save({})} />
      {pin ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-stone-500">{t("workshop.world.atlasCard.opens")}</span>
          {linked ? (
            <>
              <KitButton tone="small" onClick={() => onOpenMap(linked.id)}><MapIcon className="size-3.5" /> {linked.name}</KitButton>
              <button type="button" onClick={() => save({ linkedMapId: "" })} className="text-[11px] text-stone-500 hover:text-red-300">{t("workshop.world.atlasCard.unlink")}</button>
            </>
          ) : (
            <>
              {making ? null : <KitButton tone="small" onClick={onMakeSubMap}>{t("workshop.world.atlasCard.newMapInside")}</KitButton>}
              {portals.length ? (
                <Select label={t("workshop.world.atlasCard.orJump")} size="sm" value="" placeholder={t("workshop.world.atlasCard.orJumpPlaceholder")} onChange={(id) => save({ linkedMapId: id })} options={portals.map((atlas) => ({ value: atlas.id, label: atlas.name }))} />
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {pin && making ? subMapForm : null}
      {pin ? regionActions : null}
      {pin ? battleMaps : null}
    </div>
  );
}
