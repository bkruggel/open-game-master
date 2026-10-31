"use client";

import { ui } from "@/lib/ui";
import { GameIcon } from "@/components/ui/GameIcon";
import type { Draft } from "@/app/setup/draft";
import { Lamp, ScanMark, host, type ScanResult } from "@/app/setup/SetupParts";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

type Update = (change: (draft: Draft) => Draft) => void;

// The five stops the wizard will make, keyed into the dictionaries.
const STOPS: Array<{ glyph: string; title: MessageKey; line: MessageKey }> = [
  { glyph: "ui-ai", title: "setup.stop.story", line: "setup.stop.storyLine" },
  { glyph: "ui-paint", title: "setup.stop.pictures", line: "setup.stop.picturesLine" },
  { glyph: "tab-ambience", title: "setup.stop.voice", line: "setup.stop.voiceLine" },
  { glyph: "tab-characters", title: "setup.stop.players", line: "setup.stop.playersLine" },
  { glyph: "system-share", title: "setup.stop.agent", line: "setup.stop.agentLine" },
];

// The first step: a name, what the wizard is about to ask, and what the scan
// has already found on this computer while the admin reads.
export function WelcomeStep({
  draft,
  update,
  scan,
  scanning,
}: {
  draft: Draft;
  update: Update;
  scan: ScanResult | null;
  scanning: boolean;
}) {
  const t = useT();
  const found: Array<{ key: string; text: string }> = [
    ...(scan?.text ?? []).map((entry) => ({
      key: entry.baseUrl,
      text:
        t("setup.welcome.at", { label: entry.label, host: host(entry.baseUrl) }) +
        (entry.models.length ? ` (${t("setup.welcome.modelCount", { count: entry.models.length })})` : ""),
    })),
    ...(scan?.comfyui ? [{ key: "comfy", text: t("setup.welcome.comfy", { host: host(scan.comfyui.url) }) }] : []),
    ...(scan?.kokoro ? [{ key: "kokoro", text: t("setup.welcome.kokoro", { host: host(scan.kokoro.url) }) }] : []),
    ...(scan?.whisper ? [{ key: "whisper", text: t("setup.welcome.whisper", { host: host(scan.whisper.url) }) }] : []),
  ];
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-stone-400">{t("setup.welcome.serverName")}</span>
        <input
          className={ui.input}
          value={draft.serverName}
          maxLength={100}
          onChange={(event) => update((current) => ({ ...current, serverName: event.target.value }))}
          placeholder="Open Game Master"
        />
        <span className="mt-1 block text-[11px] text-stone-500">{t("setup.welcome.serverNameHint")}</span>
      </label>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-stone-200">{t("setup.welcome.whatHeading")}</h4>
        <ul className="stagger space-y-1.5">
          {STOPS.map((stop) => (
            <li key={stop.title} className="flex items-start gap-3">
              <GameIcon icon={{ kind: "glyph", key: stop.glyph }} size="size-7" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="text-stone-100">{t(stop.title)}</span>
                <span className="block text-xs text-stone-500">{t(stop.line)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2" aria-live="polite">
        <h4 className="flex items-center gap-2 text-sm font-medium text-stone-200">
          <ScanMark scanning={scanning} found={found.length > 0} />
          {scanning
            ? t("setup.welcome.scanning")
            : found.length
              ? t("setup.welcome.found")
              : t("setup.welcome.none")}
        </h4>
        {found.length ? (
          <ul className="stagger flex flex-wrap gap-2">
            {found.map((entry) => (
              <li key={entry.key} className="hx-pill reveal-pop" data-tone="ready">
                <Lamp tone="ok" /> {entry.text}
              </li>
            ))}
          </ul>
        ) : !scanning ? (
          <p className="text-xs text-stone-500">
            {t("setup.welcome.noneHint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
