"use client";

import { Loader2, Puzzle, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddonFields, fieldDefaults, type FieldValues } from "@/components/addons/AddonFields";
import { appNotice } from "@/components/ui/ConfirmDialog";
import { SectionHead } from "@/components/ui/SectionHead";
import { Select } from "@/components/ui/Select";
import { BundlePreview, kindsOf, type BundlePreviewData } from "@/app/workshop/BundlePreview";
import { cancelTask, followTask } from "@/lib/addons/follow-task";
import { uploadForAddon } from "@/lib/addons/upload-client";
import type { TaskView } from "@/lib/addons/tasks";
import { useAddons } from "@/lib/addons/use-addons";
import { cn } from "@/lib/cn";
import { navigateTo } from "@/lib/navigation";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";

// A workshop made by an addon: a rulebook PDF read by a PDF importer, a
// file of stat blocks, anything an installed importer reads. Shown only
// when an admin has switched such an addon on.
//
// Three steps: the file goes up in pieces (a rulebook is often larger than
// one request may be), the addon reads it while this card shows how far it
// has got, and then the bundle it made is shown in the same preview a
// bundle file gets (BundlePreview.tsx). Nothing is created until Import.

type Stage =
  | { step: "pick" }
  | { step: "upload"; sent: number; size: number }
  | { step: "run"; task: TaskView }
  | { step: "preview"; task: TaskView; preview: BundlePreviewData };

export function AddonImportButton({
  label,
  className = ui.btnSecondary,
}: {
  label?: string;
  className?: string;
} = {}) {
  const t = useT();
  const { workshopImporters } = useAddons();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState("");
  const [options, setOptions] = useState<FieldValues>({});
  const [stage, setStage] = useState<Stage>({ step: "pick" });
  const [kinds, setKinds] = useState<string[]>([]);
  const [sharedWorkshopId, setSharedWorkshopId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  if (!workshopImporters.length) return null;
  const key = (entry: { addonId: string; id: string }) => `${entry.addonId}:${entry.id}`;
  const importer = workshopImporters.find((entry) => key(entry) === chosen) ?? workshopImporters[0];

  function choose(next: string) {
    setChosen(next);
    const found = workshopImporters.find((entry) => key(entry) === next);
    setOptions(fieldDefaults(found?.options ?? []));
  }

  function reset() {
    setStage({ step: "pick" });
    setError("");
    setBusy(false);
  }

  async function follow(task: TaskView) {
    const current = await followTask(task, (update) => setStage({ step: "run", task: update }), () => live.current);
    if (!current) {
      if (live.current) {
        setError(t("workshop.addonImport.lost"));
        setStage({ step: "pick" });
      }
      return;
    }
    if (current.status !== "done") {
      setError(current.error || t("workshop.addonImport.notFinished"));
      setStage({ step: "pick" });
      return;
    }
    const response = await fetch("/api/workshops/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addonTask: current.id, preview: true }),
    }).catch(() => null);
    const preview = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setError(preview.error ?? t("workshop.addonImport.previewFailed"));
      setStage({ step: "pick" });
      return;
    }
    setKinds(kindsOf(preview));
    setSharedWorkshopId((preview as BundlePreviewData).sharedHomes?.[0]?.id ?? "");
    setStage({ step: "preview", task: current, preview });
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.size > importer.maxInputMB * 1024 * 1024) {
      setError(t("workshop.addonImport.tooBig", { name: importer.title, limit: importer.maxInputMB }));
      return;
    }
    setStage({ step: "upload", sent: 0, size: file.size });
    const uploaded = await uploadForAddon(file, (sent) => {
      if (live.current) setStage({ step: "upload", sent, size: file.size });
    });
    if (!uploaded.ok) {
      setError(uploaded.error);
      setStage({ step: "pick" });
      return;
    }
    const response = await fetch("/api/addons/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "workshop-import",
        addonId: importer.addonId,
        importerId: importer.id,
        uploadId: uploaded.uploadId,
        options,
      }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setError(data.error ?? t("workshop.addonImport.startFailed"));
      setStage({ step: "pick" });
      return;
    }
    await follow(data.task as TaskView);
  }

  async function cancel() {
    if (stage.step === "run") await cancelTask(stage.task.id);
  }

  async function confirm() {
    if (stage.step !== "preview") return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/workshops/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addonTask: stage.task.id, kinds, sharedWorkshopId }),
    }).catch(() => null);
    const data = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok) {
      setError(data.error ?? t("workshop.addonImport.importFailed"));
      setBusy(false);
      return;
    }
    const shelf = (data as { shelf?: { renamed?: string[]; refused?: string[] } }).shelf;
    const renamed = (shelf?.renamed ?? []).filter(Boolean);
    if (renamed.length) {
      await appNotice(t("workshop.import.keptBody", { list: renamed.join(" ") }), t("workshop.import.keptTitle"));
    }
    const refused = (shelf?.refused ?? []).filter(Boolean);
    if (refused.length) {
      await appNotice(t("workshop.import.leftOutBody", { count: refused.length, list: refused.join(" ") }), t("workshop.import.leftOutTitle"));
    }
    navigateTo(`/workshop/${data.workshopId}`);
  }

  const accept = importer.accepts.join(",");
  const working = stage.step === "upload" || stage.step === "run";
  const fraction =
    stage.step === "upload" ? stage.sent / Math.max(1, stage.size) : stage.step === "run" ? stage.task.progress.fraction : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={className}
        title={t("workshop.addonImport.title")}
      >
        <Puzzle className="size-4" />
        {label ?? t("workshop.addonImport.open")}
      </button>

      {open ? (
        <div className={cn(ui.card, "reveal mt-3 p-4")}>
          <SectionHead
            title={t("workshop.addonImport.heading")}
            glyph="system-plugin"
            aside={
              <button type="button" onClick={() => setOpen(false)} aria-label={t("action.close")} className={ui.iconAction}>
                <X className="size-4" />
              </button>
            }
          />
          {workshopImporters.length > 1 ? (
            <Select
              label={t("workshop.addonImport.importer")}
              value={key(importer)}
              onChange={choose}
              disabled={working}
              options={workshopImporters.map((entry) => ({ value: key(entry), label: entry.title, hint: entry.addonName }))}
            />
          ) : (
            <p className="text-sm text-amber-100">
              {importer.title} <span className="text-xs text-stone-500">· {importer.addonName}</span>
            </p>
          )}
          {importer.description ? <p className="mt-1 text-xs text-stone-400">{importer.description}</p> : null}
          <p className="mt-1 text-[11px] text-stone-500">
            {t("workshop.addonImport.reads", { formats: importer.accepts.filter((entry) => entry.startsWith(".")).join(", ") || importer.accepts.join(", "), limit: importer.maxInputMB })}
          </p>

          {importer.options.length && stage.step === "pick" ? (
            <div className="mt-3">
              <AddonFields
                idPrefix={`import-${importer.addonId}-${importer.id}`}
                fields={importer.options}
                values={{ ...fieldDefaults(importer.options), ...options }}
                onChange={(field, value) => setOptions((current) => ({ ...fieldDefaults(importer.options), ...current, [field]: value }))}
              />
            </div>
          ) : null}

          {error ? <p role="alert" className="motion-shake mt-3 text-sm text-red-300">{error}</p> : null}

          {stage.step === "pick" ? (
            <div className="mt-3">
              <input
                ref={fileInput}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void pick(file);
                }}
              />
              <button type="button" onClick={() => fileInput.current?.click()} className={ui.btnPrimary}>
                <Upload className="size-4" />
                {t("workshop.addonImport.chooseFile")}
              </button>
            </div>
          ) : null}

          {working ? (
            <div className="live-in mt-3 space-y-2" role="status">
              <div className="h-2 overflow-hidden rounded-full bg-stone-800">
                <div
                  className={cn("h-full rounded-full bg-amber-400/80 transition-[width] duration-500", fraction === null && "animate-pulse")}
                  style={{ width: `${Math.round((fraction ?? 0.15) * 100)}%` }}
                />
              </div>
              <p className="flex items-center gap-2 text-xs text-stone-300">
                <Loader2 className="size-3.5 animate-spin" />
                {stage.step === "upload"
                  ? t("workshop.addonImport.sending", { sent: Math.round(stage.sent / 1024 / 1024), total: Math.max(1, Math.round(stage.size / 1024 / 1024)) })
                  : stage.task.progress.message || t("workshop.addonImport.reading")}
              </p>
              {stage.step === "run" ? (
                <button type="button" onClick={() => void cancel()} className={cn(ui.btnSmall, "text-xs")}>
                  {t("workshop.addonImport.stop")}
                </button>
              ) : null}
            </div>
          ) : null}

          {stage.step === "preview" ? (
            <BundlePreview
              preview={stage.preview}
              kinds={kinds}
              onKinds={setKinds}
              sharedWorkshopId={sharedWorkshopId}
              onSharedWorkshopId={setSharedWorkshopId}
              busy={busy}
              notes={stage.task.notes}
              onConfirm={() => void confirm()}
              onCancel={reset}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
