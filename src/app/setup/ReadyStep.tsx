"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ui } from "@/lib/ui";
import { BackendProbe } from "@/app/admin/BackendProbe";
import { HarnessTestPanel } from "@/app/admin/HarnessTestPanel";
import type { Capabilities } from "@/lib/capabilities";
import type { Draft } from "@/app/setup/draft";
import { Lamp, type Tone } from "@/app/setup/SetupParts";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

type Row = { key: string; title: string; tone: Tone; text: string; step: number };

const SIGNUP_KEYS: Record<Draft["signupMode"], MessageKey> = {
  invite: "setup.ready.signups.invite",
  open: "setup.ready.signups.open",
  closed: "setup.ready.signups.closed",
};

const STT_KEYS: Record<string, MessageKey> = {
  whisper: "setup.ready.stt.whisper",
  builtin: "setup.ready.stt.builtin",
  openai: "setup.ready.stt.openai",
};

// Each row's line, keyed into the dictionaries; a fresh row list on every
// ask, so a change of state re-renders its words.
function rows(
  t: (key: string, vars?: Record<string, string | number>) => string,
  input: {
    draft: Draft;
    caps: Capabilities | null;
    address: string;
    agentConnected: boolean;
    steps: Record<string, number>;
  },
): Row[] {
  const { draft, caps, steps } = input;
  const wait = !caps;
  const row = (key: string, titleKey: MessageKey, tone: Tone, text: string, step: number): Row => ({
    key,
    title: t(titleKey),
    tone,
    text,
    step,
  });
  const asking = t("setup.ready.asking");
  const story: Row =
    draft.story === "none"
      ? row("story", "setup.ready.row.story", "off", t("setup.ready.story.person"), steps.story)
      : wait
        ? row("story", "setup.ready.row.story", "wait", t("setup.ready.askingStory"), steps.story)
        : caps.story.configured && caps.story.reachable
          ? row("story", "setup.ready.row.story", "ok", caps.story.model ? t("setup.ready.storyOkModel", { model: caps.story.model }) : t("setup.ready.storyOk"), steps.story)
          : row(
              "story",
              "setup.ready.row.story",
              "bad",
              draft.story === "agent"
                ? t("setup.ready.agentNotReady")
                : t("setup.ready.storyNotAnswering"),
              steps.story,
            );
  const pictures: Row =
    draft.pictures === "none"
      ? row("pictures", "setup.ready.row.pictures", "off", t("setup.ready.pictures.none"), steps.pictures)
      : draft.pictures === ""
        ? // Skipped: nothing was saved, and a ComfyUI found on its own still counts.
          wait
          ? row("pictures", "setup.ready.row.pictures", "wait", asking, steps.pictures)
          : caps.images.configured && caps.images.reachable
            ? row("pictures", "setup.ready.row.pictures", "ok", t("setup.ready.pictures.ok"), steps.pictures)
            : row("pictures", "setup.ready.row.pictures", "off", t("setup.ready.pictures.notSetup"), steps.pictures)
      : wait
        ? row("pictures", "setup.ready.row.pictures", "wait", asking, steps.pictures)
        : caps.images.configured && caps.images.reachable
          ? row("pictures", "setup.ready.row.pictures", "ok", draft.pictures === "comfyui" ? t("setup.ready.pictures.comfy") : draft.pictures === "openai" ? t("setup.ready.pictures.openai") : t("setup.ready.pictures.agent"), steps.pictures)
          : caps.images.needsModel
            ? row("pictures", "setup.ready.row.pictures", "warn", t("setup.ready.pictures.noModel"), steps.pictures)
            : row("pictures", "setup.ready.row.pictures", "warn", t("setup.ready.pictures.notAnswering"), steps.pictures);
  const narration: Row =
    draft.narration === "off"
      ? row("narration", "setup.ready.row.narration", "off", t("setup.ready.narration.off"), steps.voice)
      : draft.narration === ""
        ? wait
          ? row("narration", "setup.ready.row.narration", "wait", asking, steps.voice)
          : caps.tts.configured && caps.tts.reachable
            ? row("narration", "setup.ready.row.narration", "ok", t("setup.ready.narration.ok"), steps.voice)
            : row("narration", "setup.ready.row.narration", "off", t("setup.ready.narration.notSetup"), steps.voice)
      : wait
        ? row("narration", "setup.ready.row.narration", "wait", asking, steps.voice)
        : caps.tts.configured && caps.tts.reachable
          ? row("narration", "setup.ready.row.narration", "ok", draft.narration === "kokoro" ? t("setup.ready.narration.kokoro") : t("setup.ready.narration.openai"), steps.voice)
          : caps.tts.needsModel
            ? row("narration", "setup.ready.row.narration", "warn", t("setup.ready.narration.noModel"), steps.voice)
            : row("narration", "setup.ready.row.narration", "warn", t("setup.ready.narration.notAnswering"), steps.voice);
  const dictation: Row = wait
    ? row("dictation", "setup.ready.row.dictation", "wait", asking, steps.voice)
    : caps.stt.configured
      ? row("dictation", "setup.ready.row.dictation", "ok", STT_KEYS[caps.stt.backend] ? t(STT_KEYS[caps.stt.backend]) : t("setup.ready.ready"), steps.voice)
      : row("dictation", "setup.ready.row.dictation", "off", t("setup.ready.dictation.off"), steps.voice);
  const players: Row = {
    key: "players",
    title: t("setup.ready.row.players"),
    tone: "ok",
    text: `${t(SIGNUP_KEYS[draft.signupMode])}${input.address ? ` · ${input.address}` : ""}`,
    step: steps.players,
  };
  const agent: Row = input.agentConnected
    ? row("agent", "setup.ready.row.agent", "ok", t("setup.ready.agent.ok"), steps.agent)
    : row("agent", "setup.ready.row.agent", "off", t("setup.ready.agent.off"), steps.agent);
  return [story, pictures, narration, dictation, players, agent];
}

// The last step: what the server can do now, asked live, each line with a
// way back to the step that sets it, and one real test of the storyteller.
export function ReadyStep({
  active,
  draft,
  address,
  agentConnected,
  steps,
  onJump,
}: {
  active: boolean;
  draft: Draft;
  address: string;
  agentConnected: boolean;
  steps: Record<string, number>;
  onJump: (step: number) => void;
}) {
  const t = useT();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [checking, setChecking] = useState(false);

  const ask = useCallback(
    () =>
      fetch("/api/capabilities")
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
        .then((data) => {
          setCaps(data as Capabilities | null);
          setChecking(false);
        }),
    [],
  );

  // Asked on each arrival (the wizard remounts this step with a new key):
  // the steps before it have just saved.
  useEffect(() => {
    if (active) void ask();
  }, [active, ask]);

  function check() {
    setChecking(true);
    setCaps(null);
    void ask();
  }

  const list = rows(t, { draft, caps, address, agentConnected, steps });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-stone-400">{t("setup.ready.heading")}</span>
        <button type="button" className={ui.btnSmall} onClick={check} disabled={checking} aria-busy={checking}>
          <RefreshCw className={checking ? "size-3.5 animate-spin" : "size-3.5"} /> {t("setup.ready.checkAgain")}
        </button>
      </div>
      <ul className="stagger space-y-2" aria-live="polite">
        {list.map((row) => (
          <li key={row.key} className="su-row">
            <Lamp tone={row.tone} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-stone-100">{row.title}</span>
              <span key={row.text} className="live-in block text-xs text-stone-400">
                {row.text}
              </span>
            </span>
            <button type="button" className={ui.btnSmall} onClick={() => onJump(row.step)}>
              {t("setup.ready.change")}
            </button>
          </li>
        ))}
      </ul>

      {draft.story === "local" || draft.story === "key" ? (
        <div className="su-row flex-col items-stretch">
          <span className="text-sm text-stone-200">{t("setup.ready.tryStory")}</span>
          <BackendProbe which="story" baseUrl="" model="" />
        </div>
      ) : draft.story === "agent" && draft.agent.id ? (
        <div className="su-row flex-col items-stretch">
          <span className="text-sm text-stone-200">{t("setup.ready.tryAgent")}</span>
          <HarnessTestPanel saved paints={false} picturesVerified={false} onVerified={check} />
        </div>
      ) : null}
    </div>
  );
}
