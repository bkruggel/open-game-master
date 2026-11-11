// One card per option of a pool whose options cost different things (issue
// 233, src/lib/dm/option-costs.ts): each Channel Divinity option and Psionic
// Energy use the sheet holds, and the Battle Master's Rally and Commander's
// Strike. Before this the Hand dealt one Channel Divinity card that named no
// option and cost an action whatever was chosen.
//
// Pure; scripts/test-hand-options.mjs drives it.
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { translate } from "@/lib/messages-logic";

type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);
import { channelOptions, psionicOptions, type HeldOption } from "@/lib/dm/option-costs";
import { maneuverDieFor } from "@/lib/dm/maneuver-rules";
import { iconPath, isPainted, type IconRef } from "@/lib/icons";
import {
  costGate,
  gated,
  primaryClass,
  standingGate,
  type HandCard,
  type HandCost,
  type HandTarget,
  type HandTurn,
} from "@/lib/battlemap/hand-core";
import { textKey } from "@/lib/language/text-logic";
import { isNamed } from "@/lib/srd/feature-names";

const COST: Record<HeldOption["cost"], HandCost> = {
  action: "action",
  bonus: "bonus",
  reaction: "reaction",
  none: "free",
  ritual: "action",
};

function card(
  sheet: CharacterSheet,
  turn: HandTurn,
  pool: { id: string; label: string },
  option: { name: string; cost: HandCost; rules: string; target?: HandTarget; dice?: string; ritual?: boolean; icon?: IconRef },
  t: T = enT,
): HandCard {
  const state = sheet.resources[pool.id];
  const left = state ? state.max - state.used : 0;
  const cost = option.cost;
  const made: HandCard = {
    id: `option:${pool.id}:${textKey(option.name).replaceAll(" ", "-")}`,
    type: option.target === "ally" ? "ward" : "feature",
    name: option.name,
    cost,
    range: option.target === "ally" || option.target === "enemy" ? "" : t("table.hand.range.self"),
    dice: option.dice ?? "",
    roll: t("table.hand.roll.none"),
    rules: option.rules,
    resource: state ? `${pool.label} ${left}/${state.max}` : "",
    condition: "",
    // The option's own painting, else its pool's, else the class emblem.
    icon: option.icon ?? {
      kind: "feature",
      key: isPainted(iconPath("feature", option.name)) ? option.name : pool.label,
      family: `class-${primaryClass(sheet)}`,
    },
    target: option.target ?? "none",
    toHit: null,
    damage: null,
    damageType: "",
    heals: false,
    save: null,
    melee: false,
    disabled: null,
    spent: false,
    compose: false,
    pool: pool.id,
    intent:
      cost === "reaction"
        ? { card: "reaction", feature: option.name }
        : { card: "feature", resourceId: pool.id, variant: option.name.toLowerCase().slice(0, 40) },
  };
  return gated(
    made,
    standingGate(sheet, turn, cost === "reaction" ? "reaction" : cost === "bonus" ? "bonus" : cost === "free" ? "free" : "action", t),
    option.ritual && turn.table ? { reason: t("table.hand.option.ritualGate", { name: option.name }), spent: false } : null,
    left > 0 ? null : { reason: t("table.hand.option.spentGate", { pool: pool.label }), spent: true },
    costGate(cost, turn, sheet, option.name, t),
  );
}

// What an option costs its holder's turn, keyed; the option names and the
// pool labels are the resources' own words and stay as they are.
const RULES: Record<HeldOption["cost"], string> = {
  action: "table.hand.option.cost.action",
  bonus: "table.hand.option.cost.bonus",
  reaction: "table.hand.option.cost.reaction",
  none: "table.hand.option.cost.none",
  ritual: "table.hand.option.cost.ritual",
};

export function optionCards(sheet: CharacterSheet, turn: HandTurn, t: T = enT): HandCard[] {
  const cards: HandCard[] = [];
  if (sheet.resources.channel_divinity) {
    for (const option of channelOptions(sheet)) {
      cards.push(
        card(sheet, turn, { id: "channel_divinity", label: "Channel Divinity" }, {
          name: option.name,
          cost: COST[option.cost],
          rules: t("table.hand.option.channelRules", { rules: t(RULES[option.cost]) }),
          ritual: option.cost === "ritual",
        }, t),
      );
    }
  }
  if (sheet.resources.sub_psionic_energy) {
    for (const option of psionicOptions(sheet)) {
      // Protective Field answers a hit: the reaction prompt offers it.
      if (option.cost === "reaction") continue;
      cards.push(
        card(sheet, turn, { id: "sub_psionic_energy", label: "Psionic Energy" }, {
          name: option.name,
          cost: COST[option.cost],
          rules: t("table.hand.option.psionicRules", { rules: t(RULES[option.cost]) }),
        }, t),
      );
    }
  }
  if (sheet.resources.sub_superiority_dice) {
    const die = `1${maneuverDieFor(sheet)}`;
    const knows = (name: string) => sheet.features.some((feature) => /^maneuver:/i.test(feature.name) && isNamed(feature.name, name));
    if (knows("rally")) {
      cards.push(
        card(sheet, turn, { id: "sub_superiority_dice", label: t("table.hand.option.poolDice") }, {
          name: "Rally",
          cost: "bonus",
          rules: t("table.hand.option.rallyRules"),
          target: "ally",
          dice: t("table.hand.option.rallyDice", { die }),
          icon: { kind: "option", key: "Maneuver: Rally", family: "option-maneuver" },
        }, t),
      );
    }
    if (knows("commander's strike")) {
      cards.push(
        card(sheet, turn, { id: "sub_superiority_dice", label: t("table.hand.option.poolDice") }, {
          name: "Commander's Strike",
          cost: "bonus",
          rules: t("table.hand.option.commanderRules"),
          target: "ally",
          dice: `+${die}`,
          icon: { kind: "option", key: "Maneuver: Commander's Strike", family: "option-maneuver" },
        }, t),
      );
    }
  }
  return cards;
}
