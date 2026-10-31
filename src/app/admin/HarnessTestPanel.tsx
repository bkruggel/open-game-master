"use client";

import { Check, Loader2, Minus, PlayCircle, X } from "lucide-react";
import { useState } from "react";
import { ui } from "@/lib/ui";
import { HarnessPictureTest } from "@/app/admin/HarnessPictureTest";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

type Stage = { id: string; ok: boolean | null; detail?: string };

const STAGE_KEYS: Record<string, MessageKey> = {
  found: "admin.harness.stage.found",
  signedIn: "admin.harness.stage.signedIn",
  handshake: "admin.harness.stage.handshake",
  toolCall: "admin.harness.stage.toolCall",
  lockdown: "admin.harness.stage.lockdown",
  streaming: "admin.harness.stage.streaming",
};

const STAGE_ORDER = ["found", "signedIn", "handshake", "toolCall", "lockdown", "streaming"];

// The live check: one real, tiny turn through the path every DM turn takes,
// with each stage ticked only when its real result comes back, and, for a
// program with its own image tool, one real test picture.
export function HarnessTestPanel({
  saved,
  paints,
  picturesVerified,
  picturesForTables = false,
  onVerified,
  onAdopted,
}: {
  // The program being tested is the saved one; testing an unsaved choice
  // would test something the tables will not use.
  saved: boolean;
  paints: boolean;
  picturesVerified: boolean;
  // Its pictures are already the tables' backend, switched on.
  picturesForTables?: boolean;
  onVerified: () => void;
  onAdopted?: () => void;
}) {
  const t = useT();
  const [testing, setTesting] = useState(false);
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [error, setError] = useState("");

  async function test() {
    setTesting(true);
    setError("");
    setStages(STAGE_ORDER.map((id) => ({ id, ok: null })));
    try {
      const response = await fetch("/api/admin/harness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = (await response.json().catch(() => ({}))) as { stages?: Stage[]; error?: string };
      if (!response.ok || !data.stages) {
        setError(data.error ?? t("admin.harness.couldNotRun"));
        setStages(null);
        return;
      }
      setStages(data.stages);
    } catch {
      setError(t("setup.unreachable"));
      setStages(null);
    } finally {
      setTesting(false);
    }
  }

  const failed = stages?.find((stage) => stage.ok === false);
  const passed = stages && stages.every((stage) => stage.ok === true);

  return (
    <div className="mt-4 space-y-3 border-t border-stone-800 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={ui.btnSmall}
          onClick={test}
          disabled={!saved || testing}
          aria-busy={testing}
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
          {t("admin.harness.test")}
        </button>
        <span className="text-xs text-stone-500">
          {saved
            ? t("admin.harness.testNote")
            : t("admin.harness.saveFirst")}
        </span>
      </div>

      {stages ? (
        <ol className="hx-stages" aria-live="polite">
          {stages.map((stage, index) => {
            const state = stage.ok === null ? (testing ? "wait" : "skip") : stage.ok ? "ok" : "bad";
            return (
              <li
                key={stage.id}
                className="hx-stage live-in"
                data-state={state}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span className="hx-stage-mark mt-0.5">
                  {state === "ok" ? (
                    <Check key="ok" className="tick-in size-4 text-emerald-400" />
                  ) : state === "bad" ? (
                    <X key="bad" className="tick-in size-4 text-red-400" />
                  ) : state === "wait" ? (
                    <Loader2 className="size-4 animate-spin text-stone-500" />
                  ) : (
                    <Minus className="size-4 text-stone-600" />
                  )}
                </span>
                <span>
                  <span className={state === "bad" ? "text-red-300" : state === "ok" ? "text-stone-200" : "text-stone-500"}>
                    {STAGE_KEYS[stage.id] ? t(STAGE_KEYS[stage.id]) : stage.id}
                  </span>
                  {stage.detail ? (
                    <span className="block text-xs text-stone-500">{stage.detail}</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {passed ? (
        <p role="status" className="inline-flex items-center gap-1 text-sm text-emerald-400">
          <Check className="tick-in size-4" /> {t("admin.harness.ready")}
        </p>
      ) : failed && !testing ? (
        <p role="alert" className="motion-shake text-sm text-red-400">
          {failed.detail ?? t("admin.harness.stoppedAt")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="motion-shake text-sm text-red-400">
          {error}
        </p>
      ) : null}

      {paints ? (
        <HarnessPictureTest
          saved={saved}
          picturesVerified={picturesVerified}
          picturesForTables={picturesForTables}
          onVerified={onVerified}
          onAdopted={onAdopted}
        />
      ) : null}
    </div>
  );
}
