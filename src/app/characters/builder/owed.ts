import type { MessageKey } from "@/lib/messages/en";
import type { BlockerTarget, StepBlock } from "./submit";

// The caller's translator (home/types.ts agoLabel pattern): the owed line
// reads in the reader's language, a test passing translate("en", ...).
type Translator = (key: string, vars?: Record<string, string | number>) => string;

// The "choices left on this step" line (steps/shared.tsx OwedLine): every
// pick a step's gate still holds, once per block, in the gate's order and
// in a player's words. The footer's blocker says the first of them; this
// says how many there are and goes to each. Pure, for
// scripts/test-builder-owed.mjs.

export const TARGET_WORDS: Record<BlockerTarget, MessageKey> = {
  name: "builder.owed.name",
  background: "builder.owed.background",
  backgroundSkills: "builder.owed.backgroundSkills",
  race: "builder.owed.race",
  languages: "builder.owed.languages",
  racialAsi: "builder.owed.racialAsi",
  racialSkills: "builder.owed.racialSkills",
  racialTool: "builder.owed.racialTool",
  racialCantrip: "builder.owed.racialCantrip",
  racialFeat: "builder.owed.racialFeat",
  ancestry: "builder.owed.ancestry",
  // The species names its own choice ("Bloodline"); the block carries it.
  variant: "builder.owed.variant",
  repeatSkills: "builder.owed.repeatSkills",
  class: "builder.owed.class",
  multiclass: "builder.owed.multiclass",
  classSkills: "builder.owed.classSkills",
  tools: "builder.owed.tools",
  subclass: "builder.owed.subclass",
  styles: "builder.owed.styles",
  expertise: "builder.owed.expertise",
  options: "builder.owed.options",
  scores: "builder.owed.scores",
  asi: "builder.owed.asi",
  spells: "builder.owed.spells",
  gear: "builder.owed.gear",
};

export type OwedPick = { target: BlockerTarget; label: string; message: string };

export function owedPicks(t: Translator, blocks: ReadonlyArray<StepBlock>): OwedPick[] {
  const seen = new Set<BlockerTarget>();
  const out: OwedPick[] = [];
  for (const entry of blocks) {
    if (seen.has(entry.target)) continue;
    seen.add(entry.target);
    out.push({ target: entry.target, label: entry.label ?? t(TARGET_WORDS[entry.target]), message: entry.message });
  }
  return out;
}

// "Two choices left on this step", or null when none are.
export function owedHeadline(t: Translator, count: number): string | null {
  if (count <= 0) return null;
  return t("builder.owed.headline", { count });
}
