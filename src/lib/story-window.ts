// How big a context window the storyteller needs, measured through the
// request fitter (src/lib/dm/request-fit.ts): the first call of a turn, with
// the compact tool set whole and the reply's 1,024 tokens, over a party of
// one to four heroes, exploring and in a fight
// (scripts/test-enforce-sweep-modelio-schema.mjs budget rows, 2026-11-09):
//
//   exploring  lone level 1 fighter 15,353; lone level 3 fighter 15,806;
//              lone level 5 wizard 18,707 (the casting rules); fighter and
//              wizard 18,997; four level 5 heroes 19,720
//   fighting   lone level 1 fighter 24,369; lone level 3 fighter 25,043;
//              fighter and wizard 28,480; four level 5 heroes 29,678 (the
//              fight's rules and turn order are about 6K on their own)
//
// So 24K narrates, explores and checks for a party of four, and 32K runs
// its fights. These were 16K and 24K, measured on a lone level 1 fighter:
// every other party fell to the four essential tools on a 16K window, and
// every fight measured on a 24K one (gap sweep 2026-11-09). 48K plays on
// the trimmed set, with recent turns in view (src/lib/dm/model-tuning-
// logic.ts). The README, the guided setup, the model pickers and the
// window-too-small refusal all quote these, and scripts/test-story-window.mjs
// keeps the docs saying the same.
//
// Round thousands, as the model catalog counts them, so a model sold as
// "24K" (24,000 tokens) is not told it is short of 24K; the llama-server
// commands the docs give (-c 24576, 32768, 49152) clear each one.
//
// The sentences live in the dictionaries (story.window.*); like
// home/types.ts's agoLabel, the builders take the translator from the
// surface that shows them, so a language switch rewords them with
// everything else. windowLabel's output is pinned ("64K", "1.1M") — those
// are the numbers the docs and the llama-server commands quote.
import { translate } from "./messages-logic.ts";

// The shape of a translator, as the pure sentence builders take it.
type T = (key: string, vars?: Record<string, string | number>) => string;

export const MIN_NARRATION_WINDOW = 24_000;
export const MIN_COMBAT_WINDOW = 32_000;
export const RECOMMENDED_WINDOW = 48_000;
// The window the docs' llama-server commands start with (-c 65536): the
// full tool set with a long transcript. The app asks Ollama for no more than
// this unless LOCAL_TEXT_CONTEXT says otherwise (model-client.ts
// localContextTokens).
export const DEFAULT_WINDOW = 65_536;

// llama-server's -c counts in 1,024s (65536 is "64K"), the catalog in
// thousands (128000 is "128K"); each size is named the way it was set.
export function windowLabel(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 100_000) / 10}M`;
  return `${Math.round(tokens / (tokens % 1_000 !== 0 && tokens % 1_024 === 0 ? 1_024 : 1_000))}K`;
}

// "A 16K window", "An 8K window" — and "Une fenêtre de 16K" in French,
// where no article changes before a digit. English keeps its two forms;
// the size's own digits decide which.
export function aWindow(t: T, tokens: number): string {
  const size = windowLabel(tokens);
  return t(/^(8|11|18)/.test(size) ? "story.window.an" : "story.window", { size });
}

// The value to start llama-server with (-c) for at least this many tokens:
// the same count of K in 1,024s (48,000 is -c 49152, the "48K" a server
// runs, not the 48,128 that merely clears it). A count already in 1,024s is
// its own flag.
export function windowFlag(tokens: number): number {
  return tokens % 1_024 === 0 ? tokens : Math.ceil(tokens / 1_000) * 1_024;
}

// The window sizes the requirement sentence quotes, from the constants.
const needsVars = () => ({
  min: windowLabel(MIN_NARRATION_WINDOW),
  combat: windowLabel(MIN_COMBAT_WINDOW),
  recommended: windowLabel(RECOMMENDED_WINDOW),
});

// English-bound, for the const the docs and reports quote.
const enT: T = (key, vars) => translate("en", key, vars);

// The one sentence every surface uses for the requirement itself, English
// by source: the README and the guides quote it, and the report and the
// request fitter's refusals carry it to places no table language reaches.
export const STORY_WINDOW_NEEDS = enT("story.needs", needsVars());

// The same sentence in the reader's language: the surfaces that show it
// pass their own translator, as storyWindowVerdict does. (STORY_WINDOW_NEEDS
// stays the docs' and reports' pinned English.)
export function storyNeeds(t: T): string {
  return t("story.needs", needsVars());
}

export type StoryWindowLevel = "short" | "no-fights" | "tight" | "ok";

// What a table can do in a window, worded for the admin choosing a model.
// Empty text when the window is enough for everything.
export function storyWindowVerdict(t: T, tokens: number): { level: StoryWindowLevel; text: string } {
  const size = aWindow(t, tokens);
  if (tokens < MIN_NARRATION_WINDOW) {
    return {
      level: "short",
      text: t("story.window.short", { size, needs: t("story.needs", needsVars()) }),
    };
  }
  if (tokens < MIN_COMBAT_WINDOW) {
    return {
      level: "no-fights",
      text: t("story.window.noFights", {
        size,
        combat: windowLabel(MIN_COMBAT_WINDOW),
        recommended: windowLabel(RECOMMENDED_WINDOW),
      }),
    };
  }
  if (tokens < RECOMMENDED_WINDOW) {
    return {
      level: "tight",
      text: t("story.window.tight", { size, recommended: windowLabel(RECOMMENDED_WINDOW) }),
    };
  }
  return { level: "ok", text: "" };
}
