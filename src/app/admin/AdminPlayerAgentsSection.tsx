"use client";

import { LoadFailed } from "@/app/campaigns/[campaignId]/PanelKit";
import { readLoad, useLoadStatus } from "@/lib/load-state";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ui } from "@/lib/ui";
import { Switch } from "@/components/ui/Switch";
import { useT } from "@/lib/locale";

// The receiver addresses player agents' webhooks may reach
// (docs/player-webhooks.md). Saved on each change and live at once: the
// first address turns delivery on with no restart. Addresses from the
// ODM_PLAYER_WEBHOOK_ORIGINS environment variable are listed too, read-only.
// Below them, the switch for poll links, for agents nothing can send to.
export function AdminPlayerAgentsSection() {
  const t = useT();
  const [origins, setOrigins] = useState<string[] | null>(null);
  const [envOrigins, setEnvOrigins] = useState<string[]>([]);
  const [pollLinks, setPollLinks] = useState(false);
  const { loadError, settle } = useLoadStatus();
  const [reloads, setReloads] = useState(0);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    readLoad<{ origins?: string[]; envOrigins?: string[]; pollLinks?: boolean }>(t, fetch("/api/admin/player-webhooks"), t("load.label.receiverAddresses")).then((outcome) => {
      settle(outcome);
      if (outcome.payload) {
        setOrigins(outcome.payload.origins ?? []);
        setEnvOrigins(outcome.payload.envOrigins ?? []);
        setPollLinks(outcome.payload.pollLinks === true);
      }
    });
  }, [ reloads, settle, t ]);
  async function save(change: { origins: string[] } | { pollLinks: boolean }) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/player-webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? t("admin.playerAgents.saveFailed"));
        return false;
      }
      setOrigins(data.origins ?? origins);
      setEnvOrigins(data.envOrigins ?? envOrigins);
      setPollLinks(data.pollLinks === true);
      return true;
    } catch {
      setError(t("admin.worlds.unreachable"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (await save({ origins: [...(origins ?? []), address.trim()] })) setAddress("");
  }

  if (origins === null) {
    return loadError ? (
      <LoadFailed error={loadError} onRetry={() => setReloads((current) => current + 1)} />
    ) : (
      <div className="skeleton-block h-12 rounded-xl" aria-label={t("admin.playerAgents.loadAria")} />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-400">
        {t("admin.playerAgents.intro")}
      </p>
      {origins.length === 0 && envOrigins.length === 0 ? (
        <p className="text-xs text-stone-500">{t("admin.playerAgents.none")}</p>
      ) : (
        <ul className="space-y-2">
          {envOrigins.map((origin) => (
            <li key={`env-${origin}`} className="plate-row">
              <code className="min-w-0 flex-1 truncate text-sm text-stone-200">{origin}</code>
              <span className="text-[11px] text-stone-500">{t("admin.playerAgents.fromEnv")}</span>
            </li>
          ))}
          {origins.map((origin) => (
            <li key={origin} className="plate-row">
              <code className="min-w-0 flex-1 truncate text-sm text-stone-200">{origin}</code>
              <button
                type="button"
                className={ui.btnSmall}
                disabled={busy}
                onClick={() => void save({ origins: origins.filter((entry) => entry !== origin) })}
              >
                <Trash2 className="size-3.5" /> {t("action.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-400">{t("admin.playerAgents.address")}</span>
          <input
            className={ui.input}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && address.trim() && !busy) void add();
            }}
            placeholder="https://my-pc.example.ts.net:8443"
          />
        </label>
        <button type="button" className={ui.btnSecondary} disabled={busy || !address.trim()} onClick={() => void add()} aria-busy={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {t("admin.playerAgents.allow")}
        </button>
      </div>
      <label className="flex items-start gap-3 border-t border-stone-800 pt-3 text-sm text-stone-300">
        <Switch label={t("admin.playerAgents.poll")} on={pollLinks} disabled={busy} onChange={(next) => void save({ pollLinks: next })} />
        <span>
          {t("admin.playerAgents.poll")}
          <span className="block text-xs text-stone-500">
            {t("admin.playerAgents.pollHint")}
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="motion-shake text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
