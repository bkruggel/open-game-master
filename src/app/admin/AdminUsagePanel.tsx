"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ui } from "@/lib/ui";
import { AdminNarratorQualityCard } from "@/app/admin/AdminNarratorQualityCard";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SectionHead } from "@/components/ui/SectionHead";
import type { AccountUsage, CampaignUsage, UsageTotals } from "@/lib/usage/ledger";
import type { ModelCallSummary } from "@/lib/usage/model-calls";

type Overview = { campaigns: CampaignUsage[]; accounts: AccountUsage[]; generatedAt: string; modelCalls?: ModelCallSummary[] };

function seconds(ms: number | null): string {
  return ms === null ? "–" : `${(ms / 1000).toFixed(ms >= 10_000 ? 0 : 1)}s`;
}

// 1234 -> "1.2k", 1234567 -> "1.2M"; whole numbers below a thousand.
function compact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(n));
}

function bytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) {
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (n >= 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)} KB`;
  }
  return n ? `${n} B` : "0";
}

function when(t: (key: string) => string, at: string | null): string {
  return at ? new Date(at).toLocaleDateString() : t("admin.usage.never");
}

// The five usage columns every row shares: paid tokens, local tokens,
// pictures, speech, agent turns. "in/out" reads as tokens sent and tokens
// back; a dash is a clean zero.
function tokens(t: (key: string, vars?: Record<string, string | number>) => string, input: number, output: number): string {
  return input || output ? t("admin.usage.tokens", { in: compact(input), out: compact(output) }) : "–";
}

function pictures(t: (key: string, vars?: Record<string, string | number>) => string, paid: number, local: number): string {
  if (!paid && !local) {
    return "–";
  }
  return [paid ? t("admin.usage.paid", { count: compact(paid) }) : "", local ? t("admin.usage.local", { count: compact(local) }) : ""].filter(Boolean).join(", ");
}

function speech(t: (key: string, vars?: Record<string, string | number>) => string, totals: UsageTotals): string {
  const parts = [
    totals.paidSpeechChars || totals.localSpeechChars
      ? t("admin.usage.chars", {
          count: compact(totals.paidSpeechChars + totals.localSpeechChars),
        }) + (totals.paidSpeechChars ? t("admin.usage.charsPaid", { count: compact(totals.paidSpeechChars) }) : "")
      : "",
    totals.paidDictationClips || totals.localDictationClips
      ? t("admin.usage.clips", {
          count: compact(totals.paidDictationClips + totals.localDictationClips),
        }) + (totals.paidDictationClips ? t("admin.usage.charsPaid", { count: compact(totals.paidDictationClips) }) : "")
      : "",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "–";
}

const th = "px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-stone-500";
const td = "px-2 py-1.5 align-top text-xs text-stone-300 tabular-nums";

function UsageCells({ totals }: { totals: UsageTotals }) {
  const t = useT();
  return (
    <>
      <td className={td} title={t("admin.usage.title.tokensPaid")}>
        {tokens(t, totals.paidInputTokens, totals.paidOutputTokens)}
      </td>
      <td className={td} title={t("admin.usage.title.tokensLocal")}>
        {tokens(t, totals.localInputTokens, totals.localOutputTokens)}
      </td>
      <td className={td}>{pictures(t, totals.paidImages, totals.localImages)}</td>
      <td className={td}>{speech(t, totals)}</td>
      <td className={td}>{totals.agentTurns || "–"}</td>
    </>
  );
}

// What the server's AI has been spent on, by account and by campaign
// (issue #137). Counts come from what each backend reported; nothing here
// was read out of a prompt or a transcript, and no price is guessed.
export function AdminUsagePanel() {
  const t = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State moves only once the answer is in, so the first load inside the
  // effect sets nothing synchronously.
  const load = useCallback(() => {
    return fetch("/api/admin/usage")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (Overview & { error?: string }) | null;
        if (!response.ok || !data) {
          setError(data?.error || t("admin.usage.loadFailed"));
          return;
        }
        setError("");
        setOverview(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setLoading(true);
    void load();
  };

  if (loading && !overview) {
    return <PageSkeleton />;
  }

  const accounts = [...(overview?.accounts ?? [])].sort(
    (a, b) => b.paidInputTokens + b.paidOutputTokens - (a.paidInputTokens + a.paidOutputTokens) || b.calls - a.calls,
  );
  const campaigns = [...(overview?.campaigns ?? [])].sort(
    (a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-400">
        {t("admin.usage.intro")}
      </p>
      {error ? <p role="alert" className="motion-shake text-sm text-red-400">{error}</p> : null}
      <div className="flex items-center gap-2 text-xs text-stone-500">
        {overview ? <span>{t("admin.usage.asOf", { time: new Date(overview.generatedAt).toLocaleTimeString() })}</span> : null}
        <button type="button" className={ui.btnSmall} onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} {t("admin.usage.refresh")}
        </button>
      </div>

      <section className="panel texture-noise rounded-xl p-5">
        <SectionHead
          level="h2"
          title={t("admin.usage.accounts")}
          glyph="tab-party"
          aside={<span className="count-pop tabular-nums">{accounts.length}</span>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>{t("admin.usage.th.account")}</th>
                <th className={th}>{t("admin.usage.th.campaigns")}</th>
                <th className={th}>{t("admin.usage.th.characters")}</th>
                <th className={th}>{t("admin.usage.th.lastActive")}</th>
                <th className={th}>{t("admin.usage.th.storage")}</th>
                <th className={th}>{t("admin.usage.th.paidTokens")}</th>
                <th className={th}>{t("admin.usage.th.localTokens")}</th>
                <th className={th}>{t("admin.usage.th.pictures")}</th>
                <th className={th}>{t("admin.usage.th.speech")}</th>
                <th className={th}>{t("admin.usage.th.agentTurns")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.userId} className="border-t border-stone-800/60">
                  <td className={td}>
                    <span className="text-stone-100">{account.username}</span>
                    {account.isAdmin ? <span className="ml-1 text-[10px] uppercase text-amber-300/80">{t("admin.usage.adminChip")}</span> : null}
                  </td>
                  <td className={td} title={t("admin.usage.ownedLedgerJoined")}>
                    {account.campaignsOwned} / {account.campaignsLed} / {account.campaignsJoined}
                  </td>
                  <td className={td}>{account.libraryCharacters}</td>
                  <td className={td}>{when(t, account.lastActivityAt)}</td>
                  <td className={td}>{bytes(account.storageBytes)}</td>
                  <UsageCells totals={account} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-stone-500">
          {t("admin.usage.accountsNote")}
        </p>
      </section>

      <section className="panel texture-noise rounded-xl p-5">
        <SectionHead
          level="h2"
          title={t("admin.usage.campaigns")}
          glyph="tab-campaigns"
          aside={<span className="count-pop tabular-nums">{campaigns.length}</span>}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={th}>{t("admin.usage.th.campaign")}</th>
                <th className={th}>{t("admin.usage.th.lead")}</th>
                <th className={th}>{t("admin.usage.th.members")}</th>
                <th className={th}>{t("admin.usage.th.characters")}</th>
                <th className={th}>{t("admin.usage.th.gmTurns")}</th>
                <th className={th}>{t("admin.usage.th.activeDays")}</th>
                <th className={th}>{t("admin.usage.th.lastActivity")}</th>
                <th className={th}>{t("admin.usage.th.storage")}</th>
                <th className={th}>{t("admin.usage.th.paidTokens")}</th>
                <th className={th}>{t("admin.usage.th.localTokens")}</th>
                <th className={th}>{t("admin.usage.th.pictures")}</th>
                <th className={th}>{t("admin.usage.th.speech")}</th>
                <th className={th}>{t("admin.usage.th.agentTurns")}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.campaignId} className="border-t border-stone-800/60">
                  <td className={td}>
                    <span className="text-stone-100">{campaign.title}</span>
                    <span className="ml-1 text-[10px] uppercase text-stone-500">
                      {campaign.kind === "workshop"
                        ? t("admin.usage.kind.workshop")
                        : campaign.kind === "playtest"
                          ? t("admin.usage.kind.playtest")
                          : campaign.status}
                    </span>
                  </td>
                  <td className={td}>{campaign.leadUsername || "–"}</td>
                  <td className={td}>{campaign.members}</td>
                  <td className={td}>{campaign.characters}</td>
                  <td className={td}>{campaign.turns || "–"}</td>
                  <td className={td}>{campaign.activeDays || "–"}</td>
                  <td className={td}>{when(t, campaign.lastActivityAt)}</td>
                  <td className={td}>{bytes(campaign.storageBytes)}</td>
                  <UsageCells totals={campaign} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-stone-500">
          {t("admin.usage.campaignsNote")}
        </p>
      </section>

      {overview?.modelCalls?.length ? (
        <section className="panel texture-noise rounded-xl p-5" data-testid="model-calls">
          <SectionHead
            level="h2"
            title={t("admin.usage.modelCalls")}
            glyph="tab-context"
            aside={<span className="count-pop tabular-nums">{overview.modelCalls.reduce((sum, row) => sum + row.calls, 0)}</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={th}>{t("admin.usage.th.for")}</th>
                  <th className={th}>{t("admin.usage.th.calls")}</th>
                  <th className={th}>{t("admin.usage.th.failed")}</th>
                  <th className={th}>{t("admin.usage.th.fellBack")}</th>
                  <th className={th}>{t("admin.usage.th.median")}</th>
                  <th className={th}>{t("admin.usage.th.p95")}</th>
                  <th className={th}>{t("admin.usage.th.firstWords")}</th>
                  <th className={th}>{t("admin.usage.th.input")}</th>
                  <th className={th}>{t("admin.usage.th.cached")}</th>
                  <th className={th}>{t("admin.usage.th.output")}</th>
                  <th className={th}>{t("admin.usage.th.reasoning")}</th>
                </tr>
              </thead>
              <tbody>
                {overview.modelCalls.map((row) => (
                  <tr key={row.task} className="border-t border-stone-800/60">
                    <td className={td}>
                      <span className="text-stone-100">{row.task.replaceAll("_", " ")}</span>
                    </td>
                    <td className={td}>{row.calls}</td>
                    <td className={td}>{row.errors || "–"}</td>
                    <td className={td}>{row.fallbacks || "–"}</td>
                    <td className={td}>{seconds(row.p50Ms)}</td>
                    <td className={td}>{seconds(row.p95Ms)}</td>
                    <td className={td}>{seconds(row.p50FirstTokenMs)}</td>
                    <td className={td}>{row.avgInputTokens === null ? "–" : compact(row.avgInputTokens)}</td>
                    <td className={td}>{row.cachedShare === null ? "–" : `${Math.round(row.cachedShare * 100)}%`}</td>
                    <td className={td}>{row.avgOutputTokens === null ? "–" : compact(row.avgOutputTokens)}</td>
                    <td className={td}>{row.avgReasoningTokens === null ? "–" : compact(row.avgReasoningTokens)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-stone-500">
            {t("admin.usage.modelCallsNote")}
          </p>
        </section>
      ) : null}

      <AdminNarratorQualityCard />
    </div>
  );
}
