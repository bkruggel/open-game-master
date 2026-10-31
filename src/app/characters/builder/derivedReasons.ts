// The numbers the server derives for a new character (hit points, armor
// class, coin), each with the one line that says where it comes from. The
// builder shows them; it never lets them be typed, because the server works
// them out again from the same choices when the character is saved.
//
// The lines live in the dictionaries under `builder.derived.*`; each builder
// takes the translator from the component that draws it (the agoLabel
// pattern in home/types.ts), so a language switch rewords the review with
// the rest of the builder. Pure otherwise: no React, no database.
import { fixedDieValue, type HpMethod } from "@/lib/srd/hit-points";
import { formatPrice } from "@/lib/srd/currency";
import { describeWealthDice, startingWealthDice } from "@/lib/srd/starting-wealth";
import type { PurseView } from "./EquipmentSection";
import type { TableRulesState } from "./useTableRules";

// The reading takes the translator from the component that draws the line;
// a test passes translate("en", ...).
type Translator = (key: string, vars?: Record<string, string | number>) => string;

export type DerivedLine = { value: string; reason: string };

export function hitPointsLine(t: Translator, input: {
  hitDie: number;
  level: number;
  maxHp: number;
  range: { min: number; max: number };
  method: HpMethod;
  // A stored character keeps the hit points it came home with.
  kept: boolean;
  // Built in the library, where no table has chosen a method yet.
  atTable: boolean;
  // A class list's dice (backlog F9), the first class's first: each later
  // level counts its own class's die.
  dice?: number[];
}): DerivedLine {
  const { hitDie, level, maxHp, range, method } = input;
  const mixed = new Set(input.dice ?? []).size > 1;
  if (input.kept) {
    return {
      value: String(maxHp),
      reason: t("builder.derived.hp.kept"),
    };
  }
  const first = t("builder.derived.hp.first", { die: hitDie });
  if (level <= 1) {
    return { value: String(maxHp), reason: `${first}.` };
  }
  if (mixed) {
    const dice = [...new Set(input.dice)].map((die) => `d${die}`).join(", ");
    const how =
      method === "rolled"
        ? t("builder.derived.hp.mixedRolled")
        : method === "max"
          ? t("builder.derived.hp.mixedMax")
          : t("builder.derived.hp.mixedAverage");
    return {
      value: method === "rolled" ? t("builder.derived.hp.range", { min: range.min, max: range.max }) : String(maxHp),
      reason: t("builder.derived.hp.mixed", { first, dice, how }),
    };
  }
  if (method === "rolled") {
    return {
      value: t("builder.derived.hp.range", { min: range.min, max: range.max }),
      reason: t("builder.derived.hp.rolled", { first, die: hitDie }),
    };
  }
  const later =
    method === "max"
      ? t("builder.derived.hp.laterMax", { face: hitDie })
      : t("builder.derived.hp.laterAverage", { average: fixedDieValue(hitDie) });
  const atTable = input.atTable ? ` ${t("builder.derived.hp.atTable")}` : "";
  return {
    value: String(maxHp),
    reason: t("builder.derived.hp.settled", { first, later, tail: atTable }),
  };
}

export function armorClassLine(t: Translator, ac: number, parts: string[] | undefined): DerivedLine {
  return {
    value: String(ac),
    reason: parts?.length
      ? t("builder.derived.ac.worn", { parts: parts.join(" + ") })
      : t("builder.derived.ac.unarmored"),
  };
}

// The purse as the gear step and the review show it.
export function purseViewFor(t: Translator, input: {
  purse: {
    gold: number;
    copper: number;
    spentCopper: number;
    problems: string[];
    method: string;
    receipt?: PurseView["receipt"];
  };
  keepsStoredGear: boolean;
  backgroundName: string;
  backgroundPurse: number;
  classId: string;
  className: string;
  table: TableRulesState;
}): PurseView {
  const { purse, table } = input;
  const spent = purse.spentCopper ? ` ${t("builder.derived.purse.bought", { price: formatPrice(purse.spentCopper) })}` : "";
  const rolledTable = !input.keepsStoredGear && purse.method === "rolled";
  const dice = describeWealthDice(startingWealthDice(input.classId));
  const source = input.keepsStoredGear
    ? t("builder.derived.purse.kept", { spent })
    : rolledTable
      ? table.wealth
        ? t("builder.derived.purse.rolledSpent", { className: input.className, spent })
        : t("builder.derived.purse.rolledKit", { className: input.className, dice })
      : t("builder.derived.purse.background", { background: input.backgroundName, amount: input.backgroundPurse, spent });
  return {
    gold: purse.gold,
    copper: purse.copper,
    source,
    problems: [...new Set(purse.problems)],
    ...(purse.receipt ? { receipt: purse.receipt } : {}),
    wealth: rolledTable
      ? {
          dice,
          rolled: table.wealth ? { faces: table.wealth.faces, gold: table.wealth.gold } : null,
          busy: table.wealthBusy,
          error: table.wealthError,
          onRoll: table.rollWealth,
        }
      : null,
  };
}
