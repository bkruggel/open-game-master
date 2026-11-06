"use client";

import { contentName } from "@/lib/content/names";
import { useLocale, useT } from "@/lib/locale";
import { AbilityText } from "./AbilityText";

// The card faces' words (cardFaces.ts, lineage.ts), in the reader's
// language: the pure modules keep the English faces the search matches and
// the tests pin, and the grid reads them back through this vocabulary at
// render — the same deal the content names get (src/lib/content/names.ts).
// A word the vocabulary lacks passes through unchanged, so a workshop
// species choice's own words still print.

const ROLES = ["tank", "dps", "healer", "support", "control", "utility"] as const;
const HP = [
  ["very low hp", "builder.face.hp.veryLow"],
  ["low hp", "builder.face.hp.low"],
  ["medium hp", "builder.face.hp.medium"],
  ["high hp", "builder.face.hp.high"],
  ["very high hp", "builder.face.hp.veryHigh"],
] as const;
const TAGLINES = [
  ["adaptable", "builder.face.adaptable"],
  ["yours to shape", "builder.face.yoursToShape"],
  ["built to endure", "builder.face.tag.built"],
  ["quick and sure", "builder.face.tag.quick"],
  ["hard to put down", "builder.face.tag.hard"],
  ["studied and sharp", "builder.face.tag.studied"],
  ["watchful", "builder.face.tag.watchful"],
  ["commands a room", "builder.face.tag.commands"],
] as const;

// A class name as the reader reads it (contentName("classes", ...)), for the
// names a play line or a suits line carries.
function nameWords(names: string, locale: ReturnType<typeof useLocale>): string {
  return names
    .split("/")
    .map((name) => contentName("classes", name.trim(), locale))
    .join("/");
}

export function CardText({ text }: { text: string }) {
  const t = useT();
  const locale = useLocale();
  const flat = text.trim();
  const lower = flat.toLowerCase();

  const exact = ROLES.find((role) => role === lower);
  if (exact) {
    return t(`builder.face.role.${exact}`);
  }
  const hp = HP.find(([word]) => word === lower);
  if (hp) {
    return t(hp[1]);
  }
  const tagline = TAGLINES.find(([word]) => word === lower);
  if (tagline) {
    return t(tagline[1]);
  }
  if (lower === "core class") {
    return t("builder.face.core");
  }
  if (lower === "easy to learn") {
    return t("builder.play.easy");
  }
  if (lower === "suits any class") {
    return t("builder.face.suitsAny");
  }
  if (lower === "choose a bonus") {
    return t("builder.face.chooseABonus");
  }

  // "{A}/{B} mix" and "{A} style", their names read in the reader's language.
  const mix = /^(.+)\s+mix$/i.exec(flat);
  if (mix?.[1]) {
    return t("builder.face.mix", { like: nameWords(mix[1], locale) });
  }
  const style = /^(.+)\s+style$/i.exec(flat);
  if (style?.[1]) {
    return t("builder.face.style", { like: nameWords(style[1], locale) });
  }
  // "Fighter style (suggested)" — the suffix rides on whatever the line says.
  const suggested = /^(.*?)\s*\(suggested\)$/i.exec(flat);
  if (suggested && suggested[1] !== undefined) {
    return (
      <Suggested text={suggested[1]} />
    );
  }
  // "Suits Bard, Sorcerer" — the names read in the reader's language.
  const suits = /^suits\s+(.+)$/i.exec(flat);
  if (suits?.[1]) {
    return t("builder.face.suits", { list: suits[1].split(",").map((name) => contentName("classes", name.trim(), locale)).join(", ") });
  }
  // "Choose +1 / +1", "All +1" — the bonuses themselves are signs.
  const choose = /^choose\s+([+−-][\d\s/]+)$/i.exec(flat);
  if (choose?.[1]) {
    return t("builder.face.chooseBonus", { bonus: choose[1].trim() });
  }
  const all = /^all\s+([+−-]\d+)$/i.exec(flat);
  if (all?.[1]) {
    return t("builder.face.allBonus", { bonus: all[1] });
  }
  // "INT caster" — the word reads in the reader's language and the code
  // stays a code: AbilityText wraps it so a screen reader hears the name.
  const caster = /^(str|dex|con|int|wis|cha)\s+caster$/i.exec(flat);
  if (caster?.[1]) {
    return <AbilityText text={t("builder.face.casterChip", { code: caster[1].toUpperCase() })} />;
  }
  // "High HP, d10" — the words read, the die stays a die.
  const hpDie = /^(very low|low|medium|high|very high) hp,\s*d(\d+)$/i.exec(flat);
  if (hpDie) {
    const word = HP.find(([entry]) => entry === `${hpDie[1]} hp`);
    if (word) {
      return `${t(word[1])}, d${hpDie[2]}`;
    }
  }
  return <AbilityText text={text} />;
}

// The "(suggested)" suffix on a play line: the line reads first, the suffix
// says itself (builder.meta.suggested), and a code inside keeps its abbr.
function Suggested({ text }: { text: string }) {
  const t = useT();
  return (
    <>
      <CardText text={text} />
      {t("builder.meta.suggested")}
    </>
  );
}
