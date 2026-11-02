// An official SRD name in the reader's language, at render time.
//
// The interface's language is client state (src/lib/locale.ts) and the
// server's content routes answer in English, so a name is translated where
// it is displayed: a row's or a stored name is looked up in the official
// French SRD 5.1 names (names-fr.ts, generated from Wizards of the Coast's
// SRD_CC_v5.1_FR.pdf). English is the source and the fallback — a name the
// maps do not carry (a subrace, a homebrew entry, a genre weapon) reads as
// it always did. What reaches the engine, the protocol and the DM's prompts
// stays English: only the words on screen change, the way skillLabel
// (src/lib/srd/index.ts) already works for skills.

import { textKey } from "@/lib/language/text-logic";
import type { Locale } from "@/lib/messages-logic";
import { FR_NAMES_BY_TABLE } from "./names-fr";

// The tables the maps carry, as the helper's callers name them.
export type FrNamesTable =
  | "spells"
  | "weapons"
  | "armor"
  | "gear"
  | "conditions"
  | "species"
  | "backgrounds"
  | "monsters"
  | "classes"
  | "classFeatures";

// A content row as the API routes and the library send it, narrowed to the
// fields a name lookup reads.
export type NamedRow = {
  slug?: string;
  name: string;
  source?: string;
};

// The gear table is keyed by the SRD gear's gearKey (adventuring-gear.ts):
// the text key with the apostrophes dropped, so "Alchemist's Fire (flask)"
// is "alchemists fire flask". Kept here rather than imported so the helper
// stays light; the two must move together.
function gearKey(name: string): string {
  return textKey(name.replace(/['‘’ʼ´]/g, ""));
}

// A name as the v1 importer writes a slug: lowercase, every run of
// non-letters a hyphen ("Half Elf" is "half-elf", "half_elf" too). The
// tables' own keys are slugs of this shape (spells, monsters, species,
// backgrounds, classes, features, conditions) or the Open5e row slug
// (weapons, armor).
function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// The three crossbows: the app writes "Light Crossbow", Open5e's row slug
// reads "crossbow-light". Every other weapon and armor key is the plain
// slug of the name, so only these three need a bridge.
const WEAPON_KEY_OVERRIDES = new Map<string, string>(
  Object.entries({
    "light-crossbow": "crossbow-light",
    "hand-crossbow": "crossbow-hand",
    "heavy-crossbow": "crossbow-heavy",
  }),
);

// What a carried item is looked up as: the gear first (a rope, a backpack),
// then the weapon and armor tables (a Mace carried is the weapon). An item
// the maps do not carry stays English.
const ITEM_TABLES: readonly FrNamesTable[] = ["gear", "weapons", "armor"];

// One table's names, by its key. A Map rather than the generated record
// itself: the lookup stays a data read, not a site the tables' key shape
// has to answer for.
const TABLES = new Map<string, Record<string, string>>(Object.entries(FR_NAMES_BY_TABLE));

function lookup(table: FrNamesTable, key: string): string | null {
  if (!key) {
    return null;
  }
  const names = TABLES.get(table);
  if (!names) {
    return null;
  }
  if (table === "weapons") {
    const overridden = WEAPON_KEY_OVERRIDES.get(key);
    if (overridden && names[overridden]) {
      return names[overridden];
    }
  }
  return names[key] ?? null;
}

// The keys a table tries, in order: a row's own slug first (a third-party
// document may slugify differently, and the row's slug is what its pack
// calls it — the pack's rows are homebrew or a translation the pack made,
// and neither is translated here), then the name as the tables spell it.
function keysFor(table: FrNamesTable, row: NamedRow): string[] {
  if (table === "gear") {
    // A pack row's slug ("alchemists-fire-flask") reads as a gearKey with
    // its hyphens as spaces, so both spellings are tried.
    return [
      gearKey(row.name),
      ...(row.slug ? [slugKey(row.slug).replace(/-/g, " ")] : []),
    ];
  }
  return [...(row.slug ? [slugKey(row.slug)] : []), slugKey(row.name)];
}

// An official name beside its English one. `ref` is a content row (matched
// by its slug, its English name, and never when the row is homebrew) or a
// stored English name (matched by slug or gearKey). `table` is one of the
// maps' tables, or "items" for the sheet's carried gear, which reads gear,
// weapons and armor. Returns the name unchanged unless the locale's map
// carries it.
export function contentName(
  table: FrNamesTable | "items",
  ref: NamedRow | string,
  locale: Locale,
): string {
  const row: NamedRow = typeof ref === "string" ? { name: ref } : ref;
  if (locale !== "fr" || !row.name || (row.source && row.source !== "open5e")) {
    return row.name;
  }
  const tables: readonly FrNamesTable[] = table === "items" ? ITEM_TABLES : [table];
  for (const each of tables) {
    for (const key of keysFor(each, row)) {
      const hit = lookup(each, key);
      if (hit) {
        return hit;
      }
    }
  }
  return row.name;
}

// A class feature's name ("Channel Divinity: Turn Undead") in the reader's
// language: the maps key a feature by its class and the feature's name
// slugified the way the v1 importer slugs a heading
// ("cleric:channel-divinity-turn-undead"). A feature the class's map does
// not carry (a subclass feature, a workshop class's) stays English.
export function classFeatureName(classId: string, featureName: string, locale: Locale): string {
  if (locale !== "fr" || !featureName) {
    return featureName;
  }
  const key = `${classId.trim().toLowerCase()}:${slugKey(featureName)}`;
  return FR_NAMES_BY_TABLE.classFeatures[key] ?? featureName;
}
