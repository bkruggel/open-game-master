// What a Hand card shows at render time, beyond the words its builder keyed:
// a card's name in the reader's language, and an engine condition word as
// the reader reads it. Pure and database-free, like the hand modules; the
// engine-facing half of a card (its id, its intent, the sentences it
// composes) never passes through here.
//
// card.name itself is display-only in the UI flow — the commit keys off
// card.id, and a card's intent carries its own engine names — so a name is
// translated where it is displayed, the way contentName (names.ts) works for
// every other table. What reaches the engine and the protocol stays English.
import type { HandCard } from "@/lib/battlemap/hand-core";
import { contentName } from "@/lib/content/names";
import { resourceDisplayName } from "@/lib/srd/class-resources-fr";
import { translate, type Locale } from "@/lib/messages-logic";

type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);

// ---- condition words ----

// The engine's own condition words a card may carry on its Applies row and
// hand-cond span (hand-play.ts builds the row, HandCardFace the span): the
// words the spell-mechanics rows (mech.condition?.name), the resource tables'
// effects and the authored effects store. Keyed to the reader's word the way
// hand.ts's DTYPE_KEY keys a damage type; the SRD's own fifteen conditions
// are NOT keyed — contentName("conditions") gives them the official French
// print, and English passes through it untouched.
const CONDITION_WORD: Record<string, string> = {
  raging: "table.hand.cond.raging",
  baned: "table.hand.cond.baned",
  banished: "table.hand.cond.banished",
  calmed: "table.hand.cond.calmed",
  commanded: "table.hand.cond.commanded",
  confused: "table.hand.cond.confused",
  dancing: "table.hand.cond.dancing",
  enclosed: "table.hand.cond.enclosed",
  "faerie fire": "table.hand.cond.faerieFire",
  feebleminded: "table.hand.cond.feebleminded",
  levitating: "table.hand.cond.levitating",
  mazed: "table.hand.cond.mazed",
  mocked: "table.hand.cond.mocked",
  slowed: "table.hand.cond.slowed",
  suggested: "table.hand.cond.suggested",
  "aspect of the wyrm: frighten": "table.hand.cond.aspectOfTheWyrm",
  bladesong: "table.hand.cond.bladesong",
  "celestial revelation: heavenly wings": "table.hand.cond.celestialRevelation",
  "fighting spirit": "table.hand.cond.fightingSpirit",
  flying: "table.hand.cond.flying",
  "form of dread": "table.hand.cond.formOfDread",
  "giant's might": "table.hand.cond.giantsMight",
  "manifest mind": "table.hand.cond.manifestMind",
  "mantle of majesty": "table.hand.cond.mantleOfMajesty",
  "spirit projection": "table.hand.cond.spiritProjection",
  "spirit totem: bear": "table.hand.cond.spiritTotem",
  "starry form: archer": "table.hand.cond.starryForm",
  "tentacle of the deep": "table.hand.cond.tentacleOfTheDeep",
  "trance of order": "table.hand.cond.tranceOfOrder",
  // The whole templates ride their parenthetical in the reader's words; a
  // bracket the map does not carry ("unsettled (d8)") keeps it as stored.
  "dark one's own luck (d10)": "table.hand.cond.darkOnesOwnLuck",
  "blessing of the forge (armor)": "table.hand.cond.blessingOfTheForge",
  "storm aura (desert)": "table.hand.cond.stormAuraDesert",
  "storm aura (sea)": "table.hand.cond.stormAuraSea",
  unsettled: "table.hand.cond.unsettled",
};

// A condition word as the reader reads it: the keyed engine words first,
// then a "head (note)" rides its bracket on the head's word, then the SRD's
// official print through the conditions table, then the word as stored. The
// basics' own conditions (Dodging, Grappled…) are keyed by their builders
// already and fall through untouched, as does a card's own Concentration.
export function conditionWord(condition: string, t: T = enT, locale: Locale = "en"): string {
  const raw = condition.trim();
  if (!raw) return raw;
  const key = CONDITION_WORD[raw];
  if (key) return t(key);
  const bracketed = /^(.*\S)\s*\(([^()]*)\)$/.exec(raw);
  if (bracketed) {
    const head = CONDITION_WORD[bracketed[1].trim()];
    if (head) return `${t(head)} (${bracketed[2]})`;
  }
  return contentName("conditions", raw, locale);
}

// ---- card names ----

// A card's name in the reader's language, from the table the card came from.
// The id prefix is the discriminator, not the type: a spell and a class
// feature can both be dealt as mend or ward cards, and the basics, the gear
// moves and the monsters' cards already carry the reader's words from their
// builders (they return unchanged). Attack cards' names are the carried
// lines' own names (sheet equipment), so they read the item tables — a
// carried Shield is the armor row, a Longsword the weapon row, a Potion of
// healing the gear row; a name no table carries (a magic item's engraving,
// a natural weapon, "Unarmed strike") stays as it was spelled.
export function cardDisplayName(card: HandCard, locale: Locale): string {
  if (locale !== "fr" || !card.name) {
    return card.name;
  }
  const id = card.id;
  if (id.startsWith("spell:")) {
    return contentName("spells", card.name, locale);
  }
  if (id.startsWith("feature:")) {
    // The resource id rides on the card: the pool it spends, else the id
    // itself ("feature:second_wind").
    const resourceId = card.pool ?? id.slice("feature:".length);
    return resourceDisplayName(resourceId, locale) ?? card.name;
  }
  if (id.startsWith("rider:")) {
    return contentName("feats", card.name, locale);
  }
  if (id.startsWith("attack:") || id.startsWith("offhand:")) {
    return contentName("items", card.name, locale);
  }
  return card.name;
}
