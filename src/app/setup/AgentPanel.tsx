"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ui } from "@/lib/ui";
import { CopyLine } from "@/components/CopyLine";
import { shellHost } from "@/lib/shell-host";
import type { Draft } from "@/app/setup/draft";
import { ModelPicker } from "@/app/setup/SetupParts";
import { blanks } from "@/app/admin/model-blanks";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";
import type { HarnessId, HarnessStatus } from "@/lib/harness/types";

type Update = (change: (draft: Draft) => Draft) => void;

const MARKS: Record<HarnessId, string> = { claude: "CC", codex: "Cx", opencode: "oc", grok: "Gk" };

// The status pill's word, keyed by the machine state the status carries.
const STATUS_KEYS: Record<string, MessageKey> = {
  notAvailable: "setup.agentPanel.status.notAvailable",
  notInstalled: "setup.agentPanel.status.notInstalled",
  signIn: "setup.agentPanel.status.signIn",
  installed: "setup.agentPanel.status.installed",
  ready: "setup.agentPanel.status.ready",
};

function statusKey(status: HarnessStatus): MessageKey {
  if (status.availability !== "ok") return STATUS_KEYS.notAvailable;
  if (!status.installed) return STATUS_KEYS.notInstalled;
  if (status.auth.state === "signed-out") return STATUS_KEYS.signIn;
  if (status.auth.state === "unknown") return STATUS_KEYS.installed;
  return STATUS_KEYS.ready;
}

function statusTone(status: HarnessStatus): "ready" | "warn" | "off" {
  if (status.availability !== "ok") return "off";
  if (!status.installed) return "off";
  if (status.auth.state === "signed-out" || status.auth.state === "unknown") return "warn";
  return "ready";
}

// "An agent you already pay for": each program this server can run, whether
// it is installed and signed in here, and the one command that fixes it when
// it is not. Nothing is saved until the step's Continue; the live test turn
// waits on the last step, once the choice is the server's.
export function AgentPanel({ draft, update }: { draft: Draft; update: Update }) {
  const t = useT();
  const BLANK = blanks(t);
  const [statuses, setStatuses] = useState<HarnessStatus[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const phone = shellHost()?.platform === "android";

  const load = useCallback(
    (refresh: boolean) =>
      fetch(`/api/admin/harness?${refresh ? "refresh=1&" : ""}${phone ? "platform=android" : ""}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data?.statuses) setStatuses(data.statuses as HarnessStatus[]);
        })
        .catch(() => undefined),
    [phone],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  const setAgent = (patch: Partial<Draft["agent"]>) => update((current) => ({ ...current, agent: { ...current.agent, ...patch } }));

  if (!statuses) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400">
        <span className="su-scan" aria-hidden="true" /> {t("setup.agentPanel.looking")}
      </div>
    );
  }

  const chosen = statuses.find((status) => status.id === draft.agent.id) ?? null;
  const unavailable = statuses.every((status) => status.availability !== "ok");

  return (
    <div className="space-y-3">
      {unavailable && statuses[0]?.message ? <p className="su-note">{statuses[0].message}</p> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-400">{t("setup.agentPanel.choose")}</span>
        <button type="button" onClick={refresh} disabled={refreshing} aria-busy={refreshing} className={ui.btnSmall}>
          <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} /> {t("setup.agentPanel.checkAgain")}
        </button>
      </div>
      <div role="radiogroup" aria-label={t("setup.agentPanel.programAria")} className="hx-cards stagger">
        {statuses.map((status) => {
          const pill = statusTone(status);
          const pillText = t(statusKey(status));
          const picked = draft.agent.id === status.id;
          return (
            <button
              key={status.id}
              type="button"
              role="radio"
              aria-checked={picked}
              data-unavailable={status.availability !== "ok" || !status.installed}
              className="hx-card"
              onClick={() => setAgent({ id: status.id, model: picked ? draft.agent.model : "", utilityModel: picked ? draft.agent.utilityModel : "" })}
            >
              <span className="flex items-center gap-2.5">
                <span className="hx-mark" aria-hidden="true">
                  {MARKS[status.id]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-100">{status.label}</span>
                  <span className="block truncate text-[11px] text-stone-500">
                    {status.version ? `v${status.version}` : status.installed ? t("setup.agentPanel.installedWord") : t("setup.agentPanel.notOnThisComputer")}
                    {status.auth.plan ? ` · ${status.auth.plan}` : ""}
                  </span>
                </span>
              </span>
              <span key={pillText} className="hx-pill reveal-pop self-start" data-tone={pill}>
                {pillText}
              </span>
            </button>
          );
        })}
      </div>

      {chosen ? (
        <div key={chosen.id} className="reveal-height space-y-3">
          {chosen.availability === "ok" && !chosen.installed ? (
            <div className="su-row flex-col items-stretch">
              <span className="text-sm text-stone-200">{t("setup.agentPanel.step1", { name: chosen.label })}</span>
              <CopyLine text={chosen.installHint ?? ""} label={t("setup.agentPanel.installLabel")} />
              <span className="text-sm text-stone-200">{t("setup.agentPanel.step2")}</span>
              <CopyLine text={chosen.signInHint ?? ""} label={t("setup.agentPanel.signInLabel")} />
              <span className="text-xs text-stone-500">{t("setup.agentPanel.runBoth")}</span>
            </div>
          ) : chosen.installed && chosen.auth.state === "signed-out" ? (
            <div className="su-row flex-col items-stretch">
              <span className="text-sm text-stone-200">{t("setup.agentPanel.signIn", { name: chosen.label })}</span>
              <CopyLine text={chosen.signInHint ?? ""} label={t("setup.agentPanel.signInLabel")} />
              <span className="text-xs text-stone-500">{t("setup.agentPanel.signInNote")}</span>
            </div>
          ) : chosen.message ? (
            <p className="su-note">{chosen.message}</p>
          ) : null}
          {chosen.installed ? (
            <p className="text-xs text-stone-500">
              {t("setup.agentPanel.pathNote", {
                path: chosen.path ?? "",
                account: chosen.auth.account ? t("setup.agentPanel.signedInAs", { account: chosen.auth.account }) : "",
              })}
            </p>
          ) : null}
          {chosen.models.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ModelPicker
                label={t("setup.agentPanel.storyModel")}
                models={[{ id: "", label: BLANK.programDefault }, ...chosen.models.map((model) => ({ id: model.id, label: model.label }))]}
                value={draft.agent.model}
                recommended=""
                onChange={(model) => setAgent({ model })}
              />
              <ModelPicker
                label={t("setup.agentPanel.utilityModel")}
                models={[
                  { id: "", label: BLANK.utility },
                  ...[...chosen.models]
                    .sort((a, b) => Number(Boolean(b.cheap)) - Number(Boolean(a.cheap)))
                    .map((model) => ({ id: model.id, label: model.cheap ? `${model.label}${t("setup.agentPanel.lightSuffix")}` : model.label })),
                ]}
                value={draft.agent.utilityModel}
                recommended=""
                onChange={(utilityModel) => setAgent({ utilityModel })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
