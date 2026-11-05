"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { SectionHead } from "@/components/ui/SectionHead";
import { DRAFT_COUNT_MAX } from "@/lib/dm/pregen-draft-logic";
import type { TargetParty } from "@/lib/workshop/kind";
import { useT } from "@/lib/locale";
import { translate } from "@/lib/messages-logic";

// "Draft pregens" (src/lib/dm/pregen-draft.ts): the AI DM reads the
// workshop's adventure and proposes a party, and the builder's own rules
// build each hero. The drafts land on the roster unticked; nothing reaches a
// player until the DM ticks Offer to players. With no AI DM set up the
// button is off and says why.

export type DraftReadiness = { ready: boolean; reason: string };

// Whether this workshop's AI DM can draft, or null while asking. A failed
// ask leaves the button off with a reason rather than guessing. Asked again
// when the DM comes back to it (from Admin or the workshop's Story AI, in
// another tab, or in the apps, which keep a screen mounted behind the next
// one), so a model set up meanwhile turns the button on without a reload.
function useDraftReadiness(workshopId: string): DraftReadiness | null {
  const [readiness, setReadiness] = useState<DraftReadiness | null>(null);
  const pathname = usePathname();
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") setAsked((count) => count + 1);
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, []);
  useEffect(() => {
    if (!workshopId) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/workshops/${workshopId}/pregens/draft`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Partial<DraftReadiness> & { error?: string };
        if (cancelled) return;
        setReadiness(
          response.ok
            ? { ready: Boolean(payload.ready), reason: payload.reason ?? "" }
            : { ready: false, reason: payload.error ?? translate("en", "workshop.party.draft.couldNotAsk") },
        );
      })
      .catch(() => {
        if (!cancelled) setReadiness({ ready: false, reason: translate("en", "workshop.party.draft.askUnreachable") });
      });
    return () => {
      cancelled = true;
    };
  }, [workshopId, pathname, asked]);
  return readiness;
}

export type DraftResult = { drafted: string[]; changes: string[]; level: number; pregens: unknown[] };

// One draft, as the route answers it: the result, or what went wrong.
// The server drafts for the party the workshop has saved.
export async function requestDraft(workshopId: string, t?: (key: string, vars?: Record<string, string | number>) => string): Promise<{ ok: true; result: DraftResult } | { ok: false; error: string }> {
  const say = t ?? ((key: string, vars?: Record<string, string | number>) => translate("en", key, vars));
  try {
    const response = await fetch(`/api/workshops/${workshopId}/pregens/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: (payload as { error?: string }).error ?? say("workshop.party.draft.notDrafted") };
    }
    return { ok: true, result: payload as DraftResult };
  } catch {
    return { ok: false, error: say("workshop.party.draft.unreachable") };
  }
}

export function DraftPregensCard({
  workshopId,
  targetParty,
  onDrafted,
}: {
  workshopId: string;
  // The party the workshop is built for (the bar at the top): one hero is
  // drafted for each of its seats, at its level, as Build makes one.
  targetParty: TargetParty;
  onDrafted: (result: DraftResult) => void;
}) {
  const readiness = useDraftReadiness(workshopId);
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<DraftResult | null>(null);
  const count = Math.min(DRAFT_COUNT_MAX, Math.max(1, targetParty.size));
  const heroes = t("workshop.party.draft.heroes", { count });

  async function draft() {
    setBusy(true);
    setError("");
    setDone(null);
    const outcome = await requestDraft(workshopId, t);
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.error);
      return;
    }
    setDone(outcome.result);
    onDrafted(outcome.result);
  }

  const off = !readiness?.ready;
  return (
    <div className={cn(ui.card, "space-y-2 p-3")} data-pregen-draft data-tour="party-draft">
      <SectionHead title={t("workshop.party.draft.title")} glyph="system-party" className="mb-0" />
      <p className="text-xs text-stone-400">
        {t("workshop.party.draft.blurb", { heroes, level: targetParty.level })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || off} onClick={() => void draft()} className={ui.btnPrimary} data-pregen-draft-go>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {t("workshop.party.draft.button", { count })}
        </button>
      </div>
      {readiness === null ? <p className="text-xs text-stone-500">{t("workshop.party.draft.asking")}</p> : null}
      {readiness && !readiness.ready ? (
        <p className="text-xs text-amber-200/90" data-pregen-draft-reason>
          {readiness.reason}
        </p>
      ) : null}
      <div aria-live="polite" className="space-y-1">
        {busy ? <p className="text-xs text-stone-300">{t("workshop.party.draft.drafting", { heroes })}</p> : null}
        {done ? (
          <div className="reveal space-y-1 text-xs text-stone-300" data-pregen-draft-done>
            <p>
              {t("workshop.party.draft.doneLine", { count: done.drafted.length, level: done.level })}
            </p>
            {done.changes.length ? (
              <ul className="list-disc space-y-0.5 pl-4 text-stone-400">
                {done.changes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="motion-shake text-xs text-red-400" role="alert" data-pregen-draft-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
