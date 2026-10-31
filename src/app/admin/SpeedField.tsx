"use client";

import { Zap } from "lucide-react";
import { useT } from "@/lib/locale";
import { Field, SelectField } from "@/app/admin/AdminSettingsFields";
import { FAST_COST_NOTE, type Speed, type SpeedEligibility } from "@/lib/speed-tier";
import type { SpeedNote } from "@/lib/speed-status";

// Processing speed for one model role (issue 255): the provider's default or
// its paid Fast tier. Offered on a connection that has one, for a named
// model (src/lib/speed-tier.ts); otherwise it says why. The cost is said before Fast is chosen, and what
// the last calls actually ran at is shown under it, so a downgrade to
// standard speed is never read as Fast.
export function SpeedField({
  label,
  value,
  onChange,
  eligibility,
  note,
}: {
  label: string;
  value: Speed;
  onChange: (value: Speed) => void;
  eligibility: SpeedEligibility;
  note?: SpeedNote;
}) {
  const t = useT();
  if (!eligibility.ok) {
    return (
      <Field label={label} hint={eligibility.reason} group>
        <p className="rounded-md border border-stone-800 bg-stone-950/40 px-2.5 py-1.5 text-xs text-stone-400" data-speed-unavailable>
          {t("admin.speed.default")}{value === "fast" ? t("admin.speed.defaultNoTier") : ""}
        </p>
      </Field>
    );
  }
  return (
    <div data-speed-field>
      <SelectField
        label={label}
        value={value}
        onChange={onChange}
        options={[
          { value: "" as const, label: t("admin.speed.default") },
          { value: "fast" as const, label: t("admin.speed.fast") },
        ]}
        hint={value === "fast" ? FAST_COST_NOTE : t("admin.speed.fastHint")}
      />
      {value === "fast" ? <SpeedNoteLine note={note} /> : null}
    </div>
  );
}

function SpeedNoteLine({ note }: { note?: SpeedNote }) {
  const t = useT();
  if (!note) {
    return <p className="mt-1 text-[11px] text-stone-500">{t("admin.speed.noCalls")}</p>;
  }
  const when = new Date(note.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const said = (reported?: string) =>
    note.reported && note.reported !== "fast" ? t("admin.speed.reported", { said: reported ?? note.reported ?? "" }) : "";
  const text = note.refused
    ? t("admin.speed.refused", { time: when, message: note.refused })
    : note.effective === "fast"
      ? t("admin.speed.ranFast", { time: when, reported: said(note.reported ?? undefined) })
      : note.effective === "standard"
        ? t("admin.speed.ranStandard", { time: when, reported: note.reported ? t("admin.speed.reported", { said: note.reported }) : "" })
        : t("admin.speed.unknownSpeed", { time: when });
  return (
    <p className="mt-1 flex items-start gap-1 text-[11px] text-stone-400" data-speed-note>
      <Zap className="mt-px size-3 shrink-0 text-amber-300" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
