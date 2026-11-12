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
import type { PublicLastHit, PublicSave } from "@/lib/db/encounter-view";
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
import { freeUseOf, spellNames } from "@/lib/battlemap/hand-spells";
import { dealtByTrigger, triggerCards } from "@/lib/battlemap/hand-react-triggers";
import { ringBarrierGate, ringCardName, ringSpells } from "@/lib/battlemap/hand-ring";
import { COMMANDED, wieldsMeleeOrShield } from "@/lib/dm/maneuver-rules";
import { HIT_ANSWER_COUNTERS, reachAtLevel, reactionTimingOf, timingOfDoes } from "@/lib/dm/reaction-kinds";
import { LUCK_POINTS, resourceDef } from "@/lib/srd/class-resources";
import type { ToolError } from "@/lib/dm/tool-errors";
import { findNamed, textKey } from "@/lib/language/text-logic";
import { vowedFoe } from "@/lib/srd/vow-of-enmity";
import { holdsFeature, isConditionNamed, isNamed } from "@/lib/srd/feature-names";
import { translate } from "@/lib/messages-logic";

// Like composerGate, the card's own words (prompts, rules, refusal reasons;
// table.hand.react.*) are read with the translator of the component that
// draws the hand, so a language switch rewords them with everything else.
// Pure otherwise: the ids, the gates and the intents are untouched.
type Translator = (key: string, vars?: Record<string, string | number>) => string;
const enT: Translator = (key, vars) => translate("en", key, vars);

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
    // A card aimed at someone else is not "Self": each names its reach, or none.
    range: target === "none" ? t("table.hand.react.selfRange") : "",
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

// Shield's prompt over every hit it covers: the first in full, the rest by
// who made them and what they dealt.
function whatAll(t: Translator, covered: PublicLastHit[], whom: string): string {
  const [first, ...rest] = covered;
  const then = rest.map((hit) => `${t("table.hand.react.attackOf", { attacker: hit.attacker, attack: hit.attack })}${hit.damage ? t("table.hand.react.damageTail", { damage: hit.damage }) : ""}`);
  return `${what(t, first, whom)}${then.length ? t("table.hand.react.thenList", { list: then.join(t("table.hand.join.and")) }) : ""}`;
}

// What a reaction card carries of the hit it answers: the hit itself, for
// its aim (reactionAim), and its id, which the card sends as use_reaction's
// `hit` so the engine answers that hit and no other (issue 685).
function answering(hit: PublicLastHit): Partial<HandCard> {
  return { answers: { characterId: hit.characterId, ...(hit.id ? { hitId: hit.id } : {}), attackerId: hit.attackerId, attacker: hit.attacker } };
}

function aimedIntent<T extends HandCard["intent"]>(intent: T, hit: PublicLastHit): T {
  return hit.id && intent.card === "reaction" ? { ...intent, hit: hit.id } : intent;
}

// A reaction spell the sheet holds, gated as the cast guard gates it.
function spellReaction(
  t: Translator,
  sheet: CharacterSheet,
  turn: HandTurn,
  spell: string,
  prompt: string,
  rules: string | ((level: number) => string),
  target: HandTarget,
  hit: PublicLastHit,
  idTail = "",
): HandCard | null {
  if (!spellNames(sheet).some((name) => textKey(name) === textKey(spell))) return null;
  const facts = bundledSpellFacts(spell);
  // A race's free use (a tiefling's Infernal Legacy) answers without a slot
  // while it is left, at the level the trait casts it (issue #833): the card
  // once asked every tiefling fighter for a slot, and sent a tiefling
  // warlock's slot level so the cast spent the slot and kept the free use.
  const free = freeUseOf(sheet, spell, facts, t);
  const slot = free?.free ? null : lowestSlot(sheet, facts?.level ?? 1);
  const level = (free?.free ? free.castAt : slot?.level) ?? facts?.level ?? 1;
  const card = base(
    t,
    `${textKey(spell).replace(/\s+/g, "-")}${idTail}`,
    spell,
    prompt,
    target,
    aimedIntent({ card: "reaction", feature: spell, spell, slotLevel: slot?.level ?? null }, hit),
    { type: "spell", rules: typeof rules === "function" ? rules(level) : rules, resource: free?.free ? free.line : slot ? slotLine(slot, t) : t("table.hand.react.noSlots"), icon: { kind: "spell", key: spell, family: null }, ...(target !== "none" && facts?.range.kind === "feet" ? { range: reachLabel(facts.range.feet, t) } : {}), ...answering(hit) },
  );
  const problem = (refusal: ToolError | null): Gate => (refusal ? { reason: refusal.error, spent: false } : null);
  const fallen = droppedByThisHit(sheet, hit) && reactionTimingOf(spell) === "answers";
  return gated(
    card,
    fallen ? stoodGate(sheet, turn, hit, t) : standingGate(sheet, turn, "reaction", t),
    problem(casterStateProblem(sheet)),
    problem(componentProblem(sheet, facts) ?? focusProblem(sheet, facts)),
    free?.free || slot ? null : { reason: free?.spent ?? t("table.hand.react.noSlotFor", { name: sheet.name, spell }), spent: true },
    costGate("reaction", turn, fallen ? asTheyStood(sheet, hit) : sheet, spell, t),
  );
}

// The same spell out of a Ring of Spell Storing the character holds it in: no slot
// and no components, so only the ring and the reaction itself can stop it. Beside
// the caster's own card of the spell when they have both: which pays is theirs to
// choose. The name is the one the fan's grey card goes by, which this replaces
// (withReactions).
function ringReactions(
  t: Translator,
  sheet: CharacterSheet,
  turn: HandTurn,
  spell: string,
  prompt: string,
  rules: string | ((level: number) => string),
  target: HandTarget,
  hit: PublicLastHit,
  idTail = "",
): HandCard[] {
  const fallen = droppedByThisHit(sheet, hit) && reactionTimingOf(spell) === "answers";
  const facts = bundledSpellFacts(spell);
  const slug = (name: string) => textKey(name).replace(/\s+/g, "-");
  return ringSpells(sheet)
    .filter(({ entry }) => findNamed([entry], spell, (held) => [held.spell]))
    .map(({ ring, ring: { name: item }, entry }) =>
      gated(
        base(
          t,
          `ring:${slug(item)}:${slug(spell)}${idTail}`,
          ringCardName(spell),
          prompt,
          target,
          aimedIntent({ card: "reaction", feature: spell, spell, slotLevel: entry.level, item }, hit),
          {
            type: "spell",
            rules: typeof rules === "function" ? rules(entry.level) : rules,
            resource: t("table.hand.spell.levelN", { level: entry.level }),
            icon: { kind: "spell", key: spell, family: null },
            ...(target !== "none" && facts?.range.kind === "feet" ? { range: reachLabel(facts.range.feet, t) } : {}),
            ...answering(hit),
          },
        ),
        ringBarrierGate(sheet, ring),
        fallen ? stoodGate(sheet, turn, hit, t) : standingGate(sheet, turn, "reaction", t),
        costGate("reaction", turn, fallen ? asTheyStood(sheet, hit) : sheet, spell, t),
      ),
    );
}

// The reactions the player's other characters may take now (a person playing
// several heroes, src/lib/player-characters.ts offTurnReactors, and the
// companions they play, companionReactors): the hit hero is seldom the one
// acting, and the Hand follows the one acting. Each card names its hero and
// carries them as its actor, and its id is the hero's own, so it never
// stands in for the acting hero's card of the same name.
export function offTurnReactionCards(
  ...args:
    | [t: Translator, heroes: Array<{ sheet: CharacterSheet; turn: HandTurn }>, hits: PublicLastHit[], party: Array<Pick<CharacterSheet, "id" | "name">>, saves?: PublicSave[]]
    // Upstream's suites call the plain form without a translator.
    | [heroes: Array<{ sheet: CharacterSheet; turn: HandTurn }>, hits: PublicLastHit[], party: Array<Pick<CharacterSheet, "id" | "name">>, saves?: PublicSave[]]
): HandCard[] {
  // Both call shapes: the components pass the translator first, the plain
  // form reads the dictionary's English.
  const withT = typeof args[0] === "function";
  const t = (withT ? args[0] : enT) as Translator;
  const [heroes, hits, party, saves] = (withT ? args.slice(1) : args) as [
    Array<{ sheet: CharacterSheet; turn: HandTurn }>,
    PublicLastHit[],
    Array<Pick<CharacterSheet, "id" | "name">>,
    PublicSave[]?,
  ];
  return heroes.flatMap(({ sheet, turn }) =>
    reactionCards(t, sheet, turn, hits, party, sheet.name, undefined, saves ?? []).map((card) => ({
      ...card,
      id: `${card.id}@${sheet.id}`,
      actor: { id: sheet.id, name: sheet.name },
    })),
  );
}

// The reaction strips over the fan (HandReactPrompt), one per hit answered:
// the hero's own first, then each other hero's. A strip reads its first
// card's prompt, so two hits on one hero kept in one strip showed two like
// Uncanny Dodge chips under the first hit's words, and nothing said which
// chip answered which blow. Shield, which covers every hit after the one it
// answers, sits with that first hit, whose prompt names them all. Cards that
// name no hit (one hit open, or a host that keeps no ids) keep one strip per
// hero, as before.
export function reactionStrips(own: HandCard[], others: HandCard[]): HandCard[][] {
  const strips = new Map<string, HandCard[]>();
  for (const card of [...own, ...others]) {
    const key = `${card.actor?.id ?? ""}|${card.answers?.hitId ?? ""}`;
    strips.set(key, [...(strips.get(key) ?? []), card]);
  }
  return [...strips.values()];
}

// A reaction sent for a hero and not yet resolved holds that hero's reaction
// cards, the strip's chips with the fan's (issue 685). At a table a person
// runs a card or a typed reaction waits for the GM, and nothing in the
// engine's count moves until then: Shield's chip stayed live after it was
// played, and another hero's card or words could be sent twice. The session
// keeps who was sent for (SessionView.tsx) until the encounter's reactions,
// round or turn move; then the engine's own count decides.
export function holdSentReactions(cards: HandCard[], sent: readonly string[], selfId: string, t: Translator = enT): HandCard[] {
  if (!sent.length) return cards;
  return cards.map((card) =>
    card.cost === "reaction" && !card.disabled && sent.includes(card.actor?.id ?? selfId)
      ? { ...card, disabled: t("table.hand.pending.sent", { name: card.actor ? t("table.hand.react.actorReaction", { name: card.actor.name }) : t("table.hand.react.yourReaction") }), spent: false }
      : card,
  );
}

// Every reaction card the moment offers, the character's own hits first.
// `self` is how the prompt names the character hit: "you" in their own hand
// (table.hand.react.you), their name in another hero's.
// With several hits open on one character (two enemies in one pass, issue
// 685) each card answers one of them, named in its prompt; Shield is offered
// once, against the earliest, since its +5 covers every hit after it too.
export function reactionCards(
  ...args:
    | [t: Translator, sheet: CharacterSheet, turn: HandTurn, hits: PublicLastHit[], party: Array<Pick<CharacterSheet, "id" | "name">>, self?: string, feet?: Record<string, number>, saves?: PublicSave[], foes?: Array<{ id: string }>, unseen?: Unseen]
    // Upstream's suites call the plain form without a translator.
    | [sheet: CharacterSheet, turn: HandTurn, hits: PublicLastHit[], party: Array<Pick<CharacterSheet, "id" | "name">>, self?: string, feet?: Record<string, number>, saves?: PublicSave[], foes?: Array<{ id: string }>, unseen?: Unseen]
): HandCard[] {
  // Both call shapes: the components pass the translator first (t-first, the
  // agoLabel pattern), the plain form reads the dictionary's English.
  const withT = typeof args[0] === "function";
  const t = (withT ? args[0] : enT) as Translator;
  const [sheet, turn, hits, party, selfWord, feet, saves, foes, unseen] = (withT ? args.slice(1) : args) as [
    CharacterSheet,
    HandTurn,
    PublicLastHit[],
    Array<Pick<CharacterSheet, "id" | "name">>,
    string?,
    Record<string, number>?,
    PublicSave[]?,
    Array<{ id: string }>?,
    Unseen?,
  ];
  const self = selfWord ?? t("table.hand.react.you");
  const saveList = saves ?? [];
  // A creature the board does not show this character at all (fog, out of
  // sight) is as unseen as one behind a wall; with no board, nothing is.
  let unseenMap = unseen;
  if (unseenMap && feet) {
    const walled = unseenMap;
    unseenMap = { has: (id: string) => walled.has(id) || !(id in feet) };
  }
  const cards: HandCard[] = [];
  // By this holder, or by anyone on a key that names no holder (an older
  // record, or a host that sends names only).
  const answered = (hit: PublicLastHit, name: string) =>
    (hit.answeredBy ?? hit.answered).some((entry) => textKey(entry) === textKey(name) || entry === `${textKey(name)}@${sheet.id}`);
  // A hit among several on its character tags its cards' ids; one hit keeps
  // the ids it always had.
  const tail = (hit: PublicLastHit) =>
    hit.id && hits.filter((other) => other.characterId === hit.characterId).length > 1 ? `~${hit.id}` : "";
  // `fallen`: the card answers the hit itself, so a holder that hit dropped
  // is asked as they stood before it. Left out, the engine's table says, by the
  // card's name (reaction-kinds.ts). `gate`: a refusal of the card's own.
  const feature = (
    hit: PublicLastHit,
    name: string,
    prompt: string,
    rules: string,
    target: HandTarget = "none",
    more: { icon?: HandCard["icon"]; fallen?: boolean; gate?: Gate; range?: string; pickWithin?: number; choice?: HandCard["choice"] } = {},
  ) => {
    if (answered(hit, name)) return;
    const card = base(
      t,
      `${textKey(name).replace(/\s+/g, "-")}:${hit.characterId}${tail(hit)}`,
      name,
      prompt,
      target,
      aimedIntent({ card: "reaction", feature: name }, hit),
      { rules, ...(more.icon ? { icon: more.icon } : {}), ...(more.range ? { range: more.range } : {}), ...(more.pickWithin ? { pickWithin: more.pickWithin } : {}), ...(more.choice ? { choice: more.choice } : {}), ...answering(hit) },
    );
    const fallen = more.fallen ?? (droppedByThisHit(sheet, hit) && reactionTimingOf(name) === "answers");
    cards.push(
      gated(
        card,
        fallen ? stoodGate(sheet, turn, hit, t) : standingGate(sheet, turn, "reaction", t),
        more.gate ?? null,
        costGate("reaction", turn, fallen ? asTheyStood(sheet, hit) : sheet, name, t),
      ),
    );
  };
  const counterLeft = (id: string) => {
    const state = sheet.resources[id];
    return Boolean(state) && state.max > state.used;
  };
  const rulesOf = (guidance: string) => guidance.split(". ")[0].replace(/\.?$/, ".");

  const mine = hits.filter((hit) => hit.characterId === sheet.id && hit.hit);
  // Shield answers an attack, and a Magic Missile aimed at them.
  const shieldable = mine.filter((hit) => (hit.source === "attack" || hit.source === "missile") && !answered(hit, "Shield"));
  if (shieldable.length) {
    const shield = spellReaction(
      t,
      sheet,
      turn,
      "Shield",
      whatAll(t, shieldable, self),
      shieldable.length > 1 ? t("table.hand.react.shieldMany") : t("table.hand.react.shield"),
      "none",
      shieldable[0],
    );
    if (shield) cards.push(shield);
    cards.push(
      ...ringReactions(
        t,
        sheet,
        turn,
        "Shield",
        whatAll(t, shieldable, self),
        shieldable.length > 1 ? t("table.hand.react.shieldMany") : t("table.hand.react.shield"),
        "none",
        shieldable[0],
      ),
    );
  }
  for (const hit of mine) {
    const prompt = what(t, hit, self);
    if (hit.source === "attack") {
      if (holdsFeature(sheet, "uncanny dodge") && !hidden(unseenMap, hit.attackerId)) {
        feature(hit, "Uncanny Dodge", prompt, t("table.hand.react.uncanny"));
      }
      if (hit.ranged && holdsFeature(sheet, "deflect missiles")) {
        feature(hit, "Deflect Missiles", prompt, t("table.hand.react.deflect"));
      }
      // Lucky (src/lib/dm/feat-reactions.ts lucky): a luck point and no
      // reaction, so the card stays open once the reaction is spent.
      if (counterLeft(LUCK_POINTS) && !answered(hit, "Lucky")) {
        cards.push({
          ...base(t, `lucky:${hit.characterId}${tail(hit)}`, "Lucky", prompt, "none", aimedIntent({ card: "reaction", feature: "Lucky" }, hit), {
            rules: t("table.hand.react.lucky"),
            ...answering(hit),
          }),
          cost: "free",
        });
      }
      if (hit.attackerId && !answered(hit, "Hellish Rebuke")) {
        const rebuke = spellReaction(t, sheet, turn, "Hellish Rebuke", prompt, (level) => t("table.hand.react.rebukeDice", { attacker: hit.attacker, dice: `${level + 1}d10` }), "enemy", hit, tail(hit));
        if (rebuke) cards.push(rebuke);
        cards.push(...ringReactions(t, sheet, turn, "Hellish Rebuke", prompt, (level) => t("table.hand.react.rebukeDice", { attacker: hit.attacker, dice: `${level + 1}d10` }), "enemy", hit, tail(hit)));
      }
    }
    if (hit.source === "fall" && holdsFeature(sheet, "slow fall")) {
      feature(hit, "Slow Fall", prompt, t("table.hand.react.slowFall"));
    }
    if (hit.source === "fall" && !answered(hit, "Feather Fall")) {
      // The caster's own Feather Fall too: its card in the Hand waits for this.
      const fall = spellReaction(t, sheet, turn, "Feather Fall", prompt, t("table.hand.react.featherFall"), "none", hit, tail(hit));
      if (fall) cards.push(fall);
      cards.push(...ringReactions(t, sheet, turn, "Feather Fall", prompt, t("table.hand.react.featherFall"), "none", hit, tail(hit)));
    }
    if (hit.source === "attack") {
      for (const held of subclassReactions(t, sheet, hit, "self", feet, unseenMap)) {
        // A redirect needs someone else beside the holder to take the blow. With
        // no foes or distances given, it is open and the engine judges.
        const beside = !held.pickWithin || !foes || !feet || pickableFoes(foes, held.pickWithin, { characterId: hit.characterId, attackerId: hit.attackerId, attacker: hit.attacker }, feet).length > 0;
        feature(hit, held.name, prompt, held.rules, held.target, {
          fallen: held.fallen && sheet.currentHp <= 0,
          range: held.range,
          pickWithin: held.pickWithin,
          ...(held.choice ? { choice: held.choice } : {}),
          gate: beside ? null : { reason: t("table.hand.react.noOneBeside", { feet: held.pickWithin ?? 0, name: sheet.name }), spent: false },
        });
      }
    }
  }

  // Soul of Vengeance answers the vowed creature's attack, hit or miss, whoever
  // it was aimed at.
  const vowed = vowedFoe(sheet);
  if (vowed && holdsFeature(sheet, "soul of vengeance")) {
    for (const hit of hits.filter((entry) => entry.source === "attack" && entry.attackerId === vowed && inReach(feet, entry.attackerId, SOUL_OF_VENGEANCE_FT))) {
      feature(hit, "Soul of Vengeance", t("table.hand.react.vowPrompt", { attacker: hit.attacker }), t("table.hand.react.soulRules"), "enemy", { range: reachLabel(SOUL_OF_VENGEANCE_FT, t) });
    }
  }

  // Vigilant Rebuke: a success by the character or one within its reach,
  // and the creature that forced the save takes the damage.
  for (const held of saveAnswers(sheet, t)) {
    for (const save of saveList.filter(madeMentalSave)) {
      const saver = save.characterId === sheet.id ? self : party.find((entry) => entry.id === save.characterId)?.name;
      if (!saver || (save.characterId !== sheet.id && !inReach(feet, save.characterId, held.rangeFt))) continue;
      const id = `${textKey(held.name).replace(/\s+/g, "-")}:${save.id}`;
      const card = base(
        t,
        id,
        held.name,
        save.characterId === sheet.id && self === "you"
          ? t("table.hand.react.savePromptYou", { ability: save.ability.toUpperCase(), forcer: save.forcer })
          : t("table.hand.react.savePrompt", { saver, ability: save.ability.toUpperCase(), forcer: save.forcer }),
        "enemy",
        { card: "reaction", feature: held.name },
        {
          rules: held.rules,
          range: reachLabel(held.rangeFt, t),
          answers: { characterId: save.characterId, attackerId: save.forcerId, attacker: save.forcer },
        },
      );
      cards.push(gated(card, standingGate(sheet, turn, "reaction", t), costGate("reaction", turn, sheet, held.name, t)));
    }
  }

  for (const counter of HIT_ANSWER_COUNTERS) {
    const def = resourceDef(counter.id);
    if (!def || !counterLeft(counter.id)) continue;
    if (counter.whileHolding && !sheet.conditions.some((entry) => textKey(entry) === counter.whileHolding)) continue;
    if (counter.atZero && sheet.currentHp > 0) continue;
    const dropped = sheet.currentHp <= 0;
    if (dropped && sheet.deathSaves?.dead) continue;
    // Warding Maneuver's melee weapon or shield, as the engine asks it.
    const gate: Gate = counter.armed && !wieldsMeleeOrShield(sheet)
      ? { reason: t("table.hand.react.needsWield", { feature: def.displayName, name: sheet.name }), spent: false }
      : null;
    for (const hit of mine) {
      if (counter.attackOnly && hit.source !== "attack") continue;
      // Taken as the hit that drops them lands: one that found them down
      // already is not it (reaction-counters.ts droppedByFreshHit).
      if (counter.atZero && hit.stood && !hit.stood.up) continue;
      feature(hit, def.displayName, what(t, hit, self), rulesOf(def.guidance), "none", { fallen: dropped && (counter.atZero || counter.answersDrop), gate });
    }
    if (counter.ally) {
      for (const hit of hits) {
        const ally = party.find((entry) => entry.id === hit.characterId);
        if (ally && ally.id !== sheet.id && hit.hit && hit.source === "attack" && inReach(feet, hit.characterId, counter.rangeFt) && !hidden(unseenMap, hit.characterId)) {
          feature(hit, def.displayName, what(t, hit, ally.name), rulesOf(def.guidance), "ally", { gate, range: reachLabel(counter.rangeFt, t) });
        }
      }
    }
  }

  // The Battle Master's reactions (src/lib/dm/maneuver-reactions.ts): Parry
  // against a melee hit, Riposte against a melee miss, each a die.
  const knows = (name: string) => sheet.features.some((entry) => /^maneuver:/i.test(entry.name) && isNamed(entry.name, name));
  const dice = sheet.resources.sub_superiority_dice;
  if (dice && dice.max > dice.used) {
    for (const hit of mine) {
      if (hit.source === "attack" && !hit.ranged && knows("parry")) {
        feature(hit, "Parry", what(t, hit, self), t("table.hand.react.parry"), "none", { icon: MANEUVER_ICON("Parry") });
      }
    }
    if (knows("riposte")) {
      for (const missed of hits.filter((hit) => hit.characterId === sheet.id && !hit.hit && hit.source === "attack" && !hit.ranged && hit.attackerId)) {
        feature(missed, "Riposte", t("table.hand.react.missed", { attacker: missed.attacker, attack: missed.attack, whom: self }), t("table.hand.react.riposte"), "enemy", { icon: MANEUVER_ICON("Riposte"), range: t("table.hand.react.rangeMelee") });
      }
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
    const ally = party.find((entry) => entry.id === hit.characterId);
    if (!ally) continue;
    const prompt = what(t, hit, ally.name);
    for (const held of allyReactions(sheet, hit, feet, unseenMap, t)) {
      feature(hit, held.name, prompt, held.rules, "ally", { range: held.range });
    }
  }
  // Hellish Rebuke after a creature's spell damaged them through a save: no hit
  // record holds it, the save does (src/lib/dm/last-save.ts noteSaveDamage).
  for (const save of saveList.filter((entry) => (entry.kind ?? "save") === "save" && entry.characterId === sheet.id && (entry.damage?.amount ?? 0) > 0 && entry.forcerId)) {
    const hurt: PublicLastHit = { characterId: sheet.id, attacker: save.forcer, attackerId: save.forcerId, attack: save.spell ?? "spell", type: save.damage?.type ?? "", ranged: true, source: "attack", hit: true, hits: 1, damage: save.damage?.amount ?? 0, answered: save.answered ?? [] };
    if (cards.some((entry) => entry.name === "Hellish Rebuke" && entry.answers?.attackerId === save.forcerId)) continue;
    const prompt = t("table.hand.react.saveHurt", { forcer: save.forcer, spell: save.spell ?? t("table.hand.spell.spellWord"), whom: self, damage: hurt.damage, type: hurt.type ? ` ${hurt.type}` : "" });
    const rebuke = spellReaction(t, sheet, turn, "Hellish Rebuke", prompt, (level) => t("table.hand.react.rebukeDice", { attacker: save.forcer, dice: `${level + 1}d10` }), "enemy", hurt, `~${save.id}`);
    if (rebuke) cards.push(rebuke);
  }
  // The reactions and triggered uses whose trigger is not a hit: a death, a
  // turn's end, a save forced, damage, a cast (hand-react-triggers.ts).
  cards.push(...triggerCards(sheet, turn, hits, saveList, (id, reach) => inReach(feet, id, reach), unseenMap));
  return cards;
}

// A save made against a creature on Intelligence, Wisdom or Charisma, the one
// Vigilant Rebuke answers. The view sends failures and other triggers too.
function madeMentalSave(save: PublicSave): boolean {
  return (save.kind ?? "save") === "save" && save.success !== false && ["int", "wis", "cha"].includes(save.ability);
}

// A card answered as the holder stood when the hit landed, as the engine asks
// it (src/lib/dm/reaction-gate.ts reactingSheet): open to one that very hit
// dropped, and shut to one stunned or down before it. An older host sends no
// standing, and the card is open as before.
function droppedByThisHit(sheet: CharacterSheet, hit: PublicLastHit): boolean {
  return hit.characterId === sheet.id && sheet.currentHp <= 0;
}

// The conditions that switch reactions off (slowed) are read as they stood
// too, as the engine reads them (reaction-gate.ts reactionRefusal).
function asTheyStood(sheet: CharacterSheet, hit: PublicLastHit): CharacterSheet {
  return hit.stood ? { ...sheet, conditions: hit.stood.conditions } : sheet;
}

function stoodGate(sheet: CharacterSheet, turn: HandTurn, hit: PublicLastHit, t: Translator): Gate {
  if (!hit.stood) return null;
  if (!hit.stood.up) return standingGate(sheet, turn, "reaction", t);
  return standingGate({ ...sheet, currentHp: Math.max(1, sheet.currentHp), conditions: hit.stood.conditions, deathSaves: null }, turn, "reaction", t);
}


// The reactions the character holds that answer a hit on an ally: Cutting
// Words with a die left, Protection, and the subclass reactions for an ally.
// The cards above offer these, and the actions route takes words typed as a
// reaction for an ally's hit only when one of them covers it (that call reads
// the length alone, so its translator rides last, English by default).
export function allyReactions(sheet: CharacterSheet, hit: PublicLastHit, feet?: Record<string, number>, unseen?: Unseen, t: Translator = enT): Array<{ name: string; rules: string; range: string }> {
  if (hit.characterId === sheet.id || !hit.hit || hit.source !== "attack") return [];
  // Cutting Words and Protection: "a creature (that) you can see" attacks.
  const attackerSeen = !hidden(unseen, hit.attackerId);
  const bardic = sheet.resources.bardic_inspiration;
  return [
    ...(holdsFeature(sheet, "cutting words") && attackerSeen && (bardic?.max ?? 0) > (bardic?.used ?? 0)
      ? [{ name: "Cutting Words", rules: t("table.hand.react.cuttingWords"), range: reachLabel(60, t) }]
      : []),
    // Protection: "a target other than you that is within 5 feet of you".
    ...(holdsFeature(sheet, "protection") && attackerSeen && inReach(feet, hit.characterId, 5) ? [{ name: "Protection", rules: t("table.hand.react.protection"), range: reachLabel(5, t) }] : []),
    ...subclassReactions(t, sheet, hit, "ally", feet, unseen).map((held) => ({ name: held.name, rules: held.rules, range: held.range })),
  ];
}

// The reaction cards the moment offers, then the hand without the cards they
// answer for: a prepared Shield sits in the hand as a spell card, and while
// the prompt offers Shield against the hit it is one choice, shown once.
export function withReactions(reactions: HandCard[], hand: HandCard[]): HandCard[] {
  if (!reactions.length) return hand;
  const offered = new Set(reactions.map((card) => textKey(card.name)));
  return [...reactions, ...hand.filter((card) => !(card.cost === "reaction" && offered.has(textKey(card.name))))];
}

// Misdirection's creature stands this near the holder (redirect-target.ts).
const REDIRECT_FT = 5;

// Soul of Vengeance's melee attack (authored-effects-data2.ts): the vowed
// creature within this reach.
const SOUL_OF_VENGEANCE_FT = 5;

// The creatures the character has no line of sight to on the board.
type Unseen = { has(id: string): boolean };

// Whether the board says the character cannot see the creature `id`.
function hidden(unseen: Unseen | undefined, id: string | null | undefined): boolean {
  return Boolean(id && unseen?.has(id));
}

// Whether the creature `id` stands within `reach` feet, as far as the board
// says: with no distance known, the engine judges it.
function inReach(feet: Record<string, number> | undefined, id: string | null | undefined, reach: number | undefined): boolean {
  const apart = id ? feet?.[id] : undefined;
  return apart === undefined || reach === undefined || apart <= reach;
}

// A reach that grows with the holder's level (Aura of the Guardian's 10
// feet, then 30), as the engine reads it (reaction-kinds.ts reachAtLevel).
// A reach as a card prints it; no reach on record prints none.
function reachLabel(ft: number | undefined, t: Translator): string {
  return ft === undefined ? "" : t("table.hand.range.feet", { feet: ft });
}

function reachAt(range: number | Array<[number, number]> | undefined, level: number): number | undefined {
  return range === undefined ? undefined : reachAtLevel(range, level);
}

// The reactions the character holds that answer a save (Vigilant Rebuke),
// with their reach and their line.
function saveAnswers(sheet: CharacterSheet, t: Translator): Array<{ name: string; rangeFt: number | undefined; rules: string }> {
  const out: Array<{ name: string; rangeFt: number | undefined; rules: string }> = [];
  for (const held of heldAuthored(sheet)) {
    for (const reaction of held.entry.reactions ?? []) {
      const does = reaction.does;
      if (does.kind !== "strike_back" || !does.afterSave || (reaction.usedBy ?? "holder") !== "holder" || !gateHolds(reaction.gate, sheet, held)) continue;
      out.push({ name: reaction.name, rangeFt: does.rangeFt, rules: t("table.hand.react.strikeBackSave", { type: does.type }) });
    }
  }
  return out;
}

// What a subclass reaction does, in a line for its card.
function reactionRules(t: Translator, does: ReactionDoes, hit: PublicLastHit): string {
  switch (does.kind) {
    case "uncrit":
      return hit.crit ? t("table.hand.react.uncrit", { attack: hit.crit.attack, damage: hit.crit.damage }) : "";
    case "reduce":
      return t(does.amount === "half" ? "table.hand.react.reduceHalf" : "table.hand.react.reduce");
    case "ac_vs_hit":
      return does.strikeOnMiss ? t("table.hand.react.acVsHitStrike") : t("table.hand.react.acVsHit");
    case "disadv_vs_hit":
      return t("table.hand.react.disadvVsHit");
    case "reroll_hit":
      return t("table.hand.react.rerollHit");
    case "resist_instance":
      return t("table.hand.react.resist");
    case "take_for_ally":
      return t("table.hand.react.takeForAlly");
    case "echo_hit":
      return t("table.hand.react.echoHit", { type: does.type });
    case "strike_back":
      return does.orType ? t("table.hand.react.strikeBackOr", { type: does.type, orType: does.orType }) : t("table.hand.react.strikeBack", { type: does.type });
    case "redirect":
      return does.save ? t("table.hand.react.redirectSave") : t("table.hand.react.redirectCover");
    case "force_miss":
      return does.exhaustion
        ? t("table.hand.react.forceMiss", { count: does.exhaustion })
        : t("table.hand.react.forceMissNone");
    case "echo_takes_hit":
      return t("table.hand.react.echoTakesHit");
    case "chance_miss":
      return t("table.hand.react.chanceMiss", { die: does.die, min: does.min });
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
  feet?: Record<string, number>,
  unseen?: Unseen,
): Array<{ name: string; rules: string; target: HandTarget; range: string; fallen?: boolean; pickWithin?: number; choice?: HandCard["choice"] }> {
  const out: Array<{ name: string; rules: string; target: HandTarget; range: string; fallen?: boolean; pickWithin?: number; choice?: HandCard["choice"] }> = [];
  for (const held of heldAuthored(sheet)) {
    for (const reaction of held.entry.reactions ?? []) {
      if ((reaction.usedBy ?? "holder") !== "holder" || !gateHolds(reaction.gate, sheet, held)) continue;
      // One whose trigger is not this hit is dealt when its own comes
      // (hand-react-triggers.ts): Halo of Spores answers a creature starting its
      // turn near, and its card on a hit was refused.
      if (dealtByTrigger(reaction.name, reaction.gate?.condition)) continue;
      // "A creature you can see", as the engine asks it (authored-reactions.ts).
      if (reaction.sees === "target" && whose === "ally" && hidden(unseen, hit.characterId)) continue;
      if (reaction.sees === "attacker" && hidden(unseen, hit.attackerId)) continue;
      const pool = reaction.pool;
      if (pool && "id" in pool) {
        const state = sheet.resources[pool.id];
        if (!state || state.max - state.used < (pool.amount ?? 1)) continue;
      }
      const does = reaction.does;
      const typed = (types?: string[]) => !types?.length || types.includes(hit.type);
      if (does.kind === "resist_instance" && does.bond && !(sheet.pets ?? []).some((pet) => pet.kind === does.bond && pet.hp > 0)) continue;
      const answers =
        whose === "self"
          ? (does.kind === "reduce" && does.who !== "ally" && typed(does.types)) ||
            does.kind === "ac_vs_hit" ||
            does.kind === "disadv_vs_hit" ||
            (does.kind === "resist_instance" && typed(does.types)) ||
            does.kind === "redirect" ||
            does.kind === "force_miss" ||
            does.kind === "uncrit" ||
            (does.kind === "reroll_hit" && Boolean(does.roller)) ||
            (does.kind === "chance_miss" && (!does.vsMark || markedBy(sheet, does.vsMark, hit.attackerId))) ||
            (does.kind === "strike_back" && !does.afterSave && Boolean(hit.attackerId) && !(does.melee && hit.ranged))
          : (does.kind === "reduce" && does.who !== "self" && typed(does.types)) ||
            does.kind === "take_for_ally" ||
            does.kind === "uncrit" ||
            does.kind === "reroll_hit" ||
            (does.kind === "ac_vs_hit" && Boolean(does.rangeFt)) ||
            (does.kind === "echo_hit" && Boolean(hit.attackerId)) ||
            (does.kind === "disadv_vs_hit" && Boolean(does.allyWith) && holdsFeature(sheet, does.allyWith!)) ||
            does.kind === "echo_takes_hit" ||
            (does.kind === "resist_instance" && !does.bond && typed(does.types));
      if (!answers) continue;
      // Within its reach: the ally it covers, or for Rebuke the Violent the
      // attacker ("an attacker within 30 feet of you"). Chronal Shift's reach
      // is to the attacker whoever it hit, the holder too.
      const reach = "rangeFt" in does ? reachAt(does.rangeFt as number | Array<[number, number]> | undefined, held.level) : undefined;
      const toRoller = does.kind === "reroll_hit" && Boolean(does.roller);
      if (whose === "ally" || toRoller) {
        if (!inReach(feet, does.kind === "echo_hit" || toRoller ? hit.attackerId : hit.characterId, reach)) continue;
      }
      // A strike back with a reach reaches the attacker, as the engine measures it
      // (authored-reactions.ts strike_back): a card for one 25 feet off was refused.
      if (does.kind === "strike_back" && !inReach(feet, hit.attackerId, reach)) continue;
      // Instinctive Charm sways an attacker within its 30 feet.
      const charm = does.kind === "redirect" && Boolean(does.save);
      if (charm && !inReach(feet, hit.attackerId, reach)) continue;
      const rules = reactionRules(t, does, hit);
      if (!rules) continue;
      // Misdirection's player picks the creature giving cover; Instinctive
      // Charm's attacker turns on the creature closest to it, which the
      // engine finds on the board (redirect-target.ts), so its card asks
      // for nobody.
      const misdirects = does.kind === "redirect" && !charm;
      const target: HandTarget = does.kind === "strike_back" || misdirects ? "enemy" : whose === "ally" ? "ally" : "none";
      // A redirect lands on a creature beside the holder (use_reaction's 5 feet),
      // Instinctive Charm reaches the attacker, a melee strike back has no
      // reach of its own on record, and Shadow Martyr's only bar is seeing
      // the ally and the attacker.
      const range =
        misdirects
          ? reachLabel(REDIRECT_FT, t)
          : charm
            ? reachLabel(reach, t)
          : target === "none" && !toRoller
            ? t("table.hand.react.selfRange")
            : does.kind === "strike_back" && does.melee && reach === undefined
              ? t("table.hand.react.rangeMelee")
              : does.kind === "echo_takes_hit"
                ? t("table.hand.react.rangeSight")
                : reachLabel(reach, t);
      out.push({
        name: reaction.name,
        rules,
        target,
        range,
        // Asked by what it does to the hit, as the engine asks it (reaction-tools.ts).
        fallen: timingOfDoes(does) === "answers",
        ...(misdirects ? { pickWithin: REDIRECT_FT } : {}),
        // Glorious Defense: the miss "lets you attack", so the card asks. The
        // attack comes first, as most paladins take it (ruling R6).
        ...(does.kind === "ac_vs_hit" && does.strikeOnMiss
          ? { choice: { arg: "variant", label: t("table.hand.react.onMiss"), options: [{ value: "attack", label: t("table.hand.react.onMissAttack") }, { value: "no attack", label: t("table.hand.react.onMissNoAttack") }] } }
          : {}),
      });
    }
  }
  return out;
}

// Whether the holder's mark (Armor of Hexes' Hexblade's Curse) names this
// attacker, as use_reaction asks it (authored-reactions.ts chance_miss).
function markedBy(sheet: CharacterSheet, mark: string, attackerId: string | null | undefined): boolean {
  const held = sheet.conditions.find((entry) => isConditionNamed(entry, mark));
  const quarry = held ? (sheet.conditionMeta as Record<string, { quarry?: string } | undefined> | undefined)?.[held]?.quarry : undefined;
  return Boolean(quarry && quarry === attackerId);
}

// The creatures a card's player may pick from: for a redirect those beside the
// holder other than the attacker, friend or foe. One the board gives no distance
// for is offered, and the engine judges it, as inReach does; so does whether it
// stands between the attacker and the holder, which the Hand cannot see.
export function reactionPicks<T extends { id: string }>(card: HandCard, foes: T[], feet?: Record<string, number>): T[] {
  return card.pickWithin === undefined ? foes : pickableFoes(foes, card.pickWithin, card.answers, feet);
}

// Neither the attacker nor the holder, whose own hit a redirect answers (the
// holder of another hero's card is a chip like any ally's).
function pickableFoes<T extends { id: string }>(foes: T[], within: number, hit: HandCard["answers"], feet?: Record<string, number>): T[] {
  return foes.filter((foe) => foe.id !== hit?.attackerId && foe.id !== hit?.characterId && !((feet?.[foe.id] ?? 0) > within));
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
  if (card.pickWithin !== undefined) {
    return null;
  }
  // Commander's Strike's target is the player's pick, and so is the creature a
  // reaction with two aims is spent on (Cauterizing Flames answers no hit, so an
  // open hit's attacker would be the wrong creature).
  if ((card.target === "enemy" && id === "reaction:commanders-strike") || (card.intent?.card === "reaction" && card.intent.variant)) {
    return null;
  }
  if (card.target === "enemy") {
    // The attacker of the hit it answers: with two enemies' hits open, the
    // first hit's attacker was the aim of every card (issue 685).
    if (card.answers) {
      return card.answers.attackerId ? { id: card.answers.attackerId, name: card.answers.attacker, kind: "enemy" } : null;
    }
    const mine = hits.find((hit) => hit.characterId === sheetId && hit.attackerId);
    return mine?.attackerId ? { id: mine.attackerId, name: mine.attacker, kind: "enemy" } : null;
  }
  if (card.target === "ally") {
    const allyId = card.answers?.characterId ?? id.split(":").pop() ?? "";
    const ally = party.find((entry) => entry.id === allyId);
    return ally ? { id: ally.id, name: ally.name, kind: "ally" } : null;
  }
  return null;
}
