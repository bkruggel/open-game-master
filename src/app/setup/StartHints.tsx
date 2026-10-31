"use client";

import { CopyLine } from "@/components/CopyLine";
import type { ScanResult } from "@/app/setup/SetupParts";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";
import { RECOMMENDED_WINDOW, STORY_WINDOW_NEEDS, windowFlag } from "@/lib/story-window";

const HARDWARE_GUIDE = "https://github.com/Lebbitheplow/open-game-master/blob/main/docs/text-backends.md#hardware-for-a-local-model";

// What the scan found this machine can run, as the desktop app's Story AI
// screen says it (src/lib/model-registry/hardware.ts storytellerFit).
function machineLine(
  t: (key: string, vars?: Record<string, string | number>) => string,
  machine: NonNullable<ScanResult["machine"]>,
): MessageKey | string {
  switch (machine.fit) {
    case "recommended":
      return t("setup.start.machine.recommended", { summary: machine.summary });
    case "minimum":
      return t("setup.start.machine.minimum", { summary: machine.summary });
    case "below":
      return t("setup.start.machine.below", { summary: machine.summary });
    default:
      return t("setup.start.machine.unknown");
  }
}

// What to run when nothing answered. The commands match the README's.
export function StartHints({ inContainer, machine }: { inContainer: boolean; machine: ScanResult["machine"] | null }) {
  const t = useT();
  return (
    <details className="reveal rounded-lg border border-stone-800 bg-stone-950/40 px-3 py-2">
      <summary className="cursor-pointer text-sm text-stone-300">{t("setup.start.how")}</summary>
      <div className="mt-3 space-y-3 text-xs text-stone-400">
        {inContainer ? (
          <p className="su-note">
            {t("setup.start.container")}
          </p>
        ) : null}
        {machine ? <p className="text-stone-300">{machineLine(t, machine)}</p> : null}
        <p>
          {STORY_WINDOW_NEEDS}
          {t("setup.start.commands.before")}
          <code>-c {windowFlag(RECOMMENDED_WINDOW)}</code>
          {t("setup.start.commands.after")}
        </p>
        <div>
          <span className="mb-1 block">{t("setup.start.llama.default")}</span>
          <CopyLine
            text={`llama-server -m Qwen3.6-35B-A3B-Q8_0.gguf -c 65536 --jinja --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --temp 0.7 --top-p 0.95 --top-k 20 --min-p 0.0 --port 8001 --alias qwen3.6-35b${inContainer ? " --host 0.0.0.0" : ""}`}
            label={t("setup.start.llamaLabel")}
          />
        </div>
        <div>
          <span className="mb-1 block">{t("setup.start.llama.min")}</span>
          <CopyLine
            text={`llama-server -m gpt-oss-20b-MXFP4.gguf -c 65536 --jinja --flash-attn on --cache-type-k q8_0 --cache-type-v q8_0 --reasoning-budget 1024 --port 8001 --alias gpt-oss-20b${inContainer ? " --host 0.0.0.0" : ""}`}
            label={t("setup.start.llamaLabelMin")}
          />
        </div>
        <p>
          {t("setup.start.minimum")}
          <a href={HARDWARE_GUIDE} target="_blank" rel="noreferrer" className="text-amber-200 underline">
            {t("setup.start.minimum.link")}
          </a>
          .
        </p>
        <p>
          {t("setup.start.otherServers")}
        </p>
      </div>
    </details>
  );
}
