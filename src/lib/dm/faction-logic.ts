// Factions and reputation (docs/vtt-parity-implementation-plan.md section
// 6): the pure half. A faction has a stance toward the party and a power
// the world's arcs move; the party has a reputation with each, minus five
// to five, that leans every social check with one of its members.

import { containsPhrase, textKey } from "../language/text-logic.ts";

export const FACTION_ATTITUDES = ["hostile", "wary", "neutral", "friendly", "allied"] as const;
export type FactionAttitude = (typeof FACTION_ATTITUDES)[number];

export type Faction = {
  id: string;
  campaignId: string;
  name: string;
  blurb: string;
  // DM-only: what they are working toward.
  goal: string;
  attitude: FactionAttitude;
  // 0 (a rumour) to 5 (they run the city). DM-only.
  power: number;
  tags: string[];
  portraitPath: string;
  createdAt: string;
  updatedAt: string;
};

export const REPUTATION_MIN = -5;
export const REPUTATION_MAX = 5;
export const POWER_MAX = 5;

export function clampReputation(value: number): number {
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(value) || 0));
}

export function clampPower(value: number): number {
  return Math.max(0, Math.min(POWER_MAX, Math.round(value) || 0));
}

export function normalizeFactionAttitude(raw: unknown): FactionAttitude {
  return FACTION_ATTITUDES.includes(raw as FactionAttitude) ? (raw as FactionAttitude) : "neutral";
}

export function normalizeReputation(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const number = Number(value);
      if (id && Number.isFinite(number) && number !== 0) {
        out[id] = clampReputation(number);
      }
    }
  }
  return out;
}

// The words a player sees for a standing, so the table never watches a
// number tick. The words are the dictionaries' (faction.standing.*); the
// showing surface passes its translator.
const STANDING_KEYS: Record<string, string> = {
  hunted: "faction.standing.hunted",
  disliked: "faction.standing.disliked",
  suspected: "faction.standing.suspected",
  unknown: "faction.standing.unknown",
  noticed: "faction.standing.noticed",
  trusted: "faction.standing.trusted",
  honoured: "faction.standing.honoured",
};

// The shape of a translator, as the pure sentence builders take it.
type T = (key: string, vars?: Record<string, string | number>) => string;

// The standing's raw word, which the DM's prompt quotes (English by
// protocol); reputationLabel is its reader-facing form.
function standingWord(value: number): string {
  if (value <= -4) return "hunted";
  if (value <= -2) return "disliked";
  if (value < 0) return "suspected";
  if (value === 0) return "unknown";
  if (value < 2) return "noticed";
  if (value < 4) return "trusted";
  return "honoured";
}

export function reputationLabel(t: T, value: number): string {
  return t(STANDING_KEYS[standingWord(value)] ?? "faction.standing.unknown");
}

// The standing's English word, pinned: the tool results and the prompt the
// model reads quote it (English by protocol), never the reader's language.
export function reputationWord(value: number): string {
  return standingWord(value);
}

// The attitude ladder's chip words, the same way (faction.attitude.*).
const ATTITUDE_KEYS: Record<FactionAttitude, string> = {
  hostile: "faction.attitude.hostile",
  wary: "faction.attitude.wary",
  neutral: "faction.attitude.neutral",
  friendly: "faction.attitude.friendly",
  allied: "faction.attitude.allied",
};

export function attitudeLabel(t: T, attitude: FactionAttitude): string {
  return t(ATTITUDE_KEYS[attitude] ?? "faction.attitude.neutral");
}

// A social check with a faction's member leans on the party's standing:
// each point of reputation is a point off the DC, each point against is a
// point on. Bounded by the reputation range itself.
export function reputationDcOffset(reputation: number): number {
  return 0 - clampReputation(reputation) || 0;
}

// The chapter tick (section 6): a faction's goal advances on background
// dice the way an NPC's does, and its power drifts with it. Returns the
// facts the world should record.
export function advanceFactionGoals(
  factions: Faction[],
  random: () => number = Math.random,
): Array<{ faction: Faction; power: number; fact: string }> {
  const out: Array<{ faction: Faction; power: number; fact: string }> = [];
  for (const faction of factions) {
    if (!faction.goal.trim()) {
      continue;
    }
    const roll = random();
    if (roll < 0.25) {
      const power = clampPower(faction.power + 1);
      out.push({ faction, power, fact: `${faction.name} gained ground toward: ${faction.goal}` });
    } else if (roll > 0.9) {
      const power = clampPower(faction.power - 1);
      out.push({ faction, power, fact: `${faction.name} suffered a setback in: ${faction.goal}` });
    }
  }
  return out;
}

// A world arc names a faction when the faction's whole name stands in the
// arc's own name or driver as whole words, never inside another word ("the
// Ashford Rebellion" names no Ash); a rung reached moves that faction's
// power.
export function factionsNamedBy(text: string, factions: Faction[]): Faction[] {
  return factions.filter((faction) => Boolean(textKey(faction.name)) && containsPhrase(text, faction.name));
}

// The factions block for the prompt: the DM's version carries power and
// goal, the player's carries only how each faction stands.
export function renderFactionsForPrompt(
  factions: Faction[],
  reputation: Record<string, number>,
  dmView: boolean,
): string {
  if (!factions.length) {
    return "";
  }
  const lines = factions.slice(0, 12).map((faction) => {
    const standing = reputation[faction.id] ?? 0;
    const base = `- ${faction.name} (${faction.attitude} to the party; the party is ${standingWord(standing)} to them, ${standing >= 0 ? "+" : ""}${standing})`;
    if (!dmView) {
      return `${base}${faction.blurb ? `: ${faction.blurb}` : ""}`;
    }
    return `${base}: ${faction.blurb}${faction.goal ? ` | GOAL (GM-only): ${faction.goal}` : ""} | power ${faction.power}/5`;
  });
  return `FACTIONS (standing shifts through adjust_reputation; a member's social checks lean on it):\n${lines.join("\n")}`;
}
