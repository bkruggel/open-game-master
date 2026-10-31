"use client";

import { Check, Loader2, X, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { registerOutput, releaseOutput } from "@/lib/audio-devices";
import { ui } from "@/lib/ui";
import { PageSection } from "@/components/PageShell";
import { BuiltinSpeechCard } from "@/app/admin/BuiltinSpeechCard";
import { ModelChoiceField } from "@/app/admin/ModelChoice";
import { blanks, SPEECH_MODELS, fromEnv } from "@/app/admin/model-blanks";
import type { ModelChoices } from "@/lib/model-registry/registry";
import { whisperSwitchedOff } from "@/lib/stt-logic";
import {
  Field,
  SECRET_KEPT,
  SecretField,
  SelectField,
  type EnvDefaults,
  type MaskedConfig,
  inheritedHint,
} from "@/app/admin/AdminSettingsFields";
import { useT } from "@/lib/locale";

// Narration and speech-to-text. Named "Speech" so it is not confused with the
// Voice chat section, which is a different feature.
//
// Narration is set up the way the text model is (issue 89): pick the kind of
// server, then its address, model and key appear, and a test speaks a line
// through exactly what is typed. The paragraph under the picker says where a
// passage's text goes, because "Narration: on" in a campaign says nothing
// about that. Every model here is picked from what its server lists; a
// blank one sends nothing.

type Speech = MaskedConfig["speech"];
type Provider = Speech["ttsProvider"];


type TestResult = {
  ok: boolean;
  endpoint?: string;
  model?: string;
  voice?: string;
  voices?: number;
  audio?: string;
  error?: string;
};

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function AdminSpeechSection({
  speech,
  env,
  apiKey,
  openaiSpeechBaseUrl,
  onSpeech,
  onApiKey,
}: {
  speech: Speech;
  env: EnvDefaults;
  // SECRET_KEPT until a new key is typed.
  apiKey: string;
  // Where OpenAI dictation is sent: the picture backend's OpenAI address,
  // whose key it borrows (src/lib/openai-images.ts).
  openaiSpeechBaseUrl: string;
  onSpeech: (speech: Speech) => void;
  onApiKey: (value: string) => void;
}) {
  const t = useT();
  const BLANK = blanks(t);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  // The paid dictation fallback is drawn once opened, so its picker does not
  // ask OpenAI with the saved key for an admin who never uses it.
  const [openAiDictation, setOpenAiDictation] = useState(false);
  // What the narration server listed last, which says whether a blank model
  // runs its only one.
  const [narrationListing, setNarrationListing] = useState<ModelChoices | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // What "Auto" means on this server right now.
  const envProvider: Exclude<Provider, ""> =
    env.ttsProvider === "openai" || env.ttsProvider === "off" ? env.ttsProvider : "kokoro";
  const provider = speech.ttsProvider || envProvider;
  const set = (patch: Partial<Speech>) => {
    setResult(null);
    onSpeech({ ...speech, ...patch });
  };

  const kokoroAt = speech.kokoroUrl.trim() || env.kokoroUrl;
  const openaiAt = speech.ttsBaseUrl.trim() || env.ttsBaseUrl || "https://api.openai.com/v1";
  const official = host(openaiAt) === "api.openai.com";
  const whisperAt = speech.sttUrl.trim() || env.sttUrl;
  // No model is named in code: an OpenAI-kind server with none picked reads
  // nothing aloud, unless it is the host's own and lists exactly one.
  const soleNarrationModel =
    narrationListing?.reachable === true && narrationListing.models.filter((model) => model.listed).length === 1;
  const narrationNeedsModel =
    provider === "openai" &&
    !speech.ttsModel.trim() &&
    !env.ttsModel &&
    (official || (narrationListing?.reachable === true && !soleNarrationModel));

  async function test() {
    setTesting(true);
    setResult(null);
    audioRef.current?.pause();
    try {
      const response = await fetch("/api/admin/tts-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          kokoroUrl: speech.kokoroUrl,
          baseUrl: speech.ttsBaseUrl,
          model: speech.ttsModel,
          apiKey: apiKey === SECRET_KEPT ? "" : apiKey,
          voice: speech.ttsVoice,
        }),
      });
      const data = (await response.json().catch(() => null)) as TestResult | null;
      setResult(data ?? { ok: false, error: t("admin.speech.testFailed") });
      if (data?.ok && data.audio) {
        if (audioRef.current) {
          releaseOutput(audioRef.current);
        }
        const audio = registerOutput(new Audio(data.audio));
        audioRef.current = audio;
        audio.onended = () => releaseOutput(audio);
        void audio.play().catch(() => {});
      }
    } catch {
      setResult({ ok: false, error: t("setup.unreachable") });
    } finally {
      setTesting(false);
    }
  }

  return (
    <PageSection id="admin-speech" heading={t("admin.speech.heading")} glyph="ui-speech">
      <h3 className="mb-1 text-sm font-medium text-stone-200">{t("admin.speech.narration")}</h3>
      <p className="mb-3 text-xs text-stone-500">
        {t("admin.speech.narrationIntro")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField<Provider>
          label={t("admin.speech.server")}
          value={speech.ttsProvider}
          onChange={(ttsProvider) => set({ ttsProvider })}
          options={[
            {
              value: "",
              label: t("admin.speech.server.auto", {
                kind:
                  envProvider === "openai"
                    ? t("admin.speech.auto.openai")
                    : envProvider === "off"
                      ? t("admin.speech.auto.off")
                      : t("admin.speech.auto.kokoro"),
              }),
            },
            { value: "kokoro", label: t("admin.speech.server.kokoro") },
            { value: "openai", label: t("admin.speech.server.openai") },
            { value: "off", label: t("admin.speech.server.off") },
          ]}
        />
        {provider === "kokoro" ? (
          <Field label={t("admin.speech.kokoroUrl")} hint={inheritedHint(t, speech.kokoroUrl, env.kokoroUrl)}>
            <input
              className={ui.input}
              value={speech.kokoroUrl}
              onChange={(event) => set({ kokoroUrl: event.target.value })}
              placeholder={env.kokoroUrl}
            />
          </Field>
        ) : null}
        {provider === "openai" ? (
          <>
            <Field
              label={t("admin.speech.baseUrl")}
              hint={
                env.ttsBaseUrl
                  ? inheritedHint(t, speech.ttsBaseUrl, env.ttsBaseUrl)
                  : t("admin.speech.baseUrlHint")
              }
            >
              <input
                className={ui.input}
                value={speech.ttsBaseUrl}
                onChange={(event) => set({ ttsBaseUrl: event.target.value })}
                placeholder={env.ttsBaseUrl || "https://api.openai.com/v1"}
              />
            </Field>
            <ModelChoiceField
              label={t("admin.speech.model")}
              hint={t("admin.speech.modelHint")}
              role="narration"
              provider="speech"
              baseUrl={openaiAt}
              apiKey={apiKey === SECRET_KEPT ? "" : apiKey}
              value={speech.ttsModel}
              onChange={(ttsModel) => set({ ttsModel })}
              narrow={SPEECH_MODELS.narration}
              blankLabel={env.ttsModel ? fromEnv(t, env.ttsModel, "TTS_MODEL") : official ? BLANK.narration : BLANK.narrationServer}
              onListing={setNarrationListing}
            />
            <SecretField
              label={t("admin.speech.apiKey")}
              isSet={speech.hasTtsApiKey}
              value={apiKey}
              onChange={(value) => {
                setResult(null);
                onApiKey(value);
              }}
              hint={
                env.hasTtsApiKey
                  ? t("admin.speech.keyEnvHint")
                  : official
                    ? t("admin.speech.keyOpenaiHint")
                    : t("admin.speech.keyNone")
              }
            />
          </>
        ) : null}
        {provider === "off" ? null : (
          <Field
            label={t("admin.speech.voice")}
            hint={
              provider === "openai"
                ? t("admin.speech.voice.openaiHint", { blank: official ? t("admin.speech.voice.blankAlloy") : t("admin.speech.voice.blankServer") })
                : t("admin.speech.voice.kokoroHint")
            }
          >
            <input
              className={ui.input}
              value={speech.ttsVoice}
              maxLength={120}
              onChange={(event) => set({ ttsVoice: event.target.value })}
              placeholder={provider === "openai" ? (official ? "alloy" : "") : "af_heart"}
            />
          </Field>
        )}
      </div>
      {narrationNeedsModel ? (
        <p role="status" className="mt-3 text-xs text-amber-300" data-needs-model>
          {t("admin.speech.needsModel")}
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-stone-400">
        {provider === "off"
          ? t("admin.speech.where.off")
          : provider === "kokoro"
            ? t("admin.speech.where.kokoro", { host: host(kokoroAt) })
            : t("admin.speech.where.openai", { host: host(openaiAt), billed: official ? t("admin.speech.where.billed") : "" })}
      </p>
      {provider === "off" ? null : (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={test} disabled={testing} aria-busy={testing} className={ui.btnSmall}>
              {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              {t("admin.speech.test")}
            </button>
            <span className="text-xs text-stone-500">
              {t("admin.speech.testNote")}
            </span>
          </div>
          {testing ? (
            <p role="status" className="live-in mt-2 text-sm text-stone-400">
              {t("admin.speech.asking")}
            </p>
          ) : null}
          {result?.ok ? (
            <p role="status" className="live-in mt-2 flex flex-wrap items-center gap-1 text-sm text-emerald-400">
              <Check className="size-4" /> {t("admin.speech.spoken", { model: result.model ?? "", voice: result.voice ?? "" })}
              {result.voices
                ? t("admin.speech.voices", { count: result.voices })
                : t("admin.speech.voicesNone")}
            </p>
          ) : result ? (
            <p role="alert" className="motion-shake mt-2 flex items-start gap-1 text-sm text-red-400">
              <X className="mt-0.5 size-4 shrink-0" /> {result.error || t("admin.speech.noAnswer")}
            </p>
          ) : null}
          {result && !result.ok && result.endpoint ? (
            <p className="mt-1 break-all text-xs text-stone-500">{t("admin.speech.tried", { endpoint: result.endpoint })}</p>
          ) : null}
        </div>
      )}

      <h3 className="mb-1 mt-6 text-sm font-medium text-stone-200">{t("admin.speech.dictation")}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("admin.speech.whisperUrl")} hint={inheritedHint(t, speech.sttUrl, env.sttUrl, t("admin.speech.whisperHint"))}>
          <input
            className={ui.input}
            value={speech.sttUrl}
            onChange={(event) => onSpeech({ ...speech, sttUrl: event.target.value })}
            placeholder={env.sttUrl}
          />
        </Field>
        {whisperSwitchedOff(whisperAt) ? null : (
          <ModelChoiceField
            label={t("admin.speech.whisperModel")}
            hint={t("admin.speech.whisperModelHint")}
            role="dictation"
            provider="speech"
            baseUrl={whisperAt}
            value={speech.sttModel}
            onChange={(sttModel) => onSpeech({ ...speech, sttModel })}
            narrow={SPEECH_MODELS.dictation}
            blankLabel={env.sttModel ? fromEnv(t, env.sttModel, "STT_MODEL") : BLANK.whisper}
          />
        )}
        <BuiltinSpeechCard />
        <details
          className="rounded-lg border border-stone-800 bg-stone-950/40 px-3 py-2 sm:col-span-2"
          onToggle={(event) => {
            if (event.currentTarget.open) setOpenAiDictation(true);
          }}
        >
          <summary className="cursor-pointer text-sm text-stone-300">{t("admin.speech.openaiDictation")}</summary>
          {openAiDictation ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ModelChoiceField
                label={t("admin.speech.transcriptionModel")}
                hint={t("admin.speech.transcriptionHint")}
                role="dictation"
                provider="speech"
                baseUrl={openaiSpeechBaseUrl}
                value={speech.sttOpenaiModel}
                onChange={(sttOpenaiModel) => onSpeech({ ...speech, sttOpenaiModel })}
                narrow={SPEECH_MODELS.dictation}
                blankLabel={env.sttOpenaiModel ? fromEnv(t, env.sttOpenaiModel, "STT_OPENAI_MODEL") : BLANK.transcription}
              />
            </div>
          ) : null}
        </details>
      </div>
    </PageSection>
  );
}
