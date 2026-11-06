import type { CreateSheetInput } from "@/lib/schemas/sheet";
import { owedChoices } from "@/lib/srd/owed-choices";
import { textKey } from "@/lib/language/text-logic";
import type { OwedPicks } from "@/lib/characters/seat-picks";
import { classDisplayNameFor, classLevelWords } from "@/lib/characters/class-words";
import type { Locale } from "@/lib/messages-logic";
import { translate } from "@/lib/messages-logic";

// The shape of a translator, as the pure builders take it
// (src/lib/story-window.ts): the reading surface passes its own, so the
// confirm sheet's sentences read the request's language.
type T = (key: string, vars?: Record<string, string | number>) => string;
const enT: T = (key, vars) => translate("en", key, vars);

// What taking a seat does to a hero, in words, for the confirm sheet a
// player reads before joining (backlog F6, JoinConfirmDialog.tsx). It
// compares the sheet as stored with the sheet the table's door admitted
// (src/lib/characters/seat-preview.ts), so it describes the real join and
// invents nothing: the adapting is src/lib/characters/adapt.ts, the rules
// check is src/lib/characters/admit.ts.
//
// Pure, for scripts/test-seat-confirm.mjs.

export type JoinChanges = {
  // One line per change, in the order a player cares about.
  changes: string[];
  // Choices the level earned and the hero has not made: taken by the first
  // level-up, as the character sheet says (owedChoices).
  owed: string[];
};

// What the confirm sheet reads (POST /sheet/preview).
export type JoinPreview = JoinChanges & {
  name: string;
  fromLevel: number;
  toLevel: number;
  // Whether the table's rules let the hero in, and what stops it if not.
  ok: boolean;
  problems: string[];
  // A table that rolls hit points rolls them when the seat is taken, so the
  // number shown here is one throw, not the one the hero keeps.
  rollsHp: boolean;
  // What the confirm sheet may pick of the owed choices before the hero
  // seats (src/lib/characters/seat-picks.ts): read off the hero as it seats
  // with nothing picked, so the pickers stay put while picks are made.
  picks?: OwedPicks;
};

type Sheet = Pick<
  CreateSheetInput,
  "class" | "subclass" | "classes" | "maxHp" | "asiChoices" | "feats" | "features" | "proficiencies" | "spellcasting"
>;

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

// The words the slot line counts with, in the reader's language where the
// dictionaries carry them (« 2 × 1er, 1 × 2e »).
export function ordinalOf(t: T, level: number): string {
  return t(`join.ordinal${level}`) || ORDINAL[level] || String(level);
}

function spellsOf(sheet: Sheet): string[] {
  const casting = sheet.spellcasting;
  if (!casting) {
    return [];
  }
  const lists = [
    casting.cantrips,
    casting.known,
    casting.prepared,
    casting.spellbook ?? [],
    ...(casting.casters ?? []).flatMap((caster) => [caster.cantrips, caster.known, caster.prepared, caster.spellbook ?? []]),
  ];
  const seen = new Map<string, string>();
  for (const name of lists.flat()) {
    const key = textKey(name);
    if (key && !seen.has(key)) {
      seen.set(key, name.trim());
    }
  }
  return [...seen.values()];
}

function slotLine(sheet: Sheet, t: T): string {
  const slots = Object.entries(sheet.spellcasting?.slots ?? {})
    .filter(([, slot]) => slot.max > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([level, slot]) => `${slot.max} × ${ordinalOf(t, Number(level))}`);
  return slots.join(", ");
}

// "fighter 3 / plague doctor 2": the classes in words, as the rest of the
// confirmation reads them — in the reader's language where the official-name
// maps carry it (class-words.ts).
function classLine(sheet: Sheet, level: number, locale: Locale): string {
  return classLevelWords({ class: sheet.class, level, classes: sheet.classes }, (id) => classDisplayNameFor(id, locale));
}

export function joinChanges(
  stored: Sheet,
  storedLevel: number,
  seated: Sheet,
  tableLevel: number,
  t: T = enT,
  locale: Locale = "en",
): JoinChanges {
  const changes: string[] = [];
  if (storedLevel === tableLevel) {
    changes.push(t("join.changes.ownLevel", { level: tableLevel }));
  } else if (storedLevel < tableLevel) {
    changes.push(t("join.changes.up", { from: storedLevel, to: tableLevel }));
  } else {
    changes.push(t("join.changes.down", { level: tableLevel, from: storedLevel }));
  }

  const storedClasses = classLine(stored, storedLevel, locale);
  const seatedClasses = classLine(seated, tableLevel, locale);
  if ((stored.classes ?? []).length > 1 && storedClasses !== seatedClasses) {
    changes.push(t("join.changes.classes", { stored: storedClasses, seated: seatedClasses }));
  }

  if (stored.maxHp !== seated.maxHp) {
    changes.push(t("join.changes.hp", { stored: stored.maxHp, seated: seated.maxHp }));
  }

  const givenBack = (stored.asiChoices ?? []).length - (seated.asiChoices ?? []).length;
  if (givenBack > 0) {
    const seatedFeats = new Set((seated.feats ?? []).map(textKey));
    const feats = (stored.feats ?? []).filter((feat) => !seatedFeats.has(textKey(feat)));
    changes.push(
      feats.length
        ? t(`join.changes.asiWith_${givenBack === 1 ? "one" : "other"}`, { count: givenBack, feats: feats.join(", ") })
        : t(`join.changes.asi_${givenBack === 1 ? "one" : "other"}`, { count: givenBack }),
    );
  }

  const seatedSpells = new Set(spellsOf(seated).map(textKey));
  const lostSpells = spellsOf(stored).filter((name) => !seatedSpells.has(textKey(name)));
  if (stored.spellcasting && !seated.spellcasting) {
    changes.push(t("join.changes.losesSpellcasting"));
  } else if (lostSpells.length) {
    changes.push(t(`join.changes.spells_${lostSpells.length === 1 ? "one" : "other"}`, { count: lostSpells.length, spells: lostSpells.join(", ") }));
  }

  const storedSlots = slotLine(stored, t);
  const seatedSlots = slotLine(seated, t);
  if (seated.spellcasting && storedSlots !== seatedSlots) {
    changes.push(seatedSlots ? t("join.changes.slots", { slots: seatedSlots }) : t("join.changes.noSlots"));
  }

  // Owed choices read the sheet at the level it plays; the seated sheet's
  // own level field is the table's once stored, so it is given here.
  const owed = owedChoices({
    class: seated.class,
    subclass: seated.subclass ?? "",
    level: tableLevel,
    classes: seated.classes,
    features: seated.features ?? [],
    proficiencies: seated.proficiencies,
  } as Parameters<typeof owedChoices>[0]);

  return { changes, owed };
}
