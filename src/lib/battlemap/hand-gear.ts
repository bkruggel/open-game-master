// The Hand's gear cards (issue #424): what a character does with the things
// in their hands during a fight, each sent to the tool that keeps the count
// (handle_item, use_item, stabilize, dismount), so the card costs what the
// engine charges.
//
// SRD 5.1: drawing or stowing a weapon, picking something up and handing it
// over are the one free object interaction a turn; a second takes the Use an
// Object action. Dropping something costs nothing. A shield is an action to
// don or doff; armor takes minutes, so it has no card. Drinking a potion or
// feeding one to an ally is an action, and so is stabilizing a dying ally.
// Dismounting costs half the rider's speed.
//
// Pure and database-free: scripts/test-hand-gear.mjs drives it.
import { translate } from "@/lib/messages-logic";

type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);
import { handsFullError, handsFullFor, spendInteraction, gearKindOf, inHand } from "@/lib/dm/gear-hands";
import type { SpendResult } from "@/lib/dm/action-budget";
import { dualWields } from "@/lib/dm/attack-rules";
import { hasFastHands } from "@/lib/dm/bonus-routes";
import type { CharacterSheet, EquipmentItem } from "@/lib/schemas/sheet";
import { wearingIsExplicit } from "@/lib/srd/armor";
import { itemTags } from "@/lib/srd/item-tags";
import { textKey } from "@/lib/language/text-logic";
import {
  budgetOf,
  costGate,
  gated,
  standingGate,
  type Gate,
  type HandCard,
  type HandChoice,
  type HandCost,
  type HandGearContext,
  type HandTurn,
} from "@/lib/battlemap/hand-core";
import type { HandGearAction } from "@/lib/battlemap/hand-intent";

// A pick of more than this many rows is cut to the first ones: the pills
// sit in the aim bar, and a pack's whole contents is not a choice.
const MAX_PICKS = 8;

const BLANK = {
  range: "Self",
  dice: "",
  roll: "no roll",
  resource: "",
  condition: "",
  toHit: null,
  damage: null,
  damageType: "",
  heals: false,
  save: null,
  melee: false,
  disabled: null,
  spent: false,
  compose: false,
} as const;

function card(
  id: string,
  name: string,
  action: HandGearAction,
  cost: HandCost,
  rules: string,
  icon: HandCard["icon"],
  extra: Partial<HandCard> = {},
  t: T = enT,
): HandCard {
  return {
    ...BLANK,
    range: t("table.hand.range.self"),
    roll: t("table.hand.roll.none"),
    id: `gear:${id}`,
    type: "basic",
    name,
    cost,
    rules,
    icon,
    target: "none",
    intent: { card: "gear", action },
    ...extra,
  };
}

function pick(label: string, rows: Array<{ value: string; label: string; note?: string }>): HandChoice {
  return { arg: "item", label, options: rows.slice(0, MAX_PICKS) };
}

function once<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const name = textKey(key(row));
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

const rowPick = (item: EquipmentItem) => ({ value: item.name, label: item.name, ...(item.qty > 1 ? { note: `×${item.qty}` } : {}) });

// What the interaction costs now: nothing while it is unspent, the Use an
// Object action after (Fast Hands' bonus action for a thief), in the
// engine's own words when neither is left.
function interactionCost(sheet: CharacterSheet, turn: HandTurn, t: T = enT): { cost: HandCost; note: string; gate: Gate } {
  if (!turn.interactionUsed) {
    return { cost: "free", note: t("table.hand.gear.interactionFree"), gate: null };
  }
  const result = spendInteraction(budgetOf(turn, sheet), {
    what: "another object",
    who: sheet.name,
    fastHands: hasFastHands(sheet),
    dualWielder: dualWields(sheet.feats, sheet.campaignId),
  });
  const bonus = result.ok && result.budget.bonusUsed && !turn.bonusUsed;
  return {
    cost: bonus ? "bonus" : "action",
    note: bonus
      ? t("table.hand.gear.interactionFastHands")
      : t("table.hand.gear.interactionAction"),
    gate: interactionGate(result, sheet.name, "another object", t),
  };
}

// The engine's refusals the gear cards carry (src/lib/dm/gear-hands.ts),
// matched exactly and carried into the reader's words; a sentence the
// mapping has not met keeps the engine's English. Each mapping, refusal → key:
//   handsFullError, a draw with no hand free → table.hand.gear.handsFull
//   spendInteraction, the action gone → table.hand.gear.interactionSpentAction
//   spendInteraction, an attack cannot draw too → table.hand.gear.interactionSpentAttack
// The "already went on" clause names what the budget spent, which the Hand
// always builds as "an object" (budgetOf); a different wording falls back.
function handsFullReason(who: string, what: string, full: readonly string[], t: T): string {
  const items = full.join(" and ");
  if (
    handsFullError(who, what, full) ===
    `${who}'s hands are full (${items}), so ${what} cannot be drawn yet. Dropping one is free (handle_item drop); putting one away takes the object interaction.`
  ) {
    return t("table.hand.gear.handsFull", { name: who, items, what });
  }
  return handsFullError(who, what, full);
}

function interactionGate(result: SpendResult, who: string, what: string, t: T): Gate {
  if (result.ok) {
    return null;
  }
  const spent = `${who}'s free object interaction this turn already went on an object`;
  if (result.error === `${spent}, and ${what} would be a second: that takes the Use an Object action, which ${who} has already spent. It can wait for their next turn.`) {
    return { reason: t("table.hand.gear.interactionSpentAction", { name: who, what }), spent: true };
  }
  if (result.error === `${spent}, and ${what} would be a second, which takes the Use an Object action: an attack cannot draw it as well. ${who} attacks with what they hold, or draws it on their next turn.`) {
    return { reason: t("table.hand.gear.interactionSpentAttack", { name: who, what }), spent: true };
  }
  return { reason: result.error, spent: true };
}

export function gearCards(sheet: CharacterSheet, turn: HandTurn, context: HandGearContext = {}, t: T = enT): HandCard[] {
  const standing = standingGate(sheet, turn, "action", t);
  const free = standingGate(sheet, turn, "free", t);
  const interaction = interactionCost(sheet, turn, t);
  const touch = { cost: interaction.cost, resource: interaction.cost === "free" ? "Interaction" : "", interaction: true };
  const cards: HandCard[] = [];
  const equipment = sheet.equipment;
  const explicit = wearingIsExplicit(equipment);
  const weapons = once(equipment.filter((item) => gearKindOf(item) === "weapon"), (item) => item.name);
  const held = weapons.filter((item) => inHand(item, equipment));
  const stowed = explicit ? weapons.filter((item) => item.equipped !== true) : [];

  // The shield: on the arm or off it, an action either way.
  const shield = equipment.find((item) => gearKindOf(item) === "shield");
  if (shield) {
    const worn = inHand(shield, equipment);
    cards.push(
      gated(
        card(
          worn ? "doff-shield" : "don-shield",
          worn ? t("table.hand.gear.doffName", { name: shield.name }) : t("table.hand.gear.donName", { name: shield.name }),
          worn ? "unequip" : "equip",
          "action",
          worn ? t("table.hand.gear.doffRules") : t("table.hand.gear.donRules"),
          { kind: "item", key: shield.name, family: "item-armor" },
          { choice: pick(t("table.hand.gear.pickShield"), [rowPick(shield)]) },
          t,
        ),
        standing,
        costGate("action", turn, sheet, worn ? `taking off ${shield.name}` : `strapping on ${shield.name}`, t),
      ),
    );
  }

  if (stowed.length) {
    // Only what a free hand can take; with none free, the card says how to
    // free one (dropping is free, putting one away is the interaction).
    const fits = stowed.filter((item) => !handsFullFor(equipment, item).length);
    const full: Gate = fits.length ? null : { reason: handsFullReason(sheet.name, "another weapon", handsFullFor(equipment, stowed[0]), t), spent: false };
    cards.push(
      gated(
        card("draw", t("table.hand.gear.drawName"), "equip", touch.cost, `${interaction.note} ${t("table.hand.gear.drawRules")}`, { kind: "action", key: "use-object" }, {
          resource: touch.resource,
          interaction: touch.interaction,
          choice: pick(t("table.hand.gear.pickWeapon"), (fits.length ? fits : stowed).map(rowPick)),
        }, t),
        standing,
        full,
        interaction.gate,
      ),
    );
  }
  if (held.length) {
    cards.push(
      gated(
        card("stow", t("table.hand.gear.stowName"), "unequip", touch.cost, `${interaction.note} ${t("table.hand.gear.stowRules")}`, { kind: "action", key: "use-object" }, {
          resource: touch.resource,
          interaction: touch.interaction,
          choice: pick(t("table.hand.gear.pickWeapon"), held.map(rowPick)),
        }, t),
        standing,
        interaction.gate,
      ),
    );
    // Letting go costs nothing, and the thing lies where it fell.
    cards.push(
      gated(
        card("drop", t("table.hand.gear.dropName"), "drop", "free", t("table.hand.gear.dropRules"), { kind: "action", key: "use-object" }, {
          choice: pick(t("table.hand.gear.pickItem"), held.map(rowPick)),
        }, t),
        free,
      ),
    );
  }

  const reach = (context.drops ?? []).filter((drop) => drop.reach);
  if (reach.length) {
    cards.push(
      gated(
        card("pick-up", t("table.hand.gear.pickUpName"), "pick_up", touch.cost, `${interaction.note} ${t("table.hand.gear.pickUpRules")}`, { kind: "action", key: "use-object" }, {
          resource: touch.resource,
          interaction: touch.interaction,
          choice: pick(t("table.hand.gear.pickItem"), once(reach, (drop) => drop.name).map((drop) => ({ value: drop.id, label: drop.name }))),
        }, t),
        standing,
        interaction.gate,
      ),
    );
  }

  // Something passed to an ally within 5 feet: a weapon, a potion, a scroll.
  const passable = once(
    equipment.filter((item) => {
      const kind = gearKindOf(item);
      if (kind === "armor" || kind === "shield" || (kind === "worn" && item.equipped === true)) return false;
      const tags = itemTags(item);
      return kind === "weapon" || tags.includes("potion") || tags.includes("scroll") || tags.includes("consumable");
    }),
    (item) => item.name,
  );
  if (passable.length && (context.allies ?? 0) > 0) {
    cards.push(
      gated(
        card("hand", t("table.hand.gear.handName"), "hand", touch.cost, `${interaction.note} ${t("table.hand.gear.handRules")}`, { kind: "action", key: "help" }, {
          resource: touch.resource,
          interaction: touch.interaction,
          target: "ally",
          range: t("table.hand.range.melee"),
          choice: pick(t("table.hand.gear.pickItem"), passable.map(rowPick)),
        }, t),
        standing,
        interaction.gate,
      ),
    );
  }

  // A potion, drunk or poured down an ally's throat: an action (use_item).
  const potions = once(equipment.filter((item) => itemTags(item).includes("potion")), (item) => item.name);
  if (potions.length) {
    cards.push(
      gated(
        card("potion", t("table.hand.gear.drinkName"), "use", "action", t("table.hand.gear.drinkRules"), { kind: "item", key: potions[0].name, family: "item-gear" }, {
          target: "ally",
          range: t("table.hand.range.touch"),
          choice: pick(t("table.hand.gear.pickPotion"), potions.map(rowPick)),
        }, t),
        standing,
        costGate("action", turn, sheet, "drinking a potion", t),
      ),
    );
  }

  // Basics that only matter now and then.
  const dying = context.dying ?? [];
  if (dying.some((ally) => ally.id !== sheet.id)) {
    cards.push(
      gated(
        {
          ...BLANK,
          id: "basic:stabilize",
          type: "basic",
          name: t("table.hand.basic.stabilize"),
          cost: "action",
          range: t("table.hand.range.touch"),
          dice: t("table.hand.dice.medicine"),
          roll: t("table.hand.roll.skill"),
          rules: t("table.hand.basic.stabilize.rules"),
          icon: { kind: "action", key: "help" },
          target: "ally",
          intent: { card: "basic", action: "stabilize" },
        },
        standing,
        costGate("action", turn, sheet, "stabilizing", t),
      ),
    );
  }
  if (context.mount) {
    cards.push(
      gated(
        {
          ...BLANK,
          id: "basic:dismount",
          type: "basic",
          name: t("table.hand.basic.dismount"),
          cost: "free",
          range: t("table.hand.range.self"),
          rules: t("table.hand.basic.dismount.rules", { mount: context.mount }),
          icon: { kind: "action", key: "stand-up" },
          target: "none",
          intent: { card: "basic", action: "dismount" },
        },
        standingGate(sheet, turn, "move", t),
      ),
    );
  }
  return cards;
}

// The Attack action draws the weapon it swings with when a hand is free and
// the interaction is too (pc-attack-plan.ts); otherwise a stowed weapon is
// not swung this turn, in the engine's own words.
export function undrawnGate(sheet: CharacterSheet, turn: HandTurn, weapon: string, t: T = enT): Gate {
  if (!wearingIsExplicit(sheet.equipment)) return null;
  const row = sheet.equipment.find((item) => textKey(item.name) === textKey(weapon));
  if (!row || gearKindOf(row) !== "weapon" || row.equipped === true) return null;
  const full = handsFullFor(sheet.equipment, row);
  if (full.length) return { reason: handsFullReason(sheet.name, row.name, full, t), spent: false };
  if (!turn.interactionUsed) return null;
  const result = spendInteraction(budgetOf(turn, sheet), { what: `drawing ${row.name}`, who: sheet.name, withAction: false });
  return interactionGate(result, sheet.name, `drawing ${row.name}`, t);
}
