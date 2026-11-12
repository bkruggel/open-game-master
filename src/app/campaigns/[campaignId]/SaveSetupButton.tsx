"use client";

import { useState } from "react";
import { appConfirm, appNotice } from "@/components/ui/ConfirmDialog";
import { bannerButtonClass } from "@/app/campaigns/[campaignId]/SessionBanner";
import { readWrite } from "@/lib/load-state";
import { hostOffers, useCapabilities } from "@/lib/use-capabilities";
import { useT } from "@/lib/locale";

// "Save as set-up" on a test table (issue 685, src/lib/workshop/fight-setup.ts):
// the moment on the table becomes the prepared fight's set-up, and every
// test of it opens there from now on. The control the report asked for in
// place of redoing every console step by hand at each test; the set-up is
// loaded by default once it exists, so there is no second control to load
// it. Hidden on a host that cannot save one.

export function SaveSetupButton({ campaignId }: { campaignId: string }) {
  const t = useT();
  const capabilities = useCapabilities();
  const [busy, setBusy] = useState(false);
  if (!hostOffers(capabilities, "fightSetups")) {
    return null;
  }

  async function save() {
    if (
      !(await appConfirm(
        t("table.setup.saveConfirm"),
        // A save, so the kit's own button, not the red of a deletion; the
        // sentence above already says it replaces an earlier set-up.
        { title: t("table.setup.saveTitle"), actionLabel: t("table.setup.saveTitle"), tone: "plain" },
      ))
    ) {
      return;
    }
    setBusy(true);
    const sent = await readWrite<{ lines: string[]; keptMap: boolean }>(
      t,
      fetch(`/api/campaigns/${campaignId}/fight-setup`, { method: "POST" }),
      t("load.write.setupSave"),
    );
    setBusy(false);
    if (sent.error !== null) {
      await appNotice(sent.error, t("table.setup.notSavedNotice"));
      return;
    }
    const kept = sent.payload.keptMap ? ` ${t("table.setup.keptMap")}` : "";
    await appNotice(`${sent.payload.lines.join(" ")}${kept}`, t("table.setup.savedNotice"));
  }

  return (
    <button type="button" disabled={busy} aria-busy={busy} onClick={() => void save()} className={bannerButtonClass()} data-save-setup>
      {busy ? t("table.setup.saving") : t("table.setup.saveTitle")}
    </button>
  );
}
