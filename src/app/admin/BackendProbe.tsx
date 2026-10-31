"use client";

import { Check, Loader2, X, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { RECOMMENDED_WINDOW, STORY_WINDOW_NEEDS, aWindow, storyWindowVerdict, windowFlag, windowLabel } from "@/lib/story-window";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

// The three things the DM loop needs from a backend, in the order the probe
// tries them (scripts/lib/provider-capability-probe.mjs). A model that fails
// one of these will fail mid-story, so the admin can run the same probe the
// CLI runs before assigning a backend to a campaign.
const STAGE_KEYS: Record<(typeof STAGES)[number]["key"], MessageKey> = {
  streaming: "admin.probe.stage.streaming",
  toolCall: "admin.probe.stage.toolCall",
  toolContinuation: "admin.probe.stage.toolContinuation",
};

const STAGES = [
  { key: "streaming" },
  { key: "toolCall" },
  { key: "toolContinuation" },
] as const;

type ProbeStage = { ok?: boolean; sample?: string; name?: string | null };
type ProbeResult = {
  ok: boolean;
  endpoint?: string;
  model?: string;
  error?: string;
  // How the model's tools ran (scripts/lib/openai-tool-route.mjs): plain
  // Chat Completions, Chat Completions with reasoning off, or OpenAI's
  // Responses API. Worth a word when it is not the plain one, because a
  // campaign on this model runs the same way.
  route?: "chat" | "chat-no-reasoning" | "responses";
  stages?: Record<string, ProbeStage>;
  // The story window a campaign on it packs against; `reported` is false
  // when the server named no size.
  window?: { tokens: number; reported: boolean };
};

// The route note's key, for the two routes worth a word.
const ROUTE_KEYS: Record<string, MessageKey> = {
  "chat-no-reasoning": "admin.probe.route.chat-no-reasoning",
  responses: "admin.probe.route.responses",
};

// baseUrl/model/apiKey are the field values as typed; blanks fall back to the
// saved settings and env server-side, mirroring how a real turn resolves
// them. Pass the API key field only when it holds a freshly typed key, and
// the provider only when it is not yet saved (the guided setup).
export function BackendProbe({
  which,
  baseUrl,
  model,
  apiKey = "",
  provider,
}: {
  which: "story" | "utility";
  baseUrl: string;
  model: string;
  apiKey?: string;
  provider?: "local" | "custom";
}) {
  const t = useT();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);

  async function run() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/backend-probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ which, baseUrl, model, apiKey, ...(provider ? { provider } : {}) }),
      });
      const data = await response.json().catch(() => null);
      setResult(
        data ?? { ok: false, error: t("admin.probe.failed") },
      );
    } catch {
      setResult({ ok: false, error: t("setup.unreachable") });
    } finally {
      setTesting(false);
    }
  }

  const failed = result && !result.ok;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={testing}
          aria-busy={testing}
          className={ui.btnSmall}
        >
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
          {t("admin.probe.run")}
        </button>
        <span className="text-xs text-stone-500">
          {which === "story" ? t("admin.probe.storyNote") : t("admin.probe.utilityNote")}
        </span>
      </div>
      {testing ? (
        <p role="status" className="live-in mt-2 text-sm text-stone-400">
          {t("admin.probe.asking")}
        </p>
      ) : null}
      {result ? (
        <div className="live-in mt-2 space-y-1 text-sm">
          {STAGES.map((stage) => {
            const state = result.stages?.[stage.key];
            if (!state) return null;
            return (
              <p key={stage.key} className="flex items-center gap-2">
                {state.ok ? (
                  <Check className="size-4 shrink-0 text-emerald-400" />
                ) : (
                  <X className="size-4 shrink-0 text-red-400" />
                )}
                <span className={state.ok ? "text-stone-300" : "text-red-400"}>{t(STAGE_KEYS[stage.key])}</span>
              </p>
            );
          })}
          {result.ok ? (
            <p role="status" className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="size-4" /> {t("admin.probe.ok", { model: result.model ?? "" })}
              {result.route && ROUTE_KEYS[result.route] ? ` (${t(ROUTE_KEYS[result.route])})` : ""}.
            </p>
          ) : null}
          {result.ok && result.window ? <WindowLine size={result.window} /> : null}
          {result.ok ? null : (
            <p role="alert" className="motion-shake text-red-400">
              {result.error
                ? result.error
                : t("admin.probe.fail", { model: result.model || t("admin.probe.failFallback") })}
              {!result.error && result.stages?.streaming?.ok
                ? t("admin.probe.seeAbove")
                : "."}
            </p>
          )}
        </div>
      ) : null}
      {failed && result?.endpoint ? (
        <p className={cn("mt-1 break-all text-xs text-stone-500")} title={result.endpoint}>
          {t("admin.probe.probed", { endpoint: result.endpoint })}
        </p>
      ) : null}
    </div>
  );
}

// Whether the window is big enough to narrate and to fight, and what to
// change when it is not.
function WindowLine({ size }: { size: { tokens: number; reported: boolean } }) {
  const t = useT();
  const raise = t("admin.probe.window.raise", { flag: windowFlag(RECOMMENDED_WINDOW) });
  if (!size.reported) {
    return (
      <p className="text-xs leading-5 text-amber-200">
        {t("admin.probe.window.unreportedBefore", { size: windowLabel(size.tokens) })}
        {STORY_WINDOW_NEEDS}
        {t("admin.probe.window.unreportedAfter")}
      </p>
    );
  }
  const verdict = storyWindowVerdict(size.tokens);
  if (verdict.level === "ok") {
    return (
      <p className="flex items-center gap-1 text-emerald-400">
        <Check className="size-4 shrink-0" /> {t("admin.probe.window.ok", { window: aWindow(size.tokens) })}
      </p>
    );
  }
  return (
    <p role="alert" className="text-xs leading-5 text-amber-200">
      {verdict.text} {raise}
    </p>
  );
}
