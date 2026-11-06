"use client";

import { AlignLeft, Bot, Image as ImageIcon, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { artStyleLabel, artStyleNote } from "@/lib/art-direction";
import { cn } from "@/lib/cn";
import { ImagesNote } from "@/app/campaigns/[campaignId]/NarrationNote";
import { commitValue, draftsFrom, editDraft, followSaved, inStep } from "@/app/campaigns/[campaignId]/settingDrafts";
import { ModelNote } from "@/components/ModelNote";
import { Select } from "@/components/ui/Select";
import type { MaskedStorySettings } from "@/lib/db/settings";
import type { HarnessOffer } from "@/lib/harness/policy";
import { endpointKind } from "@/lib/dm/sampling-logic";
import { shellHost } from "@/lib/shell-host";
import type { TextProvider } from "@/lib/text-models";
import { useT } from "@/lib/locale";

// The translator's shape, for the label helpers below: `t` comes in first
// (src/lib/story-window.ts).
type T = (key: string, vars?: Record<string, string | number>) => string;
import {
  ART_STYLE_TEXT_MAX,
  ART_STYLES,
  PROSE_SIZE_VALUES,
  type ArtStyle,
  type ImageBackend,
  type StorySettings,
} from "@/lib/types";

// A secret field never receives its stored value; SECRET_KEPT means "leave it
// as is" and the field is simply omitted from the PATCH. Same contract as the
// admin settings panel.
const SECRET_KEPT = "\u0000keep";

// The text settings typed in place.
type TextField = "customBaseUrl" | "customModel" | "utilityBaseUrl" | "utilityModel" | "artStyleMap" | "artStyleScene";

// In the order the pickers offer them: llama.cpp (or another
// OpenAI-compatible server) is the one ODM sets up and recommends. The
// words are keys read through t(); ComfyUI, OpenAI and Ollama keep their
// names.
const PROVIDER_LABEL_KEYS: Record<TextProvider, "ai.provider.custom" | "ai.provider.local" | "ai.provider.none" | "ai.provider.harness"> = {
  custom: "ai.provider.custom",
  local: "ai.provider.local",
  none: "ai.provider.none",
  harness: "ai.provider.harness",
};

function providerLabel(t: T, provider: TextProvider): string {
  return provider === "harness" ? t("ai.provider.harness") : t(PROVIDER_LABEL_KEYS[provider]);
}

function backendLabel(t: T, backend: ImageBackend): string {
  switch (backend) {
    case "comfyui": return "ComfyUI";
    case "openai": return t("ai.backend.openaiCompat");
    case "mflux-hs": return t("ai.backend.mflux");
    case "sdnq-hs": return t("ai.backend.sdnq");
    case "harness": return t("ai.provider.harness");
  }
}

// Per-campaign AI settings for the Settings tab. The values render from the
// campaign snapshot (kept live by campaign_updated over SSE); only the
// key-existence booleans come from the story-settings GET, because the
// snapshot is scrubbed of keys for everyone.
export function StoryAiPanel({
  campaignId,
  settings,
  steersStory,
}: {
  campaignId: string;
  settings: StorySettings;
  steersStory: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const t = useT();
  // Every control renders the server's settings, so a refused PATCH changes
  // nothing on screen; without this line it changes nothing silently.
  const [error, setError] = useState("");
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [hasUtilityKey, setHasUtilityKey] = useState(false);
  // Defaults to true so the warning never flashes while the answer is in
  // flight on servers that are fine.
  const [imagesConfigured, setImagesConfigured] = useState(true);
  // This campaign's own backend, which for a table on its own OpenAI key is
  // ready even when the server has no image backend of its own.
  const [imagesReady, setImagesReady] = useState(true);
  // Its backend is there but has no model picked, so it paints nothing
  // (src/lib/db/settings.ts); the server's own ComfyUI said the same.
  const [imagesNeedModel, setImagesNeedModel] = useState(false);
  // The model a blank campaign model falls back to: the server's storyteller.
  const [serverModel, setServerModel] = useState("");
  const [serverImagesNeedModel, setServerImagesNeedModel] = useState(false);
  // A world an app hosts: the backend is chosen once for the device and every
  // campaign follows it, so this panel shows it instead of editing it. null
  // until the answer lands, so the editable rows never flash on a device.
  const [deviceManaged, setDeviceManaged] = useState<boolean | null>(null);
  // Only an admin points the server at an address or holds its keys, so for
  // anyone else the URL and key fields are left out and the campaign runs on
  // the server's own backends (src/lib/db/settings.ts).
  const [serverManaged, setServerManaged] = useState(false);
  // Whether the server's agent program may narrate (and paint for) this
  // campaign; the admin decides (src/lib/harness/policy.ts). Hidden until
  // the answer lands, so the choice never flashes on and off.
  const [harness, setHarness] = useState<HarnessOffer | null>(null);
  // Text fields commit on blur or Enter, so a half-typed URL never PATCHes.
  // Each follows the saved settings until the player types into it
  // (settingDrafts.ts): a change saved in another window shows here, and a
  // field that still showed the old value is not saved back over it.
  const savedText: Record<TextField, string> = {
    customBaseUrl: settings.customBaseUrl,
    customModel: settings.customModel,
    utilityBaseUrl: settings.utilityBaseUrl,
    utilityModel: settings.utilityModel,
    artStyleMap: settings.artStyleMap,
    artStyleScene: settings.artStyleScene,
  };
  const [text, setText] = useState(() => draftsFrom(savedText));
  if (!inStep(text, savedText)) {
    setText(followSaved(text, savedText));
  }
  const setDraft = (field: TextField, value: string) => setText((prev) => editDraft(prev, field, value));
  const [keys, setKeys] = useState({ customApiKey: SECRET_KEPT, utilityApiKey: SECRET_KEPT });
  const drafts = { ...text.drafts, ...keys };

  useEffect(() => {
    if (!steersStory) {
      return;
    }
    let cancelled = false;
    void fetch(`/api/campaigns/${campaignId}/story-settings`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { settings?: MaskedStorySettings; harness?: HarnessOffer } | null) => {
        if (!cancelled && data?.settings) {
          setHasCustomKey(data.settings.hasCustomApiKey);
          setHasUtilityKey(data.settings.hasUtilityApiKey);
          setImagesReady(data.settings.imagesReady);
          setImagesNeedModel(data.settings.imagesNeedModel === true);
          setServerManaged(data.settings.serverManaged === true);
        }
        if (!cancelled && data?.harness) {
          setHarness(data.harness);
        }
        if (!cancelled) {
          // A server older than this field, or a failed read, edits as before.
          setDeviceManaged(data?.settings?.deviceManaged === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeviceManaged(false);
        }
      });
    void fetch("/api/capabilities")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { images?: { configured?: boolean; needsModel?: boolean }; story?: { model?: string } } | null) => {
        if (!cancelled && data?.images) {
          setImagesConfigured(data.images.configured !== false);
          setServerImagesNeedModel(data.images.needsModel === true);
        }
        if (!cancelled && data?.story?.model) {
          setServerModel(data.story.model);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [steersStory, campaignId]);

  async function patch(update: Partial<StorySettings>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/story-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        settings?: MaskedStorySettings;
        harness?: HarnessOffer;
      };
      if (!response.ok) {
        setError(data.error ?? t("load.write.changeUnsaved"));
        return;
      }
      if (data.settings) {
        setHasCustomKey(data.settings.hasCustomApiKey);
        setHasUtilityKey(data.settings.hasUtilityApiKey);
        setImagesReady(data.settings.imagesReady);
        setImagesNeedModel(data.settings.imagesNeedModel === true);
      }
      if (data.harness) {
        setHarness(data.harness);
      }
      if (update.customApiKey !== undefined) {
        setKeys((prev) => ({ ...prev, customApiKey: SECRET_KEPT }));
      }
      if (update.utilityApiKey !== undefined) {
        setKeys((prev) => ({ ...prev, utilityApiKey: SECRET_KEPT }));
      }
    } catch {
      setError(t("creator.error.unreachable"));
    } finally {
      setBusy(false);
    }
  }

  function commitText(field: TextField) {
    const value = commitValue(text, savedText, field);
    if (value !== null) {
      void patch({ [field]: value });
    }
  }

  function commitKey(field: "customApiKey" | "utilityApiKey") {
    const value = drafts[field];
    if (value !== SECRET_KEPT) {
      void patch({ [field]: value.trim() });
    }
  }

  const harnessName = harness?.label
    ? `${t("ai.harnessNamed", { label: harness.label })}${harness.model ? t("ai.modelSuffix", { model: harness.model }) : ""}`
    : t("ai.provider.harness");
  // A blank model is the server's, said with its name and where it comes
  // from rather than left for the reader to infer.
  const inheritedModel = serverModel ? t("ai.serverModelNamed", { model: serverModel }) : t("ai.serverModel");
  const storytellerSummary =
    settings.textProvider === "custom"
      ? settings.customModel || inheritedModel
      : settings.textProvider === "harness"
        ? harnessName
        : providerLabel(t, settings.textProvider);
  const imagesSummary = settings.imageGenerationEnabled
    ? `${backendLabel(t, settings.imageBackend)}${settings.autoImages ? t("ai.imagesAuto") : ""}${
        settings.artStyle === "setting" ? "" : t("ai.imagesStyle", { style: artStyleLabel(t, settings.artStyle).toLowerCase() })
      }`
    : t("ai.off");

  if (!steersStory) {
    return (
      <section className="rounded-lg border border-stone-800 bg-stone-950/60 p-4">
        <h2 className="mb-1 text-sm font-medium text-stone-300">{t("ai.title")}</h2>
        <p className="mb-2 text-xs text-stone-500">{t("ai.readerLine")}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-stone-400">
          <span className="flex items-center gap-1.5">
            <Bot className="size-3.5 text-amber-200" />
            {t("ai.storytellerLine", { summary: storytellerSummary })}
          </span>
          <span className="flex items-center gap-1.5">
            <Wrench className="size-3.5 text-amber-200" />
            {t("ai.utilityLine", { model: settings.utilityModel || t("ai.off") })}
          </span>
          <span className="flex items-center gap-1.5">
            <ImageIcon className="size-3.5 text-amber-200" />
            {t("ai.imagesLine", { summary: imagesSummary })}
          </span>
          <span className="flex items-center gap-1.5">
            <AlignLeft className="size-3.5 text-amber-200" />
            {t("ai.passageLengthLine", { size: settings.proseSize })}
          </span>
        </div>
      </section>
    );
  }

  const shell = shellHost();
  const backendName = { openai: "OpenAI", openrouter: "OpenRouter", local: t("ai.backendKind.local") }[
    endpointKind(settings.customBaseUrl)
  ];
  const deviceStoryteller =
    settings.textProvider === "custom"
      ? `${settings.customModel || t("ai.customBackend")} (${backendName})`
      : settings.textProvider === "harness"
        ? harnessName
        : providerLabel(t, settings.textProvider);
  // The agent is offered only where the admin allows it, but a campaign that
  // already chose it keeps seeing its own choice.
  const providerChoices = (Object.keys(PROVIDER_LABEL_KEYS) as TextProvider[]).filter(
    (provider) => provider !== "harness" || harness?.offered || settings.textProvider === "harness",
  );

  const selectClass =
    "rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-xs outline-none focus:border-amber-600";
  const inputClass = cn(selectClass, "w-64 max-w-full");
  const labelClass = "w-20 shrink-0 text-stone-500";
  const blurOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  return (
    <section className="rounded-lg border border-stone-800 bg-stone-950/60 p-4">
      <h2 className="mb-1 text-sm font-medium text-stone-300">{t("ai.title")}</h2>
      <p className="mb-3 text-xs text-stone-500">
        {t("ai.intro")}
        {deviceManaged ? t("ai.introDevice") : t("ai.introServer")}
      </p>
      {error ? <p className="motion-shake mb-2 text-xs text-red-400">{error}</p> : null}
      <div className={cn("space-y-3 text-xs", busy && "opacity-70")}>
        {deviceManaged === null ? null : deviceManaged ? (
          <div className="reveal space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={labelClass}>{t("ai.storyteller")}</span>
              <span className="text-stone-300">{deviceStoryteller}</span>
            </div>
            {settings.textProvider !== "none" && settings.utilityModel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className={labelClass}>{t("ai.utility")}</span>
                <span className="text-stone-300">{settings.utilityModel}</span>
              </div>
            ) : null}
            <p className="text-stone-500">
              {t("ai.deviceOnce")}
              {shell ? t("ai.changeShell") : t("ai.changeHost")}
            </p>
            {shell ? (
              <button
                type="button"
                onClick={() => shell.showServers()}
                className="motion-press rounded-md border border-stone-700 px-2 py-1 text-stone-300 hover:border-amber-700 hover:text-amber-200"
              >
                {t("menu.appHome")}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="reveal space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={labelClass}>{t("ai.storyteller")}</span>
              <Select
                value={settings.textProvider}
                onChange={(textProvider) => patch({ textProvider })}
                options={providerChoices.map((provider) => ({
                  value: provider,
                  label: provider === "harness" ? harnessName : providerLabel(t, provider),
                }))}
                label={t("ai.storyteller")}
                size="sm"
              />
            </div>
            {settings.textProvider === "harness" ? (
              <p className="reveal text-stone-500">
                {t("ai.harnessNote")}
              </p>
            ) : null}
            {settings.textProvider === "custom" && serverManaged ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.model")}</span>
                  <input
                    aria-label={t("ai.model")}
                    value={drafts.customModel}
                    onChange={(event) =>
                      setDraft("customModel", event.target.value)
                    }
                    onBlur={() => commitText("customModel")}
                    onKeyDown={blurOnEnter}
                    className={inputClass}
                  />
                </div>
                <ModelNote role="story" baseUrl="" model={settings.customModel} />
                <p className="text-stone-500">
                  {settings.customModel
                    ? t("ai.serverBackendNote")
                    : t("ai.inUse", { model: inheritedModel })}{" "}
                  {t("ai.adminOnlyNote")}
                </p>
              </>
            ) : settings.textProvider === "custom" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.baseUrl")}</span>
                  <input
                    aria-label={t("ai.baseUrl")}
                    value={drafts.customBaseUrl}
                    onChange={(event) =>
                      setDraft("customBaseUrl", event.target.value)
                    }
                    onBlur={() => commitText("customBaseUrl")}
                    onKeyDown={blurOnEnter}
                    placeholder="http://127.0.0.1:8080/v1"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.model")}</span>
                  <input
                    aria-label={t("ai.model")}
                    value={drafts.customModel}
                    onChange={(event) =>
                      setDraft("customModel", event.target.value)
                    }
                    onBlur={() => commitText("customModel")}
                    onKeyDown={blurOnEnter}
                    className={inputClass}
                  />
                </div>
                <ModelNote role="story" baseUrl={settings.customBaseUrl} model={settings.customModel} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.apiKey")}</span>
                  <input
                    type="password"
                    aria-label={t("ai.apiKey")}
                    value={drafts.customApiKey === SECRET_KEPT ? "" : drafts.customApiKey}
                    onChange={(event) =>
                      setKeys((prev) => ({ ...prev, customApiKey: event.target.value }))
                    }
                    onBlur={() => commitKey("customApiKey")}
                    onKeyDown={blurOnEnter}
                    placeholder={hasCustomKey ? t("ai.keySet") : t("ai.keyNotSet")}
                    className={inputClass}
                  />
                  {hasCustomKey ? (
                    <button
                      type="button"
                      onClick={() => patch({ customApiKey: "" })}
                      className="rounded-md border border-stone-700 px-2 py-1 text-stone-400 hover:text-red-400"
                    >
                      {t("action.clear")}
                    </button>
                  ) : null}
                </div>
                <p className="text-stone-500">{t("ai.blankFallback")}</p>
              </>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-stone-800/60 pt-3">
              <span className={labelClass}>{t("ai.utility")}</span>
              <Select
                value={settings.utilityProvider}
                onChange={(utilityProvider) => patch({ utilityProvider })}
                options={(["custom", "local"] as TextProvider[]).map((provider) => ({ value: provider, label: providerLabel(t, provider) }))}
                label={t("ai.utilityProvider")}
                size="sm"
              />
              <input
                aria-label={t("ai.utilityModel")}
                value={drafts.utilityModel}
                onChange={(event) =>
                  setDraft("utilityModel", event.target.value)
                }
                onBlur={() => commitText("utilityModel")}
                onKeyDown={blurOnEnter}
                placeholder={t("ai.utilityPlaceholder")}
                className={inputClass}
              />
            </div>
            {settings.utilityModel ? (
              <ModelNote role="utility" baseUrl={settings.utilityProvider === "custom" ? settings.utilityBaseUrl || settings.customBaseUrl : ""} model={settings.utilityModel} />
            ) : null}
            {settings.utilityProvider === "custom" && settings.utilityModel && !serverManaged ? (
              <div className="reveal flex flex-wrap items-center gap-2">
                <span className={labelClass}>{t("ai.utilityUrl")}</span>
                <input
                  aria-label={t("ai.utilityUrl")}
                  value={drafts.utilityBaseUrl}
                  onChange={(event) =>
                    setDraft("utilityBaseUrl", event.target.value)
                  }
                  onBlur={() => commitText("utilityBaseUrl")}
                  onKeyDown={blurOnEnter}
                  placeholder={t("ai.utilityUrlPlaceholder")}
                  className={inputClass}
                />
                <input
                  type="password"
                  aria-label={t("ai.apiKey")}
                  value={drafts.utilityApiKey === SECRET_KEPT ? "" : drafts.utilityApiKey}
                  onChange={(event) =>
                    setKeys((prev) => ({ ...prev, utilityApiKey: event.target.value }))
                  }
                  onBlur={() => commitKey("utilityApiKey")}
                  onKeyDown={blurOnEnter}
                  placeholder={hasUtilityKey ? t("ai.keySet") : t("ai.keyOptional")}
                  className={cn(selectClass, "w-40")}
                />
                {hasUtilityKey ? (
                  <button
                    type="button"
                    onClick={() => patch({ utilityApiKey: "" })}
                    className="rounded-md border border-stone-700 px-2 py-1 text-stone-400 hover:text-red-400"
                  >
                    {t("action.clear")}
                  </button>
                ) : null}
              </div>
            ) : null}

          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-800/60 pt-3">
          <span className={labelClass}>{t("ai.images")}</span>
          <Select<ImageBackend | "off">
            value={settings.imageGenerationEnabled ? settings.imageBackend : "off"}
            label={t("ai.images")}
            size="sm"
            options={[
              { value: "off", label: t("ai.imagesOff") },
              // On a device the backend follows the device; only on and off
              // are this campaign's to choose.
              ...(deviceManaged
                ? [settings.imageBackend]
                : (["comfyui", "openai", "mflux-hs", "sdnq-hs", "harness"] as ImageBackend[]).filter(
                    (backend) => backend !== "harness" || harness?.pictures || settings.imageBackend === "harness",
                  )
              ).map((backend) => ({ value: backend, label: backendLabel(t, backend) })),
            ]}
            onChange={(value) => {
              // "Off" is imageGenerationEnabled, not a backend: picking a
              // backend again switches images back on in the same PATCH.
              void patch(
                value === "off"
                  ? { imageGenerationEnabled: false }
                  : { imageBackend: value, imageGenerationEnabled: true },
              );
            }}
          />
          {settings.imageGenerationEnabled ? (
            <>
              <Select<StorySettings["aspect"]>
                value={settings.aspect}
                onChange={(aspect) => patch({ aspect })}
                options={[
                  { value: "square", label: t("ai.aspect.square") },
                  { value: "portrait", label: t("ai.aspect.portrait") },
                  { value: "landscape", label: t("ai.aspect.landscape") },
                ]}
                label={t("ai.pictureShape")}
                size="sm"
              />
              <Select<StorySettings["imageMode"]>
                value={settings.imageMode}
                onChange={(imageMode) => patch({ imageMode })}
                options={[
                  { value: "fast", label: t("ai.speed.fast") },
                  { value: "slow", label: t("ai.speed.slow") },
                ]}
                label={t("ai.pictureSpeed")}
                size="sm"
              />
              <button
                type="button"
                onClick={() => patch({ autoImages: !settings.autoImages })}
                className={cn(
                  "rounded-md border px-2 py-1",
                  settings.autoImages
                    ? "border-amber-700 bg-amber-950/50 text-amber-200"
                    : "border-stone-700 text-stone-400",
                )}
              >
                {t("ai.autoScenes")}
              </button>
            </>
          ) : null}
        </div>
        {settings.imageGenerationEnabled &&
        imagesNeedModel &&
        (settings.imageBackend === "openai" || (settings.imageBackend === "comfyui" && serverImagesNeedModel)) ? (
          <p className="reveal text-amber-400/90">
            {deviceManaged && settings.imageBackend === "openai"
              ? t("ai.noModelDevice")
              : serverManaged
                ? t("ai.noModelServer")
                : t("ai.noModel")}
          </p>
        ) : settings.imageGenerationEnabled && settings.imageBackend === "openai" && !imagesReady ? (
          <p className="reveal text-amber-400/90">
            {deviceManaged
              ? t("ai.noKeyDevice")
              : serverManaged
                ? t("ai.noKeyServer")
                : t("ai.noKey")}
          </p>
        ) : settings.imageGenerationEnabled && !imagesConfigured && imagesReady ? (
          <p className="reveal text-amber-400/90">
            {t("ai.notConfigured")}
          </p>
        ) : settings.imageGenerationEnabled && !deviceManaged ? (
          <ImagesNote backend={settings.imageBackend} />
        ) : null}
        {settings.imageGenerationEnabled ? (
          <div className="reveal space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={labelClass}>{t("ai.artStyle")}</span>
              <Select<ArtStyle>
                value={settings.artStyle}
                onChange={(artStyle) => patch({ artStyle })}
                options={ART_STYLES.map((style) => ({ value: style, label: artStyleLabel(t, style) }))}
                label={t("ai.artStyle")}
                size="sm"
              />
              <span key={settings.artStyle} className="reveal text-stone-500">
                {artStyleNote(t, settings.artStyle)}
              </span>
            </div>
            {settings.artStyle === "custom" ? (
              <div className="reveal space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.maps")}</span>
                  <input
                    value={drafts.artStyleMap}
                    onChange={(event) => setDraft("artStyleMap", event.target.value)}
                    onBlur={() => commitText("artStyleMap")}
                    onKeyDown={blurOnEnter}
                    maxLength={ART_STYLE_TEXT_MAX}
                    placeholder="Realistic terrain from above, clear paths"
                    aria-label={t("ai.mapStyleAria")}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={labelClass}>{t("ai.scenes")}</span>
                  <input
                    value={drafts.artStyleScene}
                    onChange={(event) => setDraft("artStyleScene", event.target.value)}
                    onBlur={() => commitText("artStyleScene")}
                    onKeyDown={blurOnEnter}
                    maxLength={ART_STYLE_TEXT_MAX}
                    placeholder="Photorealistic, cinematic light"
                    aria-label={t("ai.sceneStyleAria")}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-800/60 pt-3">
          <span className={labelClass}>{t("ai.passages")}</span>
          <Select<StorySettings["proseSize"]>
            value={settings.proseSize}
            onChange={(proseSize) => patch({ proseSize })}
            options={PROSE_SIZE_VALUES.map((size) => ({ value: size, label: t(`art.prose.${size}`) }))}
            label={t("ai.passages")}
            size="sm"
          />
          <span className="text-stone-500">{t("ai.passagesHelp")}</span>
        </div>
      </div>
    </section>
  );
}
