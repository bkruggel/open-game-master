import { textKey } from "@/lib/language/text-logic";
import { checklistSpell, checklistSpellsOn, spellLevelOf } from "@/lib/srd/spell-lists";

// Which spells the save takes on a caster's list, and how many of them there
// are. The quick build (quickBuild.ts), the spell step's own fill and the
// spell step's gate all read these, so the builder never offers a spell the
// server refuses (src/lib/srd/legality/spells.ts spellNameProblems), and
// never holds a save for one that does not exist.

export type SpellListRule = {
  // A third caster (an Eldritch Knight) is held to its two schools instead,
  // and picks only from its starters, which are drawn from them.
  third: boolean;
  // The list the class casts from (spellClassFor), "" for none.
  spellClass: string;
  // The spells the spell step offers this class (useSpellPool: the content
  // pack's list, or the bundled checklist without it). The checklist stands
  // in until it arrives.
  spellPool?: ReadonlyArray<{ name: string }>;
};

// Whether the save takes `name` on this caster's list.
export function spellOnSavedList(name: string, rule: SpellListRule): boolean {
  if (rule.third || !rule.spellClass) {
    return true;
  }
  if (rule.spellPool?.length) {
    return rule.spellPool.some((spell) => textKey(spell.name) === textKey(name));
  }
  return (checklistSpell(name)?.classes ?? []).includes(rule.spellClass);
}

export type SpellSupply = { cantrips: number; spells: number };

// How many cantrips and levelled spells (up to the caster's top level) a
// list holds, leaving out the ones the caster gets free (a race's cantrip, a
// domain's spells), which do not count toward the class's numbers.
export function spellSupplyOf(
  rows: ReadonlyArray<{ name: string; level: number }>,
  maxSpellLevel: number,
  free: readonly string[],
): SpellSupply {
  const skip = new Set(free.map(textKey));
  const seen = new Set<string>();
  const supply = { cantrips: 0, spells: 0 };
  for (const row of rows) {
    const key = textKey(row.name);
    if (skip.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (row.level === 0) {
      supply.cantrips += 1;
    } else if (row.level >= 1 && row.level <= maxSpellLevel) {
      supply.spells += 1;
    }
  }
  return supply;
}

// The supply the bundled checklist gives a class, with what its subclass
// adds (a patron's expanded spells, a Divine Soul's cleric list). The server
// takes every one of them with or without the content pack, so a count the
// builder asks for past this is a pick that may not exist: without the pack,
// a level 3 artificer may prepare four spells and the checklist has three.
export function bundledSpellSupply(input: {
  spellClass: string;
  maxSpellLevel: number;
  wider: { spells: string[]; lists: string[] };
  free: readonly string[];
}): SpellSupply | null {
  if (!input.spellClass) {
    return null;
  }
  const rows = [
    ...checklistSpellsOn(input.spellClass),
    ...input.wider.lists.flatMap((list) => checklistSpellsOn(list)),
    ...input.wider.spells.flatMap((name) => {
      const level = spellLevelOf(name);
      return level === null ? [] : [{ name, level }];
    }),
  ];
  return spellSupplyOf(rows, input.maxSpellLevel, input.free);
}

// What the spell step says when the list holds fewer spells than the class
// may take: how many there are, that they are all there is, and that the
// gap does not hold up the save.
export function spellShortageLines(input: {
  className: string;
  supply: SpellSupply;
  cantripCap: number | null;
  // How many spells the class may hold, and what it does with them.
  listCap: number | null;
  listVerb: "prepare" | "know" | "write in your spellbook";
  maxSpellLevel: number;
  // The reader's words (builder.spellshortage.*); without it the English
  // this pass's tests read.
  t?: (key: string, vars?: Record<string, string | number>) => string;
}): string[] {
  const { className, supply, cantripCap, listCap, listVerb, maxSpellLevel, t } = input;
  const say = (key: string, vars: Record<string, string | number>, english: string) =>
    typeof t === "function" ? t(key, vars) : english;
  const lines: string[] = [];
  const line = (have: number, cap: number, one: string, many: string, may: string) => {
    const word = have === 1 ? one : many;
    const missing = cap - have;
    const havePart = have === 0 ? say("builder.spellshortage.haveNone", {}, "no") : say("builder.spellshortage.haveOnly", { have }, `only ${have}`);
    const taken =
      have === 0
        ? ""
        : have === 1
          ? say("builder.spellshortage.taken", {}, " Take it;")
          : say("builder.spellshortage.takenAll", { have }, ` Take all ${have};`);
    const tail =
      have === 0
        ? say(`builder.spellshortage.tailNone_${missing === 1 ? "one" : "other"}`, { count: missing }, missing === 1 ? " The missing one does not stop you saving." : ` The ${missing} missing ones do not stop you saving.`)
        : missing === 1
          ? say("builder.spellshortage.tailOne", {}, " the missing one does not stop you saving.")
          : say("builder.spellshortage.tailMany", { count: missing }, ` the ${missing} missing ones do not stop you saving.`);
    return say(
      "builder.spellshortage.line",
      { have: havePart, className, word, may, cap, taken, tail },
      `This server's spell list has ${havePart} ${className} ${word}, and you may ${may} ${cap}.${taken}${tail}`,
    );
  };
  if (cantripCap !== null && supply.cantrips < cantripCap) {
    lines.push(
      line(
        supply.cantrips,
        cantripCap,
        say("builder.spellshortage.cantripWordOne", {}, "cantrip"),
        say("builder.spellshortage.cantripWordMany", {}, "cantrips"),
        "know",
      ),
    );
  }
  if (listCap !== null && supply.spells < listCap) {
    const upTo = maxSpellLevel > 1 ? ` up to level ${maxSpellLevel}` : "";
    lines.push(
      line(
        supply.spells,
        listCap,
        `${say("builder.spellshortage.spellWordOne", {}, "spell")}${upTo}`,
        `${say("builder.spellshortage.spellWordMany", {}, "spells")}${upTo}`,
        listVerb,
      ),
    );
  }
  if (lines.length) {
    lines.push(say("builder.spellshortage.install", {}, "Whoever runs this server can add more by installing the content pack."));
  }
  return lines;
}
