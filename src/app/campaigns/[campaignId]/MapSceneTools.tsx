"use client";

import { useId, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { encodeImageForUpload } from "@/lib/image-encode";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { cueOptions } from "@/lib/ambience/catalog";
import { LIGHT_LIMITS, LIGHT_PRESETS, describeLight, lightPresetLabel } from "@/lib/battlemap/lights";
import type { ObjectEntry } from "@/lib/battlemap/render/painted";
import { SCENE_LIMITS, type SceneAmbience, type ZoneKind } from "@/lib/battlemap/scene";
import { TILE_FEET, type AmbientLight } from "@/lib/battlemap/types";
import { StampPicker } from "@/app/campaigns/[campaignId]/StampPicker";
import { Chip, FinePrint, RangeRow, mapButton, mapDanger, mapInput } from "@/app/campaigns/[campaignId]/mapUi";
import { useT } from "@/lib/locale";

// The dials for the scene tools (docs/workshop-parity-audit.md phase 13):
// how far the next light reaches, what the next label says, what the next
// prop is called and drawn as, which light a zone casts, the sound a map
// makes, and the DM's overlay picture. None of them touch a map; the toolbox
// holds the values and the canvas reports the tap that uses them.

export function LightDial({
  value,
  onChange,
  count,
  onClear,
}: {
  value: { brightRadius: number; dimRadius: number };
  onChange: (next: { brightRadius: number; dimRadius: number }) => void;
  count: number;
  onClear?: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {LIGHT_PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            title={describeLight(t, preset)}
            active={preset.brightRadius === value.brightRadius && preset.dimRadius === value.dimRadius}
            onClick={() => onChange({ brightRadius: preset.brightRadius, dimRadius: preset.dimRadius })}
          >
            {lightPresetLabel(t, preset.id)}
          </Chip>
        ))}
      </div>
      {(["brightRadius", "dimRadius"] as const).map((side) => (
        <RangeRow
          key={side}
          label={side === "brightRadius" ? t("scene.light.bright") : t("scene.light.dim")}
          min={LIGHT_LIMITS.minRadius}
          max={LIGHT_LIMITS.maxRadius}
          value={value[side]}
          readout={`${value[side] * TILE_FEET}ft`}
          onChange={(radius) => {
            const light = { ...value, [side]: radius };
            // The dim ring can never sit inside the bright one.
            if (light.dimRadius < light.brightRadius) {
              light.dimRadius = light.brightRadius;
            }
            onChange(light);
          }}
        />
      ))}
      {count && onClear ? (
        <button type="button" onClick={onClear} className={mapDanger}>
          {t("scene.light.putOut", { count })}
        </button>
      ) : null}
      <FinePrint>
        {t("scene.light.help", { max: LIGHT_LIMITS.max })}
      </FinePrint>
    </div>
  );
}

export function LabelDial({
  value,
  onChange,
  count,
  onClear,
}: {
  value: { text: string; dmOnly: boolean };
  onChange: (next: { text: string; dmOnly: boolean }) => void;
  count: number;
  onClear?: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      <input
        value={value.text}
        maxLength={SCENE_LIMITS.labelText}
        placeholder={t("scene.label.placeholder")}
        aria-label={t("scene.label.aria")}
        onChange={(event) => onChange({ ...value, text: event.target.value })}
        className={mapInput}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-8 items-center gap-1.5 text-[11px] text-stone-300">
          <Switch on={value.dmOnly} onChange={(dmOnly) => onChange({ ...value, dmOnly })} label={t("scene.label.dmOnly")} />
          {t("scene.label.dmOnly")}
        </label>
        {count && onClear ? (
          <button type="button" onClick={onClear} className={cn(mapDanger, "ml-auto")}>
            {t("scene.label.clearAll", { count })}
          </button>
        ) : null}
      </div>
      <FinePrint>
        {t("scene.label.help")}
      </FinePrint>
    </div>
  );
}

export function PropDial({
  value,
  onChange,
  count,
  npcNames = [],
  objects,
  ownSets = [],
}: {
  value: { name: string; kind: "prop" | "npc"; stamp?: string };
  onChange: (next: { name: string; kind: "prop" | "npc"; stamp?: string }) => void;
  count: number;
  // The cast, offered as a dropdown when the token is a bystander.
  npcNames?: readonly string[];
  // The painted object set, when this host has one: the stamp picker.
  objects?: readonly ObjectEntry[];
  ownSets?: readonly string[];
}) {
  const t = useT();
  const listId = useId();
  const suggest = value.kind === "npc" && npcNames.length > 0;
  return (
    <div className="space-y-2">
      <input
        value={value.name}
        maxLength={SCENE_LIMITS.propName}
        placeholder={value.kind === "npc" ? "Innkeeper" : "Barrel"}
        aria-label={t("scene.prop.nameAria")}
        list={suggest ? listId : undefined}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        className={mapInput}
      />
      {suggest ? (
        <datalist id={listId}>
          {npcNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}
      <div className="grid grid-cols-2 gap-1">
        {(["prop", "npc"] as const).map((kind) => (
          <Chip key={kind} active={value.kind === kind} onClick={() => onChange({ ...value, kind })}>
            {kind === "prop" ? t("scene.prop.aThing") : t("scene.prop.aBystander")}
          </Chip>
        ))}
      </div>
      {objects?.length ? (
        <StampPicker
          objects={objects}
          ownSets={ownSets}
          value={value.stamp}
          onPick={(object) =>
            onChange(
              object
                ? { ...value, stamp: object.id, name: (object.label ?? object.id).slice(0, SCENE_LIMITS.propName) }
                : { name: value.name, kind: value.kind },
            )
          }
        />
      ) : null}
      <FinePrint>
        {t("scene.prop.help", { placed: count ? t("scene.prop.placed", { count }) : "", max: SCENE_LIMITS.props })}
      </FinePrint>
    </div>
  );
}

export function ZoneDial({
  value,
  kind = "light",
  onChange,
  onKind,
  count,
  onClear,
}: {
  value: AmbientLight;
  kind?: ZoneKind;
  onChange: (next: AmbientLight) => void;
  onKind?: (next: ZoneKind) => void;
  count: number;
  onClear?: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-2">
      {onKind ? (
        <div className="grid grid-cols-1 gap-1">
          {(
            [
              ["light", "scene.zone.light"],
              ["darkness", "scene.zone.darkness"],
              ["magical_darkness", "scene.zone.magicalDarkness"],
            ] as const
          ).map(([option, key]) => (
            <Chip key={option} active={kind === option} onClick={() => onKind(option)}>
              {t(key)}
            </Chip>
          ))}
        </div>
      ) : null}
      <div className={cn("grid grid-cols-3 gap-1", kind !== "light" && "opacity-40")}>
        {(
          [
            ["bright", "scene.zone.ambient.lit"],
            ["dim", "scene.zone.ambient.dim"],
            ["dark", "scene.zone.ambient.dark"],
          ] as const
        ).map(([ambient, key]) => (
          <Chip key={ambient} active={value === ambient} onClick={() => onChange(ambient)}>
            {t(key)}
          </Chip>
        ))}
      </div>
      {count && onClear ? (
        <button type="button" onClick={onClear} className={mapDanger}>
          {t("scene.zone.clearAll", { count })}
        </button>
      ) : null}
      <FinePrint>
        {t("scene.zone.help", { max: SCENE_LIMITS.zones })}
      </FinePrint>
    </div>
  );
}

export function DoorHint() {
  const t = useT();
  return (
    <FinePrint>
      {t("scene.door.help")}
    </FinePrint>
  );
}

export function AmbienceControls({
  value,
  onChange,
}: {
  value: SceneAmbience;
  onChange: (next: SceneAmbience) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-1.5">
      <p className="font-display text-[9px] uppercase tracking-[0.14em] text-stone-500">{t("scene.soundsLike")}</p>
      <Select
        value={value.bed}
        label={t("scene.ambience.bed")}
        size="sm"
        onChange={(bed) => onChange({ ...value, bed })}
        options={[{ value: "", label: t("scene.ambience.bedLeave") }, ...cueOptions("bed").map((option) => ({ value: option.value as string, label: option.label }))]}
        className="w-full"
      />
      <Select
        value={value.music}
        label={t("scene.ambience.music")}
        size="sm"
        onChange={(music) => onChange({ ...value, music })}
        options={[{ value: "", label: t("scene.ambience.musicLeave") }, ...cueOptions("music").map((option) => ({ value: option.value as string, label: option.label }))]}
        className="w-full"
      />
      <FinePrint>{t("scene.ambience.help")}</FinePrint>
    </div>
  );
}

// The DM's overlay: the annotated version of the same picture, drawn in the
// same register as the backdrop and never sent to a player.
export function OverlayControls({
  overlayPath,
  busy,
  onChange,
}: {
  overlayPath: string;
  busy?: boolean;
  onChange: (path: string) => void;
}) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const { dataUrl, type } = await encodeImageForUpload(file);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, name: file.name, type }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || t("scene.overlay.error"));
        return;
      }
      onChange(payload.url);
    } catch {
      setError(t("scene.overlay.error"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 font-display text-[9px] uppercase tracking-[0.14em] text-stone-500">
        <ImageIcon className="size-3.5" /> {t("scene.overlay.title")}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void upload(file);
            }
            event.target.value = "";
          }}
        />
        <button type="button" disabled={uploading || busy} onClick={() => fileRef.current?.click()} className={mapButton}>
          {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
          {overlayPath ? t("scene.overlay.replace") : t("scene.overlay.add")}
        </button>
        {overlayPath ? (
          <button type="button" disabled={busy} onClick={() => onChange("")} className={mapDanger}>
            <Trash2 className="size-3" /> {t("scene.overlay.remove")}
          </button>
        ) : null}
      </div>
      <FinePrint>
        {t("scene.overlay.help")}
      </FinePrint>
      {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
    </div>
  );
}
