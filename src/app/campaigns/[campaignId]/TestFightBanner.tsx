"use client";

import Link from "next/link";
import { useState } from "react";
import { appConfirm } from "@/components/ui/ConfirmDialog";
import { SessionBanner, bannerButtonClass } from "@/app/campaigns/[campaignId]/SessionBanner";
import { PanelError } from "@/app/campaigns/[campaignId]/PanelKit";
import { navigateTo } from "@/lib/navigation";
import { workshopHref } from "@/lib/workshop/links";
import { useT } from "@/lib/locale";

// The test fight's way back (issue 553, src/lib/workshop/test-fight.ts): a
// test table is in no campaign list, so the table itself says what it is and
// offers the two ways out. Back keeps the test for later, from the
// workshop's Encounters; End deletes the table and everything played on it.

export function TestFightBanner({
  campaignId,
  source,
  runsIt,
}: {
  campaignId: string;
  source: { workshopId: string; title: string };
  // Who runs the enemies: the AI DM, or the author from the DM seat.
  runsIt: "ai" | "person";
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const back = workshopHref(`/workshop/${source.workshopId}`, { system: "encounters" });

  async function end() {
    if (
      !(await appConfirm(t("table.misc.testFight.confirm"), {
        title: t("table.misc.testFight.confirmTitle"),
        actionLabel: t("table.misc.testFight.end"),
      }))
    ) {
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(payload?.error ?? (response ? t("table.misc.testFight.endFailed") : t("table.misc.testFight.unreachable")));
      setBusy(false);
      return;
    }
    navigateTo(back);
  }

  return (
    <SessionBanner
      glyph="tab-battle"
      title={t("table.misc.testFight.title")}
      className="test-fight-banner"
      actions={
        <>
          <Link href={back} className={bannerButtonClass()}>
            {t("table.misc.testFight.back")}
          </Link>
          <button type="button" disabled={busy} aria-busy={busy} onClick={() => void end()} className={bannerButtonClass(true)}>
            {t("table.misc.testFight.end")}
          </button>
        </>
      }
    >
      {runsIt === "ai"
        ? t("table.misc.testFight.ai", { name: source.title })
        : t("table.misc.testFight.person", { name: source.title })}
      {error ? <PanelError className="mt-1 text-[11px]">{error}</PanelError> : null}
    </SessionBanner>
  );
}
