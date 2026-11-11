// The reactions a player may take right now against an attack the engine
// recorded (src/lib/dm/last-hit.ts, projected as PublicEncounter.lastHits):
// Shield, Uncanny Dodge, Deflect Missiles and Hellish Rebuke for the
// character just hit, Slow Fall after a fall, Cutting Words and Protection
// for an ally just hit, and the subclass reactions the authored layer
// resolves (src/lib/srd/authored-effects.ts). Absorb Elements is not offered:
// it is not an SRD 5.1 spell and use_reaction does not resolve it.
// use_reaction re-resolves the recorded
// attack and gives back what the rules give back; these cards only offer
// the choice while the engine would still accept it, and carry the engine's
// own refusals (can-act, the cast guard's rules, the reaction budget).
//
// Pure; scripts/test-hand-engine.mjs drives it.
import { casterStateProblem, componentProblem, focusProblem } from "@/lib/dm/cast-rules";
import type { PublicLastHit } from "@/lib/db/encounter-view";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { bundledSpellFacts } from "@/lib/srd/spell-facts";
import { gateHolds, heldAuthored, type AuthoredReaction } from "@/lib/srd/authored-effects";

type ReactionDoes = AuthoredReaction["does"];
import {
  costGate,
  gated,
  lowestSlot,
  slotLine,
  standingGate,
  type Gate,
  type HandCard,
  type HandTarget,
  type HandTurn,
} from "@/lib/battlemap/hand-core";
import { spellNames } from "@/lib/battlemap/hand-spells";
import { COMMANDED } from "@/lib/dm/maneuver-rules";
import type { ToolError } from "@/lib/dm/tool-errors";
import { textKey } from "@/lib/language/text-logic";
import { holdsFeature, isNamed } from "@/lib/srd/feature-names";

// Like composerGate, the card's own words (prompts, rules, refusal reasons;
// table.hand.react.*) are read with the translator of the component that
// draws the hand, so a language switch rewords them with everything else.
// Pure otherwise: the ids, the gates and the intents are untouched.
type Translator = (key: string, vars?: Record<string, string | number>) => string;

// A Battle Master maneuver's card wears its painting.
const MANEUVER_ICON = (name: string): HandCard["icon"] => ({ kind: "option", key: `Maneuver: ${name}`, family: "option-maneuver" });

function base(
  t: Translator,
  id: string,
  name: string,
  prompt: string,
  target: HandTarget,
  intent: HandCard["intent"],
  extra: Partial<HandCard> = {},
): HandCard {
  return {
    id: `reaction:${id}`,
    type: "ward",
    name,
    cost: "reaction",
    range: t("table.hand.react.selfRange"),
    dice: "",
    roll: t("table.hand.react.noRoll"),
    rules: "",
    resource: "",
    condition: "",
    icon: { kind: "feature", key: name, family: null },
    target,
    toHit: null,
    damage: null,
    damageType: "",
    heals: false,
    save: null,
    melee: false,
    disabled: null,
    spent: false,
    compose: false,
    intent,
    prompt,
    ...extra,
  };
}

function what(t: Translator, hit: PublicLastHit, whom: string): string {
  if (hit.source === "fall") return t("table.hand.react.fell", { whom, damage: hit.damage });
  // The hit named is the one Uncanny Dodge would halve; a multiattack's
  // other hits are counted, not added to its damage.
  const others = (hit.hits ?? 1) > 1 ? t("table.hand.react.heavy", { count: hit.hits ?? 1 }) : "";
  const line = hit.damage
    ? hit.type
      ? t("table.hand.react.hit", { attacker: hit.attacker, attack: hit.attack, whom, damage: hit.damage, type: hit.type })
      : t("table.hand.react.hitPlain", { attacker: hit.attacker, attack: hit.attack, whom, damage: hit.damage })
    : t("table.hand.react.hitBare", { attacker: hit.attacker, attack: hit.attack, whom });
  return line + others;
}

// A reaction spell the sheet holds, gated as the cast guard gates it.
function spellReaction(
  t: Translator,
  sheet: CharacterSheet,
  turn: HandTurn,
  spell: string,
  prompt: string,
  rules: string,
  target: HandTarget,
  extra: Partial<HandCard> = {},
): HandCard | null {
  if (!spellNames(sheet).some((name) => textKey(name) === textKey(spell))) return null;
  const facts = bundledSpellFacts(spell);
  const slot = lowestSlot(sheet, facts?.level ?? 1);
  const card = base(
    t,
    textKey(spell).replace(/\s+/g, "-"),
    spell,
    prompt,
    target,
    { card: "reaction", feature: spell, spell, slotLevel: slot?.level ?? null },
    { type: "spell", rules, resource: slot ? slotLine(slot, t) : t("table.hand.react.noSlots"), icon: { kind: "spell", key: spell, family: null }, ...extra },
  );
  const problem = (refusal: ToolError | null): Gate => (refusal ? { reason: refusal.error, spent: false } : null);
  return gated(
    card,
    standingGate(sheet, turn, "reaction", t),
    problem(casterStateProblem(sheet)),
    problem(componentProblem(sheet, facts) ?? focusProblem(sheet, facts)),
    slot ? null : { reason: t("table.hand.react.noSlotFor", { name: sheet.name, spell }), spent: true },
    costGate("reaction", turn, sheet, spell, t),
  );
}

// The reactions the player's other characters may take now (a person playing
// several heroes, src/lib/player-characters.ts offTurnReactors): the hit
// hero is seldom the one acting, and the Hand follows the one acting. Each
// card names its hero and carries them as its actor, and its id is the
// hero's own, so it never stands in for the acting hero's card of the same
// name.
export function offTurnReactionCards(
  t: Translator,
  heroes: Array<{ sheet: CharacterSheet; turn: HandTurn }>,
  hits: PublicLastHit[],
  party: Array<Pick<CharacterSheet, "id" | "name">>,
): HandCard[] {
  return heroes.flatMap(({ sheet, turn }) =>
    reactionCards(t, sheet, turn, hits, party, sheet.name).map((card) => ({
      ...card,
      id: `${card.id}@${sheet.id}`,
      actor: { id: sheet.id, name: sheet.name },
    })),
  );
}

// Every reaction card the moment offers, the character's own hit first.
// `self` is how the prompt names the character hit: "you" in their own hand
// (table.hand.react.you), their name in another hero's.
export function reactionCards(
  t: Translator,
  sheet: CharacterSheet,
  turn: HandTurn,
  hits: PublicLastHit[],
  party: Array<Pick<CharacterSheet, "id" | "name">>,
  self = t("table.hand.react.you"),
): HandCard[] {
  const cards: HandCard[] = [];
  const answered = (hit: PublicLastHit, name: string) =>
    hit.answered.some((entry) => textKey(entry) === textKey(name));
  const feature = (hit: PublicLastHit, name: string, prompt: string, rules: string, target: HandTarget = "none", icon?: HandCard["icon"]) => {
    if (answered(hit, name)) return;
    const card = base(
      t,
      `${textKey(name).replace(/\s+/g, "-")}:${hit.characterId}`,
      name,
      prompt,
      target,
      {
        card: "reaction",
        feature: name,
      },
      { rules, ...(icon ? { icon } : {}) },
    );
    cards.push(gated(card, standingGate(sheet, turn, "reaction", t), costGate("reaction", turn, sheet, name, t)));
  };

  const mine = hits.find((hit) => hit.characterId === sheet.id && hit.hit);
  if (mine) {
    const prompt = what(t, mine, self);
    if (mine.source === "attack") {
      const shield = !answered(mine, "Shield")
        ? spellReaction(t, sheet, turn, "Shield", prompt, t("table.hand.react.shield"), "none")
        : null;
      if (shield) cards.push(shield);
      if (holdsFeature(sheet, "uncanny dodge")) {
        feature(mine, "Uncanny Dodge", prompt, t("table.hand.react.uncanny"));
      }
      if (mine.ranged && holdsFeature(sheet, "deflect missiles")) {
        feature(mine, "Deflect Missiles", prompt, t("table.hand.react.deflect"));
      }
      if (mine.attackerId && !answered(mine, "Hellish Rebuke")) {
        const rebuke = spellReaction(
          t,
          sheet,
          turn,
          "Hellish Rebuke",
          prompt,
          t("table.hand.react.rebuke", { attacker: mine.attacker }),
          "enemy",
        );
        if (rebuke) cards.push(rebuke);
      }
    }
    if (mine.source === "fall" && holdsFeature(sheet, "slow fall")) {
      feature(mine, "Slow Fall", prompt, t("table.hand.react.slowFall"));
    }
    if (mine.source === "attack") {
      for (const held of subclassReactions(t, sheet, mine, "self")) {
        feature(mine, held.name, prompt, held.rules, held.target);
      }
    }
  }

  // The Battle Master's reactions (src/lib/dm/maneuver-reactions.ts): Parry
  // against a melee hit, Riposte against a melee miss, each a die.
  const knows = (name: string) => sheet.features.some((entry) => /^maneuver:/i.test(entry.name) && isNamed(entry.name, name));
  const dice = sheet.resources.sub_superiority_dice;
  if (dice && dice.max > dice.used) {
    if (mine && mine.source === "attack" && !mine.ranged && knows("parry")) {
      feature(mine, "Parry", what(t, mine, self), t("table.hand.react.parry"), "none", MANEUVER_ICON("Parry"));
    }
    const missed = hits.find((hit) => hit.characterId === sheet.id && !hit.hit && hit.source === "attack" && !hit.ranged && hit.attackerId);
    if (missed && knows("riposte")) {
      feature(missed, "Riposte", t("table.hand.react.missed", { attacker: missed.attacker, attack: missed.attack, whom: self }), t("table.hand.react.riposte"), "enemy", MANEUVER_ICON("Riposte"));
    }
  }
  // A Battle Master directed this character to strike (Commander's Strike).
  if (sheet.conditions.some((entry) => entry.trim().toLowerCase() === COMMANDED)) {
    const card = base(t, "commanders-strike", "Commander's Strike", t("table.hand.react.commanderPrompt"), "enemy", { card: "reaction", feature: "Commander's Strike" }, {
      rules: t("table.hand.react.commander"),
      icon: MANEUVER_ICON("Commander's Strike"),
    });
    cards.push(gated(card, standingGate(sheet, turn, "reaction", t), costGate("reaction", turn, sheet, "Commander's Strike", t)));
  }

  // An ally's hit: Cutting Words from a Lore bard, Protection from a
  // protector with a shield. The engine checks the reach and the holder.
  for (const hit of hits) {
    if (hit.characterId === sheet.id || !hit.hit || hit.source !== "attack") continue;
    const ally = party.find((entry) => entry.id === hit.characterId);
    if (!ally) continue;
    const prompt = what(t, hit, ally.name);
    if (holdsFeature(sheet, "cutting words") && (sheet.resources.bardic_inspiration?.max ?? 0) > (sheet.resources.bardic_inspiration?.used ?? 0)) {
      feature(hit, "Cutting Words", prompt, t("table.hand.react.cuttingWords"), "ally");
    }
    if (holdsFeature(sheet, "protection")) {
      feature(hit, "Protection", prompt, t("table.hand.react.protection"), "ally");
    }
    for (const held of subclassReactions(t, sheet, hit, "ally")) {
      feature(hit, held.name, prompt, held.rules, "ally");
    }
  }
  return cards;
}

// The reaction cards the moment offers, then the hand without the cards they
// answer for: a prepared Shield sits in the hand as a spell card, and while
// the prompt offers Shield against the hit it is one choice, shown once.
export function withReactions(reactions: HandCard[], hand: HandCard[]): HandCard[] {
  if (!reactions.length) return hand;
  const offered = new Set(reactions.map((card) => textKey(card.name)));
  return [...reactions, ...hand.filter((card) => !(card.cost === "reaction" && offered.has(textKey(card.name))))];
}

// What a subclass reaction does, in a line for its card.
function reactionRules(t: Translator, does: ReactionDoes): string {
  switch (does.kind) {
    case "reduce":
      return t(does.amount === "half" ? "table.hand.react.reduceHalf" : "table.hand.react.reduce");
    case "ac_vs_hit":
      return t("table.hand.react.acVsHit");
    case "disadv_vs_hit":
      return t("table.hand.react.disadvVsHit");
    case "resist_instance":
      return t("table.hand.react.resist");
    case "take_for_ally":
      return t("table.hand.react.takeForAlly");
    case "strike_back":
      return t("table.hand.react.strikeBack", { type: does.type });
    case "redirect":
      return t("table.hand.react.redirect");
    case "force_miss":
      return t("table.hand.react.forceMiss", { count: does.exhaustion });
    default:
      return "";
  }
}

// The subclass reactions the character holds that answer this hit, on
// themselves ("self") or on an ally ("ally"), with their gate and their pool
// asked as use_reaction asks them.
function subclassReactions(
  t: Translator,
  sheet: CharacterSheet,
  hit: PublicLastHit,
  whose: "self" | "ally",
): Array<{ name: string; rules: string; target: HandTarget }> {
  const out: Array<{ name: string; rules: string; target: HandTarget }> = [];
  for (const held of heldAuthored(sheet)) {
    for (const reaction of held.entry.reactions ?? []) {
      if ((reaction.usedBy ?? "holder") !== "holder" || !gateHolds(reaction.gate, sheet, held)) continue;
      const pool = reaction.pool;
      if (pool && "id" in pool) {
        const state = sheet.resources[pool.id];
        if (!state || state.max - state.used < (pool.amount ?? 1)) continue;
      }
      const does = reaction.does;
      const typed = (types?: string[]) => !types?.length || types.includes(hit.type);
      const answers =
        whose === "self"
          ? (does.kind === "reduce" && does.who !== "ally" && typed(does.types)) ||
            does.kind === "ac_vs_hit" ||
            does.kind === "disadv_vs_hit" ||
            (does.kind === "resist_instance" && typed(does.types)) ||
            does.kind === "redirect" ||
            does.kind === "force_miss" ||
            (does.kind === "strike_back" && Boolean(hit.attackerId))
          : (does.kind === "reduce" && does.who !== "self" && typed(does.types)) ||
            does.kind === "take_for_ally" ||
            (does.kind === "resist_instance" && typed(does.types));
      if (!answers) continue;
      const rules = reactionRules(t, does);
      if (!rules) continue;
      out.push({ name: reaction.name, rules, target: does.kind === "strike_back" ? "enemy" : whose === "ally" ? "ally" : "none" });
    }
  }
  return out;
}

// The ally or attacker a reaction card is aimed at, fixed by the hit it
// answers rather than picked.
export function reactionAim(
  card: HandCard,
  hits: PublicLastHit[],
  sheetId: string,
  party: Array<Pick<CharacterSheet, "id" | "name">>,
): { id: string; name: string; kind: "enemy" | "ally" } | null {
  // The card's own id, without the hero another character's card names
  // (offTurnReactionCards); that hero is `sheetId` here.
  const id = card.id.split("@")[0];
  // Commander's Strike's target is the player's pick.
  if (card.target === "enemy" && id === "reaction:commanders-strike") {
    return null;
  }
  if (card.target === "enemy") {
    const mine = hits.find((hit) => hit.characterId === sheetId && hit.attackerId);
    return mine?.attackerId ? { id: mine.attackerId, name: mine.attacker, kind: "enemy" } : null;
  }
  if (card.target === "ally") {
    const allyId = id.split(":").pop() ?? "";
    const ally = party.find((entry) => entry.id === allyId);
    return ally ? { id: ally.id, name: ally.name, kind: "ally" } : null;
  }
  return null;
}
