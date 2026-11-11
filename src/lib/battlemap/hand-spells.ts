// Spell and class-feature cards for the Hand (docs/visual-overhaul-plan.md
// 5.2): what a prepared spell or a limited-use feature costs, rolls and
// spends, read from the same tables the cast and use_resource tools read.
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { translate, type Locale } from "@/lib/messages-logic";

type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);
import { bonusCastOf, casterStateProblem, componentProblem, focusProblem, materialPlan, slotPlan, turnCharge } from "@/lib/dm/cast-rules";
import { computeSheetDerived, spellAttackFor, spellSaveDcFor } from "@/lib/srd";
import { resourceDef, resourceLevel, type ResourceDef } from "@/lib/srd/class-resources";
import { resourceDisplayName, resourceGuidance } from "@/lib/srd/class-resources-fr";
import { psionicOptions } from "@/lib/dm/option-costs";
import { BONUS_ATTACK_COUNTERS } from "@/lib/dm/feature-bonus-attacks";
import { isMeleeSpellAttack } from "@/lib/srd/melee-spell";
import { bundledSpellFacts, type CastingTime, type SpellRange } from "@/lib/srd/spell-facts";
import { aoeSpendFor } from "@/lib/srd/aoe-spend";
import type { CombatRiders } from "@/lib/srd/feature-effects";
import { authoredSpellRow, castShares, parseSpellMech, spellMechFor, type SpellMech } from "@/lib/srd/spell-mechanics";
import { baseHealingDice, scaledSpellDice } from "@/lib/srd/spell-scaling";
import { mechSpellDamage } from "@/lib/srd/spell-dice";
import { bakedSpellMech } from "@/lib/content/baked-spells";
import { allSpellNames } from "@/lib/srd/spell-lists";
import { areaFor, blastAreaFor } from "@/lib/battlemap/hand-area";
import {
  SAVE_LABEL,
  addFlat,
  budgetOf,
  costGate,
  feet,
  gated,
  lowestSlot,
  primaryClass,
  signed,
  slotLine,
  standingGate,
  type Gate,
  type HandCard,
  type HandChoice,
  type HandCardType,
  type HandCost,
  type HandOptions,
  type HandShares,
  type HandTarget,
  type HandTurn,
  type SpellFact,
} from "@/lib/battlemap/hand-core";
import type { ToolError } from "@/lib/dm/tool-errors";
import { compareNames, textKey } from "@/lib/language/text-logic";
import { forPlayers } from "@/lib/language/player-text";

// ---- spells ----

export function spellNames(sheet: CharacterSheet): string[] {
  const casting = sheet.spellcasting;
  if (!casting) return [];
  const all = [
    ...allSpellNames(casting),
    ...(casting.casters ?? []).flatMap((caster) => allSpellNames(caster)),
  ];
  const seen = new Set<string>();
  return all.filter((name) => {
    const key = textKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// The bundled facts in the words a pack's row uses, so a table without the
// pack deals the same card the pack would (and the cast guard, which reads
// these facts, would accept).
function castingText(time: CastingTime): string {
  if (typeof time === "number") return `${time} minute${time === 1 ? "" : "s"}`;
  return time === "bonus" ? "1 bonus action" : time === "reaction" ? "1 reaction" : "1 action";
}

function rangeText(range: SpellRange): string {
  if (range.kind === "feet") return `${range.feet} feet`;
  if (range.kind === "self") return "Self";
  return range.kind === "unknown" ? "" : range.kind.replace(/^./, (c) => c.toUpperCase());
}

function factFor(name: string, options: HandOptions): SpellFact | null {
  const fetched = options.spells?.[textKey(name)];
  if (fetched) return fetched;
  // No pack: the authored rows' prose, and the bundled facts' casting time,
  // range and concentration. Every spell used to read as one action here,
  // so Shield and Counterspell were dealt as actions and Misty Step's cost
  // rested on the cast guard alone.
  const row = authoredSpellRow(name);
  const facts = bundledSpellFacts(name);
  if (!row && !facts) return null;
  return {
    level: facts?.level ?? row?.level ?? 0,
    school: "",
    castingTime: facts ? castingText(facts.castingTime) : "1 action",
    range: facts ? rangeText(facts.range) : "",
    desc: row?.desc ?? "",
    higherLevel: row?.higher_level ?? "",
    concentration: facts?.concentration ?? Boolean(row?.concentration),
  };
}

const title = (word: string) => word.replace(/^./, (c) => c.toUpperCase());

// Bestow Curse's nine curses, in the words a player picks from. The values
// sent stay the engine's own ids; the labels are keyed.
const CURSE_KEYS: Record<string, string> = {
  str: "table.hand.spell.curse.str",
  dex: "table.hand.spell.curse.dex",
  con: "table.hand.spell.curse.con",
  int: "table.hand.spell.curse.int",
  wis: "table.hand.spell.curse.wis",
  cha: "table.hand.spell.curse.cha",
  attacks: "table.hand.spell.curse.attacks",
  will: "table.hand.spell.curse.will",
  necrotic: "table.hand.spell.curse.necrotic",
};

// The one pick a spell's row asks the caster to make, as the engine names it
// (src/lib/srd/spell-mech-types.ts): a condition's variants (Blindness/
// Deafness, Eyebite, Bestow Curse), a word's choices (Command), Heat Metal
// on worn armor, the condition a restoration ends, a buff's form
// (Enlarge/Reduce). The value is what cast_at_enemy's `condition` or
// cast_buff's `variant` reads (src/lib/dm/spell-riders.ts chosenCondition).
export function spellChoice(mech: SpellMech, t: T = enT): HandChoice | undefined {
  const condition = mech.condition;
  if (condition?.variants && condition.variants.length > 1) {
    return {
      arg: "condition",
      label: t("table.hand.spell.choice.choose"),
      options: condition.variants.map((variant) => {
        const inner = /\(([^)]+)\)$/.exec(variant)?.[1];
        return inner
          ? { value: inner, label: (CURSE_KEYS[inner] ? t(CURSE_KEYS[inner]) : title(inner)) }
          : { value: variant, label: title(variant) };
      }),
    };
  }
  if (condition?.choices && Object.keys(condition.choices).length) {
    return {
      arg: "condition",
      label: t("table.hand.spell.choice.word"),
      options: Object.entries(condition.choices).map(([word, adds]) => ({ value: word, label: title(word), note: adds.join(", ") })),
    };
  }
  if (mech.riders?.gripSave) {
    return {
      arg: "condition",
      label: t("table.hand.spell.choice.metal"),
      options: [
        { value: "", label: t("table.hand.spell.choice.heldObject") },
        { value: "armor", label: t("table.hand.spell.choice.wornArmor") },
      ],
      fallback: "",
    };
  }
  if (mech.cures && !mech.cures.all && mech.cures.conditions.length > 1) {
    return {
      arg: "variant",
      label: t("table.hand.spell.choice.ends"),
      options: mech.cures.conditions.map((entry) => ({ value: entry, label: entry === "cursed" ? t("table.hand.spell.choice.curse") : title(entry) })),
    };
  }
  if (mech.buff?.variants && mech.buff.variants.length > 1) {
    return { arg: "variant", label: t("table.hand.spell.choice.choose"), options: mech.buff.variants.map((variant) => ({ value: variant, label: title(variant) })) };
  }
  return undefined;
}

function castingCost(castingTime: string): HandCost | null {
  const text = castingTime.toLowerCase();
  if (text.includes("bonus")) return "bonus";
  if (text.includes("reaction")) return "reaction";
  // Minutes and hours do not fit in a turn, so the spell stays off the hand.
  return /^1 action\b/.test(text.trim()) || text.trim() === "" ? "action" : null;
}

// How many darts, rays, beams or creatures one casting holds at this slot
// and caster level, when more than one (castShares, the count the cast
// tools hold the casting to).
function spellShares(mech: SpellMech, spellLevel: number, slotLevel: number | null, casterLevel: number): HandShares | null {
  if (!mech.darts && !mech.attacks && !mech.targets) return null;
  const count = castShares(mech, { spellLevel, slotLevel, casterLevel });
  if (count < 2) return null;
  if (mech.darts) return { count, unit: "dart", stack: true };
  if (mech.attacks) return { count, unit: mech.attacks.byCasterLevel ? "beam" : "ray", stack: true };
  return { count, unit: "creature", stack: false };
}

function spellCard(sheet: CharacterSheet, turn: HandTurn, riders: CombatRiders, name: string, fact: SpellFact, blasts = true, t: T = enT): HandCard | null {
  const cost = castingCost(fact.castingTime);
  if (!cost) return null;
  // The mechanics row the engine reads; the prose is parsed only for what the
  // card shows when no row exists (its target, its save). With no pack there
  // is no prose, and the engine reads the answers baked from the SRD rows, so
  // the card does too (Shocking Grasp stays a melee spell attack).
  // A workshop spell's own block first, then the published row of the name
  // or of the spell it runs as: the order the cast tools read them in.
  const engine = fact.runsAs ?? name;
  const row = fact.mech ?? spellMechFor([name, ...(fact.runsAs ? [fact.runsAs] : [])]);
  const mech: SpellMech =
    row ??
    (fact.desc ? parseSpellMech({ desc: fact.desc, higherLevel: fact.higherLevel }) : bakedSpellMech(name)) ??
    { resolution: "utility" };
  const slot = fact.level > 0 ? lowestSlot(sheet, fact.level) : null;
  const derived = computeSheetDerived(sheet);
  const abilityMod = sheet.spellcasting ? derived.abilityMods[sheet.spellcasting.ability] : 0;
  const scaled = scaledSpellDice({
    spellLevel: fact.level,
    desc: fact.desc,
    higherLevel: fact.higherLevel,
    casterLevel: sheet.level,
    slotLevel: slot?.level,
  });
  // The dice the engine rolls (spellDamageFor reads the same rule): Web,
  // Entangle and Hypnotic Pattern deal none whatever their prose mentions.
  const rolled = mechSpellDamage({
    spell: name,
    mech: row,
    spellLevel: fact.level,
    casterLevel: sheet.level,
    slotLevel: slot?.level,
    desc: fact.desc,
    higherLevel: fact.higherLevel,
  });
  let damage: string | null = mech.resolution === "heal" || mech.resolution === "buff" ? null : rolled?.dice ?? null;
  let heals = false;
  if (mech.resolution === "heal") {
    // upcastDamage reads a healing step too, so a higher slot heals more.
    const healing = scaled?.dice ?? baseHealingDice(fact.desc);
    heals = true;
    damage = healing ? addFlat(healing, /spellcasting ability modifier|spellcasting modifier/i.test(fact.desc) ? abilityMod : 0) : null;
  }
  // Agonizing Blast and its kin ride one named cantrip.
  const rider = riders.cantripAbilityRiders.find((entry) => textKey(entry.spell) === textKey(name));
  if (rider && damage) {
    damage = addFlat(damage, derived.abilityMods[rider.ability as keyof typeof derived.abilityMods] ?? 0);
  }
  const toHit = mech.resolution === "attack" ? spellAttackFor(sheet, name) : null;
  // The engine's own facts (casting time, components, material cost, range)
  // for the engine's own gates below.
  const facts = fact.facts ?? bundledSpellFacts(name);
  const dc = mech.resolution === "save" && mech.save ? spellSaveDcFor(sheet, name) : null;
  const save = dc !== null && mech.save ? { ability: SAVE_LABEL[mech.save] ?? mech.save.toUpperCase(), dc } : null;
  const type: HandCardType =
    mech.resolution === "heal" ? "mend" : mech.resolution === "buff" ? "ward" : mech.condition ? "control" : "spell";
  const target: HandTarget =
    mech.resolution === "heal"
      ? "ally"
      : mech.resolution === "buff"
        ? mech.buff?.target === "self" ? "self" : "ally"
        : mech.resolution === "attack" || mech.resolution === "save" || mech.resolution === "auto"
          ? "enemy"
          : "none";
  const typed = damage ? `${damage}${mech.damageType ? ` ${mech.damageType}` : ""}` : "";
  const dice = heals
    ? damage ? t("table.hand.spell.heals", { dice: damage }) : t("table.hand.spell.healsOnly")
    : save
      ? typed ? t("table.hand.spell.saveTyped", { dice: typed, ability: save.ability }) : t("table.hand.spell.saveDc", { ability: save.ability, dc: save.dc })
      : typed ||
        (mech.buff
          ? // A buff with an aura that hurts (Spirit Guardians) names the
            // engine's dice beside it; the card itself aims at no enemy.
            `${mech.buff.condition}${mech.resolution === "buff" && rolled ? `, ${rolled.dice}${mech.damageType ? ` ${mech.damageType}` : ""}` : ""}`
          : "");
  const roll =
    toHit !== null
      ? t("table.hand.attack.toHit", { bonus: signed(toHit) })
      : save
        ? typed ? t("table.hand.spell.dcRoll", { dc: save.dc, tail: mech.halfOnSave ? t("table.hand.spell.halfOnSave") : "" }) : t("table.hand.spell.noAttack")
        : t("table.hand.roll.none");
  const notes: string[] = [];
  if (fact.concentration && sheet.concentratingOn && textKey(sheet.concentratingOn) !== textKey(name)) {
    notes.push(t("table.hand.spell.endsConcentration", { spell: sheet.concentratingOn }));
  }
  // A note the model reads too: its tool directions are not the player's
  // (src/lib/language/player-text.ts).
  const note = mech.note ? forPlayers(mech.note) : "";
  if (note) notes.push(note);
  if (slot && slot.level > fact.level) notes.push(t("table.hand.spell.upcast", { level: slot.level }));
  // Mechanics the app read from the spell's text that nobody checked
  // (issue #570): the card's details say so. Keyed words, the English ones
  // byte-identical to reading-logic's constants (test-best-effort.mjs pins
  // the English line; the equality anchor below maps the short form to the
  // whole note in either language).
  if (fact.bestEffort) notes.push(t("table.hand.spell.bestEffortShort"));
  // Every refusal below is the cast guard's own (src/lib/dm/cast-rules.ts),
  // asked of the same sheet: raging, a beast form without Beast Spells,
  // untrained armor, a verbal component while silenced, no free hand, a
  // costly material neither carried nor affordable, no slot, and the
  // bonus-action spell rule.
  const problem = (refusal: ToolError | null, spent = false): Gate => (refusal ? { reason: refusal.error, spent } : null);
  const material = materialPlan(sheet, facts, { inFight: true, slotLevel: slot?.level ?? fact.level });
  const slotRefusal = fact.level > 0 && !slot ? slotPlan(sheet, name, facts, fact.level) : null;
  const charge = turnCharge({
    who: sheet.name,
    facts,
    spell: name,
    slotLevel: slot?.level ?? null,
    inFight: true,
    budget: turn.myTurn ? budgetOf(turn, sheet) : null,
    reactionSpent: turn.reactionUsed,
    // Mantle of Majesty, Elder Champion (the school is the pack's, so
    // Embodiment of the Law is the engine's to decide).
    bonusCast: bonusCastOf(sheet, facts, null),
  });
  const melee = mech.resolution === "attack" && isMeleeSpellAttack(engine, facts?.range.kind);
  if (melee) notes.unshift(t("table.hand.spell.meleeNote"));
  // A feature that moves the spell to the bonus action shows it there.
  const shownCost: HandCost = !("error" in charge) && charge.kind === "budget" && charge.cost === "bonus action" ? "bonus" : cost;
  // The range the card shows: the structured facts' kind decides Self, Touch
  // and feet, so the reader's own words appear; a range word the facts do
  // not carry keeps the data's own text (feet's shortened form).
  const shownRange = (() => {
    if (facts?.range.kind === "self") return t("table.hand.range.self");
    if (facts?.range.kind === "touch") return t("table.hand.range.touch");
    if (facts?.range.kind === "feet") return t("table.hand.range.feet", { feet: facts.range.feet });
    return feet(fact.range, t);
  })();
  const card: HandCard = {
    id: `spell:${textKey(name)}`,
    type,
    name,
    cost: shownCost,
    range: shownRange,
    dice,
    roll,
    rules: notes.slice(0, 2).join(" "),
    description: [fact.desc, fact.higherLevel ? t("table.hand.spell.higherLevels", { text: fact.higherLevel }) : "", ...notes.map((note) => (note === t("table.hand.spell.bestEffortShort") ? t("table.hand.spell.bestEffortNote") : note))].filter(Boolean).join("\n\n"),
    resource: fact.level === 0 ? t("table.hand.spell.cantrip") : slot ? slotLine(slot, t) : t("table.hand.spell.noSlots", { level: fact.level }),
    condition: mech.condition?.name ?? (fact.concentration ? t("table.hand.spell.concentration") : ""),
    icon: { kind: "spell", key: name, family: fact.school ? `spell-${fact.school.toLowerCase()}` : null },
    target,
    toHit,
    damage,
    damageType: heals ? "healing" : mech.damageType ?? "",
    heals,
    save,
    // A touch spell is a melee spell attack with touch reach (the engine's
    // isMeleeSpellAttack): it previews and aims like a swing.
    melee,
    ...(melee ? { range: t("table.hand.range.touch") } : {}),
    disabled: null,
    spent: false,
    compose: false,
    level: fact.level,
    ...(fact.concentration ? { concentration: true } : {}),
    // A reaction spell (Shield, Hellish Rebuke) is played as a reaction:
    // use_reaction resolves it, off the caster's turn too.
    intent:
      cost === "reaction"
        ? { card: "reaction", feature: name, spell: name, slotLevel: slot?.level ?? null }
        : { card: "spell", spell: name, slotLevel: slot?.level ?? null },
  };
  const choice = cost === "reaction" ? undefined : spellChoice(mech, t);
  if (choice) card.choice = choice;
  // Web, Moonbeam, a wall: the square it is laid on is picked on the board.
  // So is an instant blast's (Fireball, Burning Hands), whose squares the
  // engine then catches everyone on (issue 570); a blast around the caster
  // needs no pick and aims at nobody.
  const zone = cost === "reaction" ? null : areaFor({ spell: name, runsAs: fact.runsAs }, slot?.level ?? (fact.level || null));
  // Its printed area decides, not the parsed row's flag, which a line "100
  // feet long" or a "10-foot-radius sphere" can slip past (Lightning Bolt,
  // Shatter).
  const blast =
    cost === "reaction" || zone || !blasts || (mech.resolution !== "save" && mech.resolution !== "auto")
      ? null
      : blastAreaFor({ spell: name, runsAs: fact.runsAs }, { desc: fact.desc, range: fact.range }, slot?.level ?? (fact.level || null), mech.damageType ?? "");
  const area = zone ?? blast;
  if (area) card.area = area;
  if (blast?.pick === "none") card.target = "none";
  // Magic Missile's darts, Scorching Ray's rays, Eldritch Blast's beams, the
  // creatures Bless or an upcast Hold Person takes: how they are shared out
  // is asked in the Hand, not left to the model (issue 570).
  const shared = cost === "reaction" || area ? null : spellShares(mech, fact.level, slot?.level ?? null, sheet.level);
  if (shared) card.shares = shared;
  return gated(
    card,
    standingGate(sheet, turn, cost === "reaction" ? "reaction" : "cast", t),
    problem(casterStateProblem(sheet)),
    problem(componentProblem(sheet, facts) ?? focusProblem(sheet, facts)),
    // A reaction spell needs a reaction to spend (slowed takes it away).
    cost === "reaction" ? costGate("reaction", turn, sheet, name, t) : null,
    "error" in material ? { reason: material.error, spent: false } : null,
    slotRefusal && "error" in slotRefusal ? { reason: slotRefusal.error, spent: true } : null,
    "error" in charge ? { reason: charge.error, spent: charge.error.includes("already used") } : null,
  );
}

export function spellCards(sheet: CharacterSheet, turn: HandTurn, riders: CombatRiders, options: HandOptions, t: T = enT): HandCard[] {
  const rows: Array<{ level: number; card: HandCard }> = [];
  for (const name of spellNames(sheet)) {
    const fact = factFor(name, options);
    if (!fact) continue;
    const card = spellCard(sheet, turn, riders, name, fact, options.blasts !== false, t);
    if (card) rows.push({ level: fact.level, card });
  }
  // Attacks first inside a level, so the cantrip that hurts leads the hand.
  const weight = (card: HandCard) => (card.target === "enemy" ? 0 : card.heals ? 1 : 2);
  rows.sort((a, b) => a.level - b.level || weight(a.card) - weight(b.card) || compareNames(a.card.name, b.card.name));
  return rows.map((row) => row.card);
}

// ---- class features and resources ----

// What the feature costs to use. The resource table does not carry it, so
// the SRD staples are named and the rest is read out of the guidance line.
const FEATURE_COST: Record<string, HandCost> = {
  rage: "bonus",
  second_wind: "bonus",
  bardic_inspiration: "bonus",
  action_surge: "free",
  ki: "free",
  sorcery_points: "free",
};

function featureCost(def: ResourceDef): HandCost {
  const named = FEATURE_COST[def.id];
  if (named) return named;
  // The cost the engine charges (ResourceDef.action), when the counter has one.
  if (def.action) return def.action === "none" ? "free" : def.action;
  if (/bonus action/i.test(def.guidance)) return "bonus";
  if (/\breaction\b/i.test(def.guidance)) return "reaction";
  return "action";
}

export function featureCards(sheet: CharacterSheet, turn: HandTurn, t: T = enT, locale: Locale = "en"): HandCard[] {
  const derived = computeSheetDerived(sheet);
  const cards: HandCard[] = [];
  for (const [id, state] of Object.entries(sheet.resources)) {
    const def = resourceDef(id);
    // Superiority dice ride attacks (riderCards); recoveries belong to a rest.
    // Ki is spent through its techniques, each a card of its own (hand-class.ts
    // Flurry of Blows, and the bonus-action moves in hand.ts).
    // A feat's pour-in (Inner Resilience's ki) lives under the class counter's id, never its own card.
    // Channel Divinity and Psionic Energy are one card per option, each at its
    // own cost (hand-options.ts).
    if (!def || def.passive || def.into || id === "sub_superiority_dice" || id === "ki" || def.effect.kind === "recover_slots") continue;
    if (id === "channel_divinity" || (id === "sub_psionic_energy" && psionicOptions(sheet).length)) continue;
    // Spent by the bonus attack itself (hand-class.ts bonusStrikeCards).
    if (BONUS_ATTACK_COUNTERS.includes(id)) continue;
    const level = resourceLevel(def, sheet);
    const effect = def.effect;
    const left = state.max - state.used;
    const cost = featureCost(def);
    let type: HandCardType = "feature";
    let dice = "";
    let damage: string | null = null;
    let target: HandTarget = "none";
    let heals = false;
    let save: HandCard["save"] = null;
    let compose = false;
    let condition = "";
    let damageType = "";
    if (effect.kind === "heal_self" || effect.kind === "heal_target") {
      damage = effect.dice(level, derived.abilityMods);
      dice = t("table.hand.spell.heals", { dice: damage });
      type = "mend";
      heals = true;
      target = effect.kind === "heal_self" ? "self" : "ally";
    } else if (effect.kind === "heal_pool" || effect.kind === "heal_dice_pool") {
      dice = effect.kind === "heal_pool" ? t("table.hand.feature.healsUpTo", { count: left }) : t("table.hand.feature.healsDie", { die: effect.die });
      type = "mend";
      heals = true;
      target = "ally";
      // How much of the pool to spend is the player's call, so they finish the line.
      compose = true;
    } else if (effect.kind === "temp_hp") {
      damage = effect.dice(level, derived.abilityMods);
      dice = t("table.hand.feature.tempHp", { dice: damage });
      type = "ward";
      target = "self";
    } else if (effect.kind === "condition" || effect.kind === "buff") {
      dice = effect.condition;
      condition = effect.condition;
      type = "ward";
      target = effect.kind === "buff" && effect.target === "ally" ? "ally" : "self";
    } else if (effect.kind === "inspire") {
      dice = t("table.hand.feature.inspire", { die: effect.die(level) });
      type = "ward";
      target = "ally";
    } else if (effect.kind === "aoe") {
      // A dragonborn's breath takes its ancestry's save and damage type.
      const spend = aoeSpendFor(def, sheet, level, derived)!;
      damage = spend.dice;
      damageType = spend.damageType ?? "";
      save = { ability: SAVE_LABEL[spend.saveAbility] ?? spend.saveAbility, dc: 0 };
      dice = t("table.hand.spell.saveTyped", { dice: `${damage}${damageType ? ` ${damageType}` : ""}`, ability: save.ability });
      type = "spell";
      target = "enemy";
    } else if (effect.kind === "enemy_save") {
      damage = effect.dice ? effect.dice(level, derived.abilityMods) : null;
      save = { ability: SAVE_LABEL[effect.save] ?? effect.save, dc: 0 };
      dice = damage ? t("table.hand.spell.saveTyped", { dice: damage, ability: save.ability }) : t("table.hand.spell.saveOnly", { ability: save.ability });
      condition = effect.condition ?? "";
      type = condition ? "control" : "spell";
      target = "enemy";
    } else if (effect.kind === "teleport") {
      dice = t("table.hand.range.feet", { feet: effect.feet });
    }
    // The reader's words for the name and the guidance, when the locale's
    // map carries the resource (class-resources-fr.ts); the stored English
    // def stays what the engine parses and the DM's tools read.
    const guidance = resourceGuidance(id, locale) ?? def.guidance;
    const name = resourceDisplayName(id, locale) ?? def.displayName;
    const card: HandCard = {
      id: `feature:${id}`,
      type,
      name,
      cost,
      range: target === "self" || target === "none" ? t("table.hand.range.self") : "",
      dice,
      roll: save ? t("table.hand.spell.noAttack") : t("table.hand.roll.none"),
      rules: guidance.split(". ")[0].replace(/\.?$/, "."),
      description: guidance,
      resource: t("table.hand.feature.uses", { left, max: state.max }),
      condition,
      icon: { kind: "feature", key: def.displayName, family: `class-${primaryClass(sheet)}` },
      target,
      toHit: null,
      damage,
      damageType: heals ? "healing" : damageType,
      heals,
      // A feature's DC is the engine's to compute at spend time, so the card
      // names the save and carries 0 for "not shown".
      save,
      melee: false,
      disabled: null,
      spent: false,
      compose,
      pool: id,
      intent:
        cost === "reaction"
          ? { card: "reaction", feature: def.displayName }
          : { card: "feature", resourceId: id },
    };
    cards.push(
      gated(
        card,
        standingGate(sheet, turn, cost === "reaction" ? "reaction" : cost === "bonus" ? "bonus" : cost === "free" ? "free" : "action", t),
        left > 0 ? null : { reason: t("table.hand.feature.spent", { name, recharge: t(def.recharge === "long" ? "table.hand.feature.restLong" : "table.hand.feature.restShort") }), spent: true },
        costGate(cost, turn, sheet, name, t),
      ),
    );
  }
  return cards;
}

