"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useAmbienceInstall, type AmbienceCounts } from "@/app/admin/useAmbienceInstall";
import { PageSection } from "@/components/PageShell";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

// The sound library in the admin panel: how much of the catalog has audio,
// one button that installs the release's sound pack, and a rescan for files
// dropped into public/ambience by hand. Polls while a pack comes down, the
// way the built-in speech card does. The desktop and phone apps ship
// without the library (it would triple the download), so for them this
// card, and the same button in the table's Sound panel, is how it arrives.

const LAYER_KEYS: Record<keyof AmbienceCounts, MessageKey> = {
  bed: "admin.sound.layer.bed",
  music: "admin.sound.layer.music",
  sting: "admin.sound.layer.sting",
};

const LAYER: Array<{ key: keyof AmbienceCounts }> = [
  { key: "bed" },
  { key: "music" },
  { key: "sting" },
];

export function AmbienceLibraryCard() {
  const t = useT();
  const { status, error, installing, percent, install, rescan } = useAmbienceInstall();
  const [url, setUrl] = useState("");

  const total = status ? LAYER.reduce((sum, layer) => sum + status.counts[layer.key].total, 0) : 0;
  const have = status ? LAYER.reduce((sum, layer) => sum + status.counts[layer.key].installed, 0) : 0;

  return (
    <PageSection
      id="admin-ambience"
      heading={t("admin.sound.heading")}
      glyph="tab-ambience"
      intro={t("admin.sound.intro")}
    >
      <div className="space-y-4">
        {status ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {LAYER.map((layer) => {
              const count = status.counts[layer.key];
              const share = count.total ? count.installed / count.total : 0;
              return (
                <div key={layer.key} className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className={ui.sectionEyebrow}>{t(LAYER_KEYS[layer.key])}</span>
                    <span className="text-sm text-stone-200">
                      {t("admin.sound.of", { installed: count.installed, total: count.total })}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-800">
                    <div className="h-full rounded-full bg-amber-400/80 transition-[width] duration-500" style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    {t("admin.sound.files", { count: count.files })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => install(url)}
            disabled={!status || installing}
            className={ui.btnPrimary}
          >
            {installing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {installing
              ? t("admin.sound.installing", { percent })
              : have && have === total
                ? t("admin.sound.install.reinstall")
                : have
                  ? t("admin.sound.install.some")
                  : t("admin.sound.install.none")}
          </button>
          <button type="button" onClick={rescan} disabled={!status || installing} className={ui.btnSecondary}>
            {t("admin.sound.rescan")}
          </button>
          {status?.status === "ready" && status.result ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-300">
              <Check className="size-4" aria-hidden="true" />
              {t("admin.sound.installedTracks", {
                count: status.result.installed,
                kept: status.result.kept ? t("admin.sound.installedKept", { count: status.result.kept }) : "",
              })}
            </span>
          ) : null}
          {status?.status === "error" ? (
            <span className="inline-flex items-center gap-1 text-sm text-red-300">
              <X className="size-4" aria-hidden="true" />
              {status.error}
            </span>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-stone-500">
            {t("admin.sound.packUrl", { url: status ? ` (${status.packUrl})` : "" })}
          </span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://.../ambience-pack.zip"
            className={ui.input}
            disabled={installing}
          />
        </label>
        <p className="text-xs leading-5 text-stone-500">
          {t("admin.sound.fetchNote")}
        </p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </PageSection>
  );
}
