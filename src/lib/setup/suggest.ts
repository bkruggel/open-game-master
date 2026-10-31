// What the guided setup suggests for pictures and narration, from what the
// admin already chose for the storyteller and what the scan found running
// here. The one rule underneath: reuse what is already set up. An agent
// that narrates and can paint paints too, on the same sign-in; an OpenAI key
// given for the story covers pictures, narration and dictation; a ComfyUI or
// Kokoro already running on this machine is free and private. Suggestions
// only mark a card and fill an unanswered step: nothing is saved until the
// admin presses Continue, and "Skip for now" saves nothing at all.
// Pure, so scripts/test-setup-wizard.mjs checks each one.
import { PAINTING_AGENTS, type HarnessChoiceId } from "./patches.ts";

export type SuggestInput = {
  story: "local" | "key" | "agent" | "none" | "";
  agentId: HarnessChoiceId | "";
  storyIsOpenAi: boolean;
  comfyFound: boolean;
  kokoroFound: boolean;
};

export type PicturesSuggestion = { pick: "agent" | "openai" | "comfyui" | "none"; reason: string };
export type NarrationSuggestion = { pick: "kokoro" | "openai" | "off"; reason: string };

export const AGENT_LABELS: Record<HarnessChoiceId, string> = {
  claude: "Claude Code",
  codex: "Codex",
  opencode: "opencode",
  grok: "Grok Build",
};

export function suggestPictures(
  t: (key: string, vars?: Record<string, string | number>) => string,
  input: SuggestInput,
): PicturesSuggestion {
  if (input.story === "agent" && input.agentId && PAINTING_AGENTS.includes(input.agentId)) {
    const name = AGENT_LABELS[input.agentId];
    return {
      pick: "agent",
      reason: t("setup.suggest.agentPaints", { name }),
    };
  }
  if (input.storyIsOpenAi) {
    return { pick: "openai", reason: t("setup.suggest.openaiPictures") };
  }
  if (input.comfyFound) {
    return { pick: "comfyui", reason: t("setup.suggest.comfy") };
  }
  return {
    pick: "none",
    reason: t("setup.suggest.none"),
  };
}

export function suggestNarration(
  t: (key: string, vars?: Record<string, string | number>) => string,
  input: SuggestInput,
): NarrationSuggestion {
  if (input.storyIsOpenAi) {
    return { pick: "openai", reason: t("setup.suggest.openaiNarration") };
  }
  if (input.kokoroFound) {
    return { pick: "kokoro", reason: t("setup.suggest.kokoro") };
  }
  return {
    pick: "off",
    reason: t("setup.suggest.off"),
  };
}

// Whether to fill an unanswered step with the suggestion. "None" and "off"
// are never filled in: they would be saved as a deliberate choice, and
// leaving a service unanswered is not the same as switching it off.
export function fillsStep(pick: PicturesSuggestion["pick"] | NarrationSuggestion["pick"]): boolean {
  return pick !== "none" && pick !== "off";
}
