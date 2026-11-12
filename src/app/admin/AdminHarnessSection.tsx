"use client";

import { Check, Loader2, RefreshCw, ShieldCheck, ShieldHalf } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { shellHost } from "@/lib/shell-host";
import { ui } from "@/lib/ui";
import { PageSection } from "@/components/PageShell";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Switch } from "@/components/ui/Switch";
import { CopyLine } from "@/components/CopyLine";
import { Field, SelectField } from "@/app/admin/AdminSettingsFields";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";
import { blanks } from "@/app/admin/model-blanks";
import type { AdminConfigDraftPatch } from "@/app/admin/merge-config-draft";
import { HarnessTestPanel } from "@/app/admin/HarnessTestPanel";
import { SpeedField } from "@/app/admin/SpeedField";
import { agentSpeedEligibility } from "@/lib/speed-tier";
import type { SpeedChannel, SpeedNote } from "@/lib/speed-status";
import { effortChoices, utilityEffortChoices, withOfferedEffort } from "@/lib/harness/effort-choices";
import type { HarnessConfig, HarnessId, HarnessStatus } from "@/lib/harness/types";
import { useRecheckOnReturn } from "@/app/admin/recheck-on-return";

type Payload = {
  statuses: HarnessStatus[];
  config: HarnessConfig;
  usage: { utilization: number; resetsAt?: number; window?: string } | null;
  activeSessions: number;
  recent: Array<{ tool: string; ok: boolean; ms: number; createdAt: string; campaignId: string | null }>;
};

const MARKS: Record<HarnessId, string> = { claude: "CC", codex: "Cx", opencode: "oc", grok: "Gk" };

// The efforts the chosen models offer (src/lib/harness/effort-choices.ts). A
// saved effort they do not list, after the program's list changed, stays
// shown with the reason it runs at the model's own default.
function EffortField({
  status,
  draft,
  onChange,
}: {
  status: HarnessStatus;
  draft: HarnessConfig;
  onChange: (effort: HarnessConfig["effort"]) => void;
}) {
  const t = useT();
  const offered = effortChoices(status, draft);
  const stale = !offered.includes(draft.effort);
  return (
    <SelectField
      label={t("admin.harness.effort")}
      hint={stale ? t("admin.harness.effort.staleNamed", { effort: draft.effort }) : undefined}
      value={draft.effort}
      onChange={onChange}
      options={(stale ? [...offered, draft.effort] : offered).map((effort) => ({
        value: effort,
        label: effort ? effort[0].toUpperCase() + effort.slice(1) : t("admin.harness.effort.default"),
      }))}
    />
  );
}

// The bookkeeping model's effort: its own list, blank following the story's.
function UtilityEffortField({
  status,
  draft,
  onChange,
}: {
  status: HarnessStatus;
  draft: HarnessConfig;
  onChange: (effort: HarnessConfig["utilityEffort"]) => void;
}) {
  const t = useT();
  const offered = utilityEffortChoices(status, draft);
  const stale = !offered.includes(draft.utilityEffort);
  return (
    <SelectField
      label={t("admin.harness.utilityEffort")}
      hint={stale ? t("admin.harness.utilityEffort.staleNamed", { effort: draft.utilityEffort }) : t("admin.harness.utilityEffort.hint")}
      value={draft.utilityEffort}
      onChange={onChange}
      options={(stale ? [...offered, draft.utilityEffort] : offered).map((effort) => ({
        value: effort,
        label: effort ? effort[0].toUpperCase() + effort.slice(1) : t("admin.harness.utilityEffort.same"),
      }))}
    />
  );
}

// The status pill's word, keyed by the machine state the status carries;
// its tone travels with the same branches.
const STATUS_KEYS: Record<string, MessageKey> = {
  notAvailable: "admin.harness.status.notAvailable",
  notInstalled: "admin.harness.status.notInstalled",
  signIn: "admin.harness.status.signIn",
  installed: "admin.harness.status.installed",
  ready: "admin.harness.status.ready",
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

// The admin's agent program (docs/archive/harness-mcp-plan.md 6): a card per program
// this server knows how to run, each saying whether it is installed, signed
// in and locked down, then the models and limits for the chosen one. Saved on
// its own, so choosing a program never rides along with an unrelated edit.
export function AdminHarnessSection({
  textProvider,
  imagesBackend = "",
  onConfig,
  speedNotes = {},
}: {
  textProvider: string;
  // The server's default picture backend, to say whether the tables already
  // paint with the agent.
  imagesBackend?: string;
  onConfig: (patch: AdminConfigDraftPatch) => void;
  // What the last Fast calls ran at (issue 255).
  speedNotes?: Partial<Record<SpeedChannel, SpeedNote>>;
}) {
  const t = useT();
  const BLANK = blanks(t);
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<HarnessConfig | null>(null);
  // null follows the saved default provider; a flip is held until saved.
  const [defaultOverride, setDefaultOverride] = useState<boolean | null>(null);
  const useAsDefault = defaultOverride ?? textProvider === "harness";
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const phone = shellHost()?.platform === "android";

  const load = useCallback(
    (refresh = false) =>
      fetch(`/api/admin/harness?${refresh ? "refresh=1&" : ""}${phone ? "platform=android" : ""}`)
        .then((response) => (response.ok ? (response.json() as Promise<Payload>) : null))
        .then((payload) => {
          if (payload) {
            setData(payload);
            setDraft((current) => current ?? payload.config);
          }
        })
        .catch(() => undefined),
    [phone],
  );

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/harness${phone ? "?platform=android" : ""}`)
      .then((response) => (response.ok ? (response.json() as Promise<Payload>) : null))
      .then((payload) => {
        if (live && payload) {
          setData(payload);
          setDraft((current) => current ?? payload.config);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [phone]);

  // The server asks the saved program again on every load.
  useRecheckOnReturn(useCallback(() => void load(false), [load]));

  if (!data || !draft) {
    return (
      <PageSection id="admin-harness" heading={t("admin.harness.heading")} glyph="ui-agent">
        <div className="skeleton-block h-28 rounded-xl" aria-label={t("admin.harness.loadingAria")} />
      </PageSection>
    );
  }

  const chosen = data.statuses.find((status) => status.id === draft.id) ?? null;
  // imagesVerifiedAt is the server's own mark (a test picture sets it), never
  // an edit: comparing it made a passing picture test read as unsaved
  // changes and grey out "Test the table".
  const comparable = ({ imagesVerifiedAt: _verified, ...rest }: HarnessConfig) => {
    void _verified;
    return JSON.stringify(rest);
  };
  const dirty = comparable(draft) !== comparable(data.config) || useAsDefault !== (textProvider === "harness");
  const savedChoice = Boolean(data.config.id) && data.config.id === draft.id && !dirty;
  const everywhereUnavailable = data.statuses.every((status) => status.availability !== "ok");

  async function refresh() {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { imagesVerifiedAt: _verified, ...harness } = draft;
      void _verified;
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          harness,
          ...(useAsDefault
            ? { text: { provider: "harness" } }
            : textProvider === "harness"
              ? { text: { provider: "" } }
              : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? t("admin.harness.saveFailed"));
        return;
      }
      // Only what this save changed goes into the panel's draft (PR 221):
      // the harness block and the storyteller choice, as the server now holds
      // them. Unsaved edits in the other sections stay as typed.
      onConfig({ harness: body.config.harness, text: { provider: body.config.text.provider } });
      setData((current) => (current ? { ...current, config: body.config.harness } : current));
      setDraft(body.config.harness);
      setDefaultOverride(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      void load();
    } finally {
      setSaving(false);
    }
  }

  // The test's "Paint the tables' pictures with it" changed the saved
  // settings on the server: both this section's draft and the panel's copy
  // take them up, or the next save here or there would switch it back off.
  async function adopted() {
    const settings = await fetch("/api/admin/settings")
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (settings?.config) {
      onConfig({
        harness: { images: settings.config.harness.images },
        images: { defaultBackend: settings.config.images.defaultBackend },
      });
      setDraft(settings.config.harness as HarnessConfig);
      setData((current) => (current ? { ...current, config: settings.config.harness } : current));
    }
    void load(true);
  }

  const models = chosen?.models ?? [];
  const usage = data.usage;

  return (
    <PageSection id="admin-harness" heading={t("admin.harness.heading")} glyph="ui-agent">
      <p className="mb-3 text-xs text-stone-500">
        {t("admin.harness.intro")}
      </p>
      {everywhereUnavailable ? (
        <p className="reveal mb-3 rounded-lg border border-amber-700/40 bg-amber-950/30 p-3 text-xs text-amber-200">
          {data.statuses[0]?.message}
        </p>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-400">{t("admin.harness.choose")}</span>
        <button type="button" onClick={refresh} disabled={refreshing} className={ui.btnSmall} aria-busy={refreshing}>
          <RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} /> {t("admin.harness.checkAgain")}
        </button>
      </div>
      <div role="radiogroup" aria-label={t("admin.harness.programAria")} className="hx-cards stagger">
        {data.statuses.map((status) => {
          const pill = statusTone(status);
          const pillText = t(statusKey(status));
          const picked = draft.id === status.id;
          return (
            <button
              key={status.id}
              type="button"
              role="radio"
              aria-checked={picked}
              data-unavailable={status.availability !== "ok" || !status.installed}
              className="hx-card"
              onClick={() => setDraft({ ...draft, id: picked ? "" : status.id, model: picked ? draft.model : "", utilityModel: picked ? draft.utilityModel : "" })}
            >
              <span className="flex items-center gap-2.5">
                <span className="hx-mark" aria-hidden="true">
                  {MARKS[status.id]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-stone-100">{status.label}</span>
                  <span className="block truncate text-[11px] text-stone-500">
                    {status.version ? `v${status.version}` : status.installed ? t("admin.harness.installedWord") : t("admin.harness.dash")}
                    {status.auth.plan ? ` · ${status.auth.plan}` : ""}
                  </span>
                </span>
              </span>
              <span key={pillText} className="hx-pill reveal-pop self-start" data-tone={pill}>
                {pillText}
              </span>
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="hx-chip">
                  {status.lockdown === "removed" ? <ShieldCheck className="size-3.5" /> : <ShieldHalf className="size-3.5" />}
                  {status.lockdown === "removed" ? t("admin.harness.lockdown.removed") : t("admin.harness.lockdown.boxed")}
                  {status.lockdownProven ? "" : t("admin.harness.lockdown.untested")}
                </span>
                <span className="hx-chip">
                  {status.nativeImages === "no" ? t("admin.harness.pictures.no") : status.nativeImages === "verified" ? t("admin.harness.pictures.verified") : t("admin.harness.pictures.untested")}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {chosen ? (
        <div key={chosen.id} className="reveal-height mt-4">
          <div className="space-y-3">
            {chosen.message ? <p className="text-xs text-amber-300/90">{chosen.message}</p> : null}
            {chosen.availability === "ok" && !chosen.installed ? (
              <Field label={t("admin.harness.installField")}>
                <CopyLine text={chosen.installHint ?? ""} label="install command" />
              </Field>
            ) : null}
            {chosen.installed && chosen.auth.state === "signed-out" ? (
              <Field label={t("admin.harness.signInField")}>
                <CopyLine text={chosen.signInHint ?? ""} label="sign-in command" />
              </Field>
            ) : null}
            {chosen.installed ? (
              <p className="text-xs text-stone-500">
                {chosen.path}
                {chosen.auth.account ? t("admin.harness.signedInAs", { account: chosen.auth.account }) : ""}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label={t("admin.harness.storyModel")}
                value={draft.model}
                onChange={(model) => setDraft(withOfferedEffort(chosen, { ...draft, model }))}
                options={[
                  { value: "", label: BLANK.programDefault },
                  ...models.map((model) => ({ value: model.id, label: model.deprecated ? `${model.label}${t("admin.harness.deprecatedSuffix")}` : model.label })),
                  ...(draft.model && !models.some((model) => model.id === draft.model)
                    ? [{ value: draft.model, label: draft.model }]
                    : []),
                ]}
              />
              <SelectField
                label={t("admin.harness.utilityModel")}
                hint={t("admin.harness.utilityHint")}
                value={draft.utilityModel}
                onChange={(utilityModel) => setDraft(withOfferedEffort(chosen, { ...draft, utilityModel }))}
                options={[
                  { value: "", label: BLANK.utility },
                  ...[...models].sort((a, b) => Number(Boolean(b.cheap)) - Number(Boolean(a.cheap))).map((model) => ({
                    value: model.id,
                    label: `${model.cheap ? `${model.label}${t("admin.harness.lightSuffix")}` : model.label}${model.deprecated ? t("admin.harness.deprecatedSuffix") : ""}`,
                  })),
                  ...(draft.utilityModel && !models.some((model) => model.id === draft.utilityModel)
                    ? [{ value: draft.utilityModel, label: draft.utilityModel }]
                    : []),
                ]}
              />
              {chosen.id === "claude" || chosen.id === "codex" ? (
                <>
                  <SpeedField
                    label={t("admin.harness.storySpeed")}
                    value={draft.speed}
                    onChange={(speed) => setDraft({ ...draft, speed })}
                    eligibility={agentSpeedEligibility(t, { harnessId: chosen.id, model: draft.model, models })}
                    note={speedNotes["agent-story"]}
                  />
                  <SpeedField
                    label={t("admin.harness.utilitySpeed")}
                    value={draft.utilitySpeed}
                    onChange={(utilitySpeed) => setDraft({ ...draft, utilitySpeed })}
                    eligibility={agentSpeedEligibility(t, { harnessId: chosen.id, model: draft.utilityModel || draft.model, models })}
                    note={speedNotes["agent-utility"]}
                  />
                </>
              ) : null}
              {chosen.id === "claude" || chosen.id === "codex" || chosen.id === "opencode" ? (
                <>
                  <EffortField status={chosen} draft={draft} onChange={(effort) => setDraft({ ...draft, effort })} />
                  <UtilityEffortField status={chosen} draft={draft} onChange={(utilityEffort) => setDraft({ ...draft, utilityEffort })} />
                </>
              ) : null}
              <SelectField
                label={t("admin.harness.whoMay")}
                value={draft.campaigns}
                onChange={(campaigns) => setDraft({ ...draft, campaigns })}
                options={[
                  { value: "all" as const, label: t("admin.harness.whoMay.all") },
                  { value: "admins" as const, label: t("admin.harness.whoMay.admins") },
                ]}
              />
              <Field group label={t("admin.harness.concurrent")} hint={t("admin.harness.concurrentHint")}>
                <NumberStepper
                  label={t("admin.harness.concurrent")}
                  min={1}
                  max={8}
                  step={1}
                  value={draft.maxConcurrent}
                  onChange={(next) => setDraft({ ...draft, maxConcurrent: Math.min(8, Math.max(1, Math.round(Number(next)) || 1)) })}
                />
              </Field>
              <Field group label={t("admin.harness.timeout")} hint={t("admin.harness.timeoutHint")}>
                <NumberStepper
                  label={t("admin.harness.timeoutField")}
                  min={60}
                  max={900}
                  step={30}
                  suffix={t("admin.harness.seconds")}
                  value={draft.turnTimeoutSec}
                  onChange={(next) =>
                    setDraft({ ...draft, turnTimeoutSec: Math.min(900, Math.max(60, Math.round(Number(next)) || 240)) })
                  }
                />
              </Field>
            </div>
            {chosen.nativeImages !== "no" ? (
              <label className="flex items-center gap-3 text-sm text-stone-300">
                <Switch
                  label={t("admin.harness.paintSwitch")}
                  on={draft.images === "native"}
                  disabled={chosen.nativeImages !== "verified"}
                  onChange={(on) => setDraft({ ...draft, images: on ? "native" : "off" })}
                />
                <span>
                  {t("admin.harness.paintSwitch")}
                  <span className="block text-xs text-stone-500">
                    {chosen.nativeImages === "verified"
                      ? t("admin.harness.paint.verified")
                      : t("admin.harness.paint.unverified")}
                  </span>
                </span>
              </label>
            ) : null}
            <Field label={t("admin.harness.path")} hint={t("admin.harness.pathHint")}>
              <input
                className={ui.input}
                value={draft.binaryPath}
                onChange={(event) => setDraft({ ...draft, binaryPath: event.target.value })}
                placeholder={chosen.path ?? ""}
              />
            </Field>
            <label className="flex items-center gap-3 text-sm text-stone-300">
              <Switch label={t("admin.harness.narrateNew")} on={useAsDefault} onChange={setDefaultOverride} />
              <span>
                {t("admin.harness.narrateNew")}
                <span className="block text-xs text-stone-500">
                  {t("admin.harness.narrateNewHint")}
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className={ui.btnPrimary} onClick={save} disabled={saving || !dirty} aria-busy={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null} {t("admin.harness.save")}
        </button>
        {saved ? (
          <span role="status" className="inline-flex items-center gap-1 text-sm text-emerald-400">
            <Check className="tick-in size-4" /> {t("admin.harness.savedToast")}
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="motion-shake text-sm text-red-400">
            {error}
          </span>
        ) : null}
      </div>

      {chosen && data.config.id === chosen.id ? (
        <HarnessTestPanel
          saved={savedChoice}
          paints={chosen.nativeImages !== "no"}
          picturesVerified={Boolean(data.config.imagesVerifiedAt)}
          picturesForTables={data.config.images === "native" && imagesBackend === "harness"}
          onVerified={() => void load(true)}
          onAdopted={() => void adopted()}
        />
      ) : null}

      {usage ? (
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>{t("admin.harness.planUsed", { window: usage.window ? ` (${usage.window.replace(/_/g, " ")})` : "" })}</span>
            <span key={Math.round(usage.utilization * 100)} className="count-pop">
              {Math.round(usage.utilization * 100)}%
            </span>
          </div>
          <div className="hx-meter" data-high={usage.utilization >= 0.85}>
            <span className="bar-ease" style={{ width: `${Math.min(100, Math.round(usage.utilization * 100))}%` }} />
          </div>
        </div>
      ) : null}
      {data.activeSessions > 0 ? (
        <p className="mt-2 text-xs text-stone-500">
          <span className="breathe">{t("admin.harness.narrating", { count: data.activeSessions })}</span>
        </p>
      ) : null}
    </PageSection>
  );
}
