"use client";

import { ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { DEFAULT_WINDOW, STORY_WINDOW_NEEDS, windowLabel } from "@/lib/story-window";
import { BackendProbe } from "@/app/admin/BackendProbe";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AgentPanel } from "@/app/setup/AgentPanel";
import { StartHints } from "@/app/setup/StartHints";
import { NO_LIST, type Draft, type ModelList } from "@/app/setup/draft";
import { ChoiceCard, ChoiceCards, FoundRow, ModelPicker, ScanMark, host, type ScanResult } from "@/app/setup/SetupParts";
import { useT } from "@/lib/locale";
import {
  KEY_PROVIDERS,
  keyForListing,
  keyProvider,
  normalizeBaseUrl,
  providerForKey,
  type KeyProviderId,
  type ListedModel,
} from "@/lib/setup/discovery-logic";

type Update = (change: (draft: Draft) => Draft) => void;

type Listing =
  | { ok: true; baseUrl: string; models: ListedModel[]; recommended: string }
  | { ok: false; baseUrl: string; error: string; needsKey?: boolean };

async function askForModels(body: Record<string, string>): Promise<Listing> {
  try {
    const response = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "models", ...body }),
    });
    const data = await response.json().catch(() => null);
    return data ?? { ok: false, baseUrl: "", error: "The server did not answer." };
  } catch {
    return { ok: false, baseUrl: "", error: "Could not reach this server." };
  }
}

function listFrom(result: Listing): ModelList {
  return result.ok
    ? { state: "ok", models: result.models, recommended: result.recommended, error: "", needsKey: false }
    : { state: "failed", models: [], recommended: "", error: result.error, needsKey: Boolean(result.needsKey) };
}

export function StorytellerStep({
  draft,
  update,
  scan,
  scanning,
  onRescan,
  savedKeyFor,
  savedKeyBase,
  inContainer,
}: {
  draft: Draft;
  update: Update;
  scan: ScanResult | null;
  scanning: boolean;
  onRescan: () => void;
  // Which hosted provider the saved key belongs to, if any; a blank key
  // field keeps it.
  savedKeyFor: KeyProviderId | null;
  // The address a saved key belongs to, when a key is saved at all.
  savedKeyBase: string;
  inContainer: boolean;
}) {
  const t = useT();
  const found = scan?.text ?? [];
  const pick = (story: Draft["story"]) => update((current) => ({ ...current, story }));
  return (
    <div className="space-y-4">
      <ChoiceCards label={t("setup.story.cardsLabel")}>
        <ChoiceCard
          picked={draft.story === "local"}
          onPick={() => pick("local")}
          glyph="ui-ai"
          title={t("setup.story.card.local")}
          sub={t("setup.story.card.localSub")}
          badge={scanning ? { text: t("setup.story.looking"), tone: "off" } : found.length ? { text: t("setup.story.found", { count: found.length }), tone: "ready" } : null}
        />
        <ChoiceCard
          picked={draft.story === "key"}
          onPick={() => pick("key")}
          glyph="tab-admin"
          title={t("setup.story.card.key")}
          sub={t("setup.story.card.keySub")}
        />
        <ChoiceCard
          picked={draft.story === "agent"}
          onPick={() => pick("agent")}
          glyph="system-share"
          title={t("setup.story.card.agent")}
          sub={t("setup.story.card.agentSub")}
        />
        <ChoiceCard
          picked={draft.story === "none"}
          onPick={() => pick("none")}
          glyph="tab-characters"
          title={t("setup.story.card.person")}
          sub={t("setup.story.card.personSub")}
        />
      </ChoiceCards>

      {draft.story === "local" ? (
        <div key="local" className="reveal-height">
          <LocalPanel
            draft={draft}
            update={update}
            found={found}
            scanning={scanning}
            onRescan={onRescan}
            savedKeyBase={savedKeyBase}
            inContainer={inContainer}
            machine={scan?.machine ?? null}
          />
        </div>
      ) : draft.story === "key" ? (
        <div key="key" className="reveal-height">
          <KeyPanel draft={draft} update={update} savedKeyFor={savedKeyFor} />
        </div>
      ) : draft.story === "agent" ? (
        <div key="agent" className="reveal-height">
          <AgentPanel draft={draft} update={update} />
        </div>
      ) : draft.story === "none" ? (
        <p key="none" className="reveal su-note">
          {t("setup.story.noneNote")}
        </p>
      ) : null}
    </div>
  );
}

function LocalPanel({
  draft,
  update,
  found,
  scanning,
  onRescan,
  savedKeyBase,
  inContainer,
  machine,
}: {
  draft: Draft;
  update: Update;
  found: ScanResult["text"];
  scanning: boolean;
  onRescan: () => void;
  savedKeyBase: string;
  inContainer: boolean;
  machine: ScanResult["machine"] | null;
}) {
  const t = useT();
  const local = draft.local;
  const [looking, setLooking] = useState(false);
  const setLocal = (patch: Partial<Draft["local"]>) => update((current) => ({ ...current, local: { ...current.local, ...patch } }));
  const chosenFound = !local.typed ? found.find((entry) => entry.baseUrl === normalizeBaseUrl(local.baseUrl)) : undefined;
  // The key saved on this server belongs to this very server: a blank key
  // field keeps it, and the server lists the models with it.
  const keySavedHere = Boolean(savedKeyBase) && keyForListing({ typed: "", savedKey: "saved", savedBaseUrl: savedKeyBase, baseUrl: local.baseUrl }) === "saved";

  async function look() {
    setLooking(true);
    setLocal({ list: { ...NO_LIST, state: "busy" } });
    const result = await askForModels({ baseUrl: local.baseUrl, apiKey: local.apiKey });
    setLooking(false);
    const list = listFrom(result);
    update((current) => ({
      ...current,
      local: {
        ...current.local,
        baseUrl: result.baseUrl || current.local.baseUrl,
        list,
        model: list.models.some((model) => model.id === current.local.model) ? current.local.model : list.recommended || current.local.model,
      },
    }));
  }

  // Running the wizard again: the scan saw the server want its key, and
  // that key is already saved, so the models are listed with it unasked.
  const listedSaved = useRef("");
  useEffect(() => {
    if (local.list.needsKey && keySavedHere && !local.apiKey && listedSaved.current !== local.baseUrl) {
      listedSaved.current = local.baseUrl;
      void look();
    }
    // Only when the chosen server is one the saved key belongs to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.list.needsKey, keySavedHere, local.baseUrl]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-stone-400">
          <ScanMark scanning={scanning} found={found.length > 0} />
          {scanning
            ? t("setup.local.scanning")
            : found.length
              ? t("setup.local.found")
              : t("setup.local.none")}
        </span>
        <button type="button" className={ui.btnSmall} onClick={onRescan} disabled={scanning} aria-busy={scanning}>
          <RefreshCw className={cn("size-3.5", scanning && "animate-spin")} /> {t("setup.local.lookAgain")}
        </button>
      </div>

      <div role="radiogroup" aria-label={t("setup.local.groupAria")} className="stagger space-y-2">
        {found.map((entry) => (
          <FoundRow
            key={entry.baseUrl}
            picked={Boolean(chosenFound && chosenFound.baseUrl === entry.baseUrl)}
            onPick={() =>
              setLocal({
                baseUrl: entry.baseUrl,
                typed: false,
                model: entry.recommended,
                list: entry.needsKey
                  ? { ...NO_LIST, state: "failed", needsKey: true, error: t("setup.local.wantsKey", { host: host(entry.baseUrl) }) }
                  : { state: "ok", models: entry.models, recommended: entry.recommended, error: "", needsKey: false },
              })
            }
            title={`${entry.label} · ${host(entry.baseUrl)}`}
            detail={entry.needsKey
              ? t("setup.local.wantsKeyRow")
              : `${t("setup.local.modelCount", { count: entry.models.length })}${entry.recommended ? `, ${entry.recommended}` : ""}`}
            tone={entry.needsKey ? "warn" : "ok"}
          />
        ))}
        <FoundRow
          picked={local.typed}
          onPick={() => setLocal({ typed: true, list: NO_LIST })}
          title={t("setup.local.somewhereElse")}
          detail={t("setup.local.somewhereElseDetail")}
          tone="off"
        />
      </div>

      {!scanning && !found.length ? <StartHints inContainer={inContainer} machine={machine} /> : null}

      {local.typed ? (
        <div key="typed" className="reveal flex flex-wrap items-end gap-2">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-400">{t("setup.local.address")}</span>
            <input
              className={ui.input}
              value={local.baseUrl}
              onChange={(event) => setLocal({ baseUrl: event.target.value, list: NO_LIST })}
              placeholder="http://192.168.1.20:8080"
            />
          </label>
          <button type="button" className={ui.btnSecondary} onClick={look} disabled={looking || !local.baseUrl.trim()} aria-busy={looking}>
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {t("setup.local.look")}
          </button>
        </div>
      ) : null}

      {local.list.needsKey || local.apiKey ? (
        <div key="key" className="reveal flex flex-wrap items-end gap-2">
          <label className="block min-w-0 flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-400">{t("setup.local.keyLabel")}</span>
            <input
              type="password"
              className={ui.input}
              value={local.apiKey}
              onChange={(event) => setLocal({ apiKey: event.target.value })}
              placeholder={keySavedHere ? t("setup.key.savedPlaceholder") : t("setup.local.keyPlaceholder")}
              autoComplete="off"
            />
          </label>
          <button type="button" className={ui.btnSecondary} onClick={look} disabled={looking || (!local.apiKey.trim() && !keySavedHere)} aria-busy={looking}>
            {looking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {t("setup.local.lookAgain")}
          </button>
        </div>
      ) : null}

      {local.list.state === "failed" && local.list.error ? (
        <p key={local.list.error} role="alert" className="motion-shake text-sm text-red-400">
          {local.list.error}
        </p>
      ) : null}

      {local.list.models.length ? (
        <ModelPicker
          label={t("setup.local.model")}
          models={local.list.models}
          value={local.model}
          recommended={local.list.recommended}
          onChange={(model) => setLocal({ model })}
        />
      ) : local.typed || local.baseUrl ? (
        <label className="reveal block">
          <span className="mb-1 block text-xs font-medium text-stone-400">{t("setup.local.modelName")}</span>
          <input className={ui.input} value={local.model} onChange={(event) => setLocal({ model: event.target.value })} placeholder={t("setup.local.modelPlaceholder")} />
          <span className="mt-1 block text-[11px] text-stone-500">{t("setup.local.modelNameHint")}</span>
        </label>
      ) : null}

      {local.baseUrl && local.model ? (
        <BackendProbe
          which="story"
          baseUrl={normalizeBaseUrl(local.baseUrl)}
          model={local.model}
          apiKey={local.apiKey}
          provider={chosenFound?.ollamaNative ? "local" : "custom"}
        />
      ) : null}
      <p className="text-[11px] leading-4 text-stone-500">
        {STORY_WINDOW_NEEDS}{" "}
        {chosenFound?.ollamaNative
          ? t("setup.local.window.ollamaNative", { window: windowLabel(DEFAULT_WINDOW) })
          : chosenFound?.kind === "ollama"
            ? t("setup.local.window.ollama", { window: DEFAULT_WINDOW })
            : t("setup.local.window.server")}
      </p>
    </div>
  );
}

function KeyPanel({ draft, update, savedKeyFor }: { draft: Draft; update: Update; savedKeyFor: KeyProviderId | null }) {
  const t = useT();
  const key = draft.key;
  const provider = keyProvider(key.provider);
  const [checking, setChecking] = useState(false);
  const [switched, setSwitched] = useState("");
  const keptKey = savedKeyFor === key.provider && !key.apiKey.trim();
  const setKey = (patch: Partial<Draft["key"]>) => update((current) => ({ ...current, key: { ...current.key, ...patch } }));

  async function check(next: Draft["key"] = key) {
    setChecking(true);
    setKey({ list: { ...NO_LIST, state: "busy" } });
    const result = await askForModels({
      provider: next.provider,
      baseUrl: next.provider === "other" ? next.baseUrl : "",
      apiKey: next.apiKey,
    });
    setChecking(false);
    const list = listFrom(result);
    update((current) => ({
      ...current,
      key: {
        ...current.key,
        list,
        model: list.models.some((model) => model.id === current.key.model) ? current.key.model : list.recommended,
      },
    }));
  }

  // A saved key lists its models on arrival, so running the wizard again
  // needs no pasting.
  const listedSaved = useRef(false);
  useEffect(() => {
    if (keptKey && key.list.state === "idle" && !listedSaved.current) {
      listedSaved.current = true;
      void check();
    }
    // Only on arrival with a saved key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keptKey]);

  function typeKey(value: string) {
    const guess = providerForKey(value);
    if (guess && guess !== key.provider && key.provider !== "other") {
      setSwitched(t("setup.key.switched", { provider: keyProvider(guess).label }));
      setKey({ apiKey: value, provider: guess, list: NO_LIST, model: "" });
      return;
    }
    setKey({ apiKey: value, list: NO_LIST });
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <SegmentedControl
          options={KEY_PROVIDERS.map((entry) => ({ value: entry.id, label: entry.label }))}
          value={key.provider}
          onChange={(next) => {
            setSwitched("");
            setKey({ provider: next, list: NO_LIST, model: "" });
          }}
          label={t("setup.key.providerLabel")}
          className="w-max"
        />
      </div>
      {switched ? (
        <p key={switched} role="status" className="reveal text-xs text-amber-200">
          {switched}
        </p>
      ) : null}
      {key.provider === "other" ? (
        <label key="base" className="reveal block">
          <span className="mb-1 block text-xs font-medium text-stone-400">{t("setup.key.baseUrl")}</span>
          <input
            className={ui.input}
            value={key.baseUrl}
            onChange={(event) => setKey({ baseUrl: event.target.value, list: NO_LIST })}
            placeholder="https://api.example.com/v1"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-stone-400">
            {t("admin.text.apiKey")}
            {provider.keyUrl ? (
              <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-200 hover:text-amber-100">
                {t("setup.key.getKey", { provider: provider.label })} <ExternalLink className="size-3" />
              </a>
            ) : null}
          </span>
          <input
            type="password"
            className={ui.input}
            value={key.apiKey}
            onChange={(event) => typeKey(event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").trim();
              if (pasted) {
                event.preventDefault();
                typeKey(pasted);
              }
            }}
            placeholder={keptKey ? t("setup.key.savedPlaceholder") : provider.keyPlaceholder}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className={ui.btnSecondary}
          onClick={() => void check()}
          disabled={checking || (!key.apiKey.trim() && !keptKey) || (key.provider === "other" && !key.baseUrl.trim())}
          aria-busy={checking}
        >
          {checking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} {t("setup.key.check")}
        </button>
      </div>
      <p className="text-[11px] leading-4 text-stone-500">
        {t("setup.key.hint")}
      </p>
      {key.list.state === "failed" ? (
        <p key={key.list.error} role="alert" className="motion-shake text-sm text-red-400">
          {key.list.error}
        </p>
      ) : null}
      {key.list.models.length ? (
        <ModelPicker label={t("setup.local.model")} models={key.list.models} value={key.model} recommended={key.list.recommended} onChange={(model) => setKey({ model })} />
      ) : null}
      {provider.coversMedia ? (
        <p className="su-note">
          {t("setup.key.coversMedia")}
        </p>
      ) : null}
      {key.model && key.list.state === "ok" ? (
        <BackendProbe
          which="story"
          baseUrl={normalizeBaseUrl(provider.baseUrl || key.baseUrl)}
          model={key.model}
          apiKey={key.apiKey}
        />
      ) : null}
    </div>
  );
}
