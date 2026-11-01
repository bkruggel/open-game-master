// The pure side of translation (no React, no storage): looking a key up in
// the dictionaries, filling placeholders, and picking a plural form by the
// locale's own rule. The client store that components read lives in
// locale.ts; this module exists so a test can import the rules directly.
import { en, type MessageKey } from "./messages/en.ts";
import { fr } from "./messages/fr.ts";

export type { MessageDictionary, MessageKey } from "./messages/en";

export type Locale = "en" | "fr";
export type MessageVars = Record<string, string | number>;

// English and French agree that one thing takes the singular and several the
// plural, but they part ways at zero: English counts "0 days", French writes
// "0 jour". These are the two locales' CLDR rules, cut down to the forms the
// dictionaries actually use.
export function pluralCategory(locale: Locale, count: number): "one" | "other" {
  if (!Number.isFinite(count)) {
    return "other";
  }
  return locale === "fr" ? (count <= 1 ? "one" : "other") : count === 1 ? "one" : "other";
}

// Fills `{name}` slots from vars; an unfilled slot stays visible, so a
// missing variable reads as a bug in the string, not as silently lost words.
export function formatMessage(template: string, vars?: MessageVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (slot, name: string) =>
    name in vars ? String(vars[name]) : slot,
  );
}

// Both dictionaries, keyed by MessageKey to the same width: English's lines
// are the literals they are, but a lookup only ever needs "a string or
// nothing", and French is Partial by design.
const DICTIONARIES: Record<Locale, Partial<Record<MessageKey, string>>> = { en, fr };

// One lookup, the whole story: the locale's line if it has one, else the
// English line (so an untranslated key still reads), else the key itself
// (so a typo in code shows up as the key on screen where it can be grepped).
// The key also accepts a plural base ("settings.deletion.graceCopy") whose
// _one/_other forms live in the dictionaries; the `string & {}` keeps the
// autocomplete while letting that base through.
export function translate(locale: Locale, key: MessageKey | (string & {}), vars?: MessageVars): string {
  const dictionary = DICTIONARIES[locale];
  let templateKey: string = key;
  if (vars && typeof vars.count === "number") {
    const pluralKey = `${key}_${pluralCategory(locale, vars.count)}`;
    if (pluralKey in dictionary || pluralKey in en) {
      templateKey = pluralKey;
    }
  }
  const template = dictionary[templateKey as MessageKey] ?? en[templateKey as MessageKey];
  if (template === undefined) {
    return templateKey;
  }
  return formatMessage(template, vars);
}

// The BCP 47 tag a locale resolves to, for toLocaleDateString and friends.
export function localeTag(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-US";
}
