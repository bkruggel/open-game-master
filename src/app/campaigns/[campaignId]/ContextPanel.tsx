"use client";

import { EmptyState } from "@/components/EmptyState";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SectionHead } from "@/components/ui/SectionHead";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import type { BlockKind, ContextTrace } from "@/lib/dm/context-budget";

// "What the DM was actually sent." Lead only, because the underlying prompt
// carries DM-only facts and the secret story arc; see the route for why even
// the token counts stay behind that gate.
//
// The point of this panel is answering one question after a bad turn: was the
// thing the DM forgot even in the prompt? A dropped block with a reason is a
// far better answer than guessing at the model. The human framing reads the
// dictionaries (table.context.*); the protocol identifiers — tool names, the
// server's group names, finish reasons, more_tools — stay as it wrote them,
// as do the trace's own English lines.

const KIND_KEY: Record<BlockKind, string> = {
  safety: "table.context.kind.safety",
  contract: "table.context.kind.contract",
  rules: "table.context.kind.rules",
  sky: "table.context.kind.sky",
  state: "table.context.kind.state",
  factions: "table.context.kind.factions",
  quests: "table.context.kind.quests",
  shop: "table.context.kind.shop",
  retrieval: "table.context.kind.retrieval",
  chapters: "table.context.kind.chapters",
  history: "table.context.kind.history",
  tools: "table.context.kind.tools",
};

// Palette is stone, amber and ember only (src/app/globals.css remaps the
// Tailwind names); anything outside it renders as raw Tailwind and clashes
// with the indigo-and-gold theme.
const KIND_COLOR: Record<BlockKind, string> = {
  safety: "text-ember-300",
  contract: "text-amber-300",
  rules: "text-stone-300",
  sky: "text-stone-300",
  state: "text-amber-200",
  factions: "text-amber-200",
  quests: "text-amber-200",
  shop: "text-amber-200",
  retrieval: "text-ember-300",
  chapters: "text-ember-400",
  history: "text-stone-200",
  tools: "text-stone-400",
};

export function ContextPanel({ campaignId }: { campaignId: string }) {
  const [trace, setTrace] = useState<ContextTrace | null>(null);
  const [at, setAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const t = useT();

  // Every state write happens after the await, never synchronously while the
  // effect is running. `reload` is a counter rather than a direct call so the
  // refresh button re-runs the same effect instead of duplicating its logic.
  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((count) => count + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}/context-trace`);
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(response.status === 403 ? t("table.context.leadOnly") : t("table.context.error.load"));
          setLoading(false);
          return;
        }
        const data = (await response.json()) as { trace: ContextTrace | null; at?: string };
        if (cancelled) {
          return;
        }
        setError("");
        setTrace(data.trace);
        setAt(data.at ?? "");
      } catch {
        if (!cancelled) {
          setError(t("table.context.error.load"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, reload, t]);

  const pct = trace ? Math.min(100, Math.round((trace.promptTokens / trace.limitTokens) * 100)) : 0;
  const over = trace ? trace.promptTokens > trace.limitTokens : false;

  return (
    <div className="space-y-3 p-3">
      <SectionHead
        title={t("table.context.title")}
        glyph="tab-context"
        aside={
          <button type="button" onClick={load} className={cn(ui.iconAction, "pk-tap pk-always -my-1 inline-flex items-center justify-center")} aria-label={t("table.context.refresh")}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        }
      />
      <p className="-mt-1 text-xs text-stone-500">
        {t("table.context.lastTurn", { at: at ? `, ${new Date(at).toLocaleTimeString()}` : "" })}
      </p>

      {error ? <p className="motion-shake text-xs text-red-400">{error}</p> : null}

      {!error && !loading && !trace ? (
        <EmptyState size="sm" art="scrolls" title={t("table.context.empty")} />
      ) : null}

      {trace ? (
        <>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[11px] text-stone-400">
              <span>
                {trace.promptTokens.toLocaleString()} / {trace.limitTokens.toLocaleString()} {t("table.context.tokens")}
              </span>
              <span className={over ? "text-red-400" : "text-stone-500"}>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-800">
              <div
                className={cn("bar-ease h-full rounded-full", over ? "bg-red-500" : "bg-amber-500/70")}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>

          {trace.tuning?.length ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="tuning-trace">
              <span className="whitespace-nowrap font-medium text-amber-200">{t("table.context.tuned")}</span>
              <ul className="mt-1 space-y-0.5">
                {trace.tuning.map((line) => (
                  <li key={line} className="text-[11px] text-stone-400">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {trace.profile && trace.profile.name !== "full" ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="profile-trace">
              <span className="whitespace-nowrap font-medium text-amber-200">
                {trace.profile.name === "compact" ? t("table.context.profile.compact") : t("table.context.profile.trimmed")}
              </span>
              {trace.profile.name === "compact" ? (
                <p className="mt-0.5 text-[11px] text-stone-400">
                  {t("table.context.profile.offered", {
                    groups: trace.profile.groups?.length ? trace.profile.groups.join(", ") : t("table.context.profile.core"),
                  })}
                  {trace.profile.opened?.length ? t("table.context.profile.opened", { groups: trace.profile.opened.join(", ") }) : ""}
                  {t("table.context.profile.rest")}
                </p>
              ) : null}
            </div>
          ) : null}

          {trace.calls?.length ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="calls-trace">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="whitespace-nowrap font-medium text-amber-200">{t("table.context.calls")}</span>
                {trace.prefix ? (
                  <span className="shrink-0 font-mono text-[11px] text-stone-400" title={t("table.context.prefixTip")}>
                    {t("table.context.prefix", {
                      shared: trace.prefix.sharedTokens.toLocaleString(),
                      prompt: trace.prefix.promptTokens.toLocaleString(),
                    })}
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 space-y-0.5">
                {trace.calls.map((call, index) => (
                  <li key={`${index}-${call.task}`} className={cn("text-[11px]", call.error ? "text-red-300/90" : "text-stone-400")}>
                    <span className="font-mono text-stone-500">{call.task}</span>{" "}
                    {call.windowTokens
                      ? call.windowAssumed
                        ? t("table.context.call.assumed", {
                            sent: call.promptTokens.toLocaleString(),
                            window: call.windowTokens.toLocaleString(),
                          })
                        : t("table.context.call.sent", {
                            sent: call.promptTokens.toLocaleString(),
                            window: call.windowTokens.toLocaleString(),
                          })
                      : t("table.context.call.unmeasured")}
                    {call.toolCount ? t("table.context.call.tools", { count: call.toolCount }) : ""}
                    {call.windowTokens && !call.windowAssumed ? t("table.context.call.replyCap", { count: call.outputTokens.toLocaleString() }) : ""}
                    {call.reportedInputTokens !== undefined ? t("table.context.call.backendIn", { count: call.reportedInputTokens.toLocaleString() }) : ""}
                    {call.cachedInputTokens !== undefined ? t("table.context.call.cached", { count: call.cachedInputTokens.toLocaleString() }) : ""}
                    {call.outputTokensUsed !== undefined ? t("table.context.call.out", { count: call.outputTokensUsed.toLocaleString() }) : ""}
                    {call.reasoningTokens !== undefined ? t("table.context.call.reasoning", { count: call.reasoningTokens.toLocaleString() }) : ""}
                    {call.durationMs !== undefined ? `, ${(call.durationMs / 1000).toFixed(1)}s` : ""}
                    {call.firstTokenMs !== undefined ? t("table.context.call.firstWords", { seconds: (call.firstTokenMs / 1000).toFixed(1) }) : ""}
                    {call.dropped || call.clipped ? t("table.context.call.fitted", { dropped: call.dropped, clipped: call.clipped }) : ""}
                    {call.finishReason && call.finishReason !== "stop" && call.finishReason !== "tool_calls" ? t("table.context.call.ended", { reason: call.finishReason }) : ""}
                    {call.error ? t("table.context.call.failed", { reason: call.error }) : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {trace.houseRules ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="house-rules-trace">
              <span className="whitespace-nowrap font-medium text-amber-200">{t("table.rules.house")}</span>
              <p className="mt-0.5 text-[11px] text-stone-400">
                {trace.houseRules.shown.length ? t("table.context.houseShown", { list: trace.houseRules.shown.join("; ") }) : t("table.context.houseNone")}
              </p>
              {trace.houseRules.omitted.length ? (
                <p className="mt-0.5 text-[11px] text-red-300/90">{t("table.context.houseOmitted", { list: trace.houseRules.omitted.join("; ") })}</p>
              ) : null}
            </div>
          ) : null}

          {trace.arc ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="arc-trace">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="whitespace-nowrap font-medium text-amber-200">{t("table.context.arc")}</span>
                <span className="shrink-0 font-mono text-[11px] text-stone-400">
                  {t("table.context.arcBudget", {
                    shown: trace.arc.beats.shown,
                    total: trace.arc.beats.total,
                    chars: trace.arc.chars.toLocaleString(),
                    budget: trace.arc.budgetChars.toLocaleString(),
                  })}
                </span>
              </div>
              {trace.arc.events.length ? (
                <ul className="mt-1 space-y-0.5">
                  {trace.arc.events.map((pick) => (
                    <li key={pick.id} className={cn("text-[11px]", pick.included ? "text-stone-400" : "text-red-300/90")}>
                      <span className="font-mono text-stone-500">{pick.id}</span> {pick.name}
                      <span className="text-stone-500">: {pick.included ? pick.reason : t("table.context.heldBack", { reason: pick.reason.replace(/^held back: /, "") })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[11px] text-stone-500">{t("table.context.arcNone")}</p>
              )}
            </div>
          ) : null}

          {trace.lore ? (
            <div className="panel rounded-lg px-2.5 py-1.5 text-xs" data-testid="lore-trace">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="whitespace-nowrap font-medium text-amber-200">{t("creator.lore.heading2")}</span>
                <span className="shrink-0 font-mono text-[11px] text-stone-400">
                  {t("table.context.loreBudget", {
                    kept: trace.lore.picks.filter((pick) => pick.included).length,
                    total: trace.lore.picks.filter((pick) => !pick.weak).length,
                    chars: trace.lore.chars.toLocaleString(),
                    budget: trace.lore.budgetChars.toLocaleString(),
                  })}
                </span>
              </div>
              {trace.lore.picks.length ? (
                <ul className="mt-1 space-y-0.5">
                  {trace.lore.picks.map((pick) => (
                    <li
                      key={pick.id}
                      title={pick.id}
                      data-lore-pick={pick.included ? "kept" : pick.weak ? "near" : "held"}
                      className={cn("text-[11px]", pick.included ? "text-stone-400" : pick.weak ? "text-stone-500" : "text-red-300/90")}
                    >
                      {pick.title}
                      {pick.secret ? <span className="text-ember-300">{t("table.context.secret")}</span> : null}
                      <span className="text-stone-500">: {pick.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[11px] text-stone-500">{t("table.context.loreNone")}</p>
              )}
            </div>
          ) : null}

          <ul className="stagger space-y-1">
            {trace.blocks.map((block) => (
              <li
                key={`${block.position}-${block.id}`}
                className={cn(
                  "panel rounded-lg px-2.5 py-1.5 text-xs",
                  !block.included && "border-red-900/50 bg-red-950/20",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("font-medium", KIND_COLOR[block.kind])}>
                    {t(KIND_KEY[block.kind])}
                    <span className="ml-1 font-normal text-stone-500">{block.id}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-stone-400">
                    {block.tokens.toLocaleString()}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-[11px]",
                    block.included ? "text-stone-500" : "text-red-300",
                  )}
                >
                  {block.included ? block.reason : t("table.context.dropped", { reason: block.reason })}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
