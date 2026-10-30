// The translation layer's rules: every English key resolves, French falls
// back to English key by key (so an area not yet translated reads English
// and never a placeholder), a plural pair is never half-written, and the
// plural rules each locale keeps are the real ones (English counts "0 days",
// French writes "0 jour"). Pure: no React, no storage, no server.
import assert from "node:assert/strict";
import { register } from "node:module";

register("./lib/register-alias.mjs", import.meta.url);

const { en } = await import("../src/lib/messages/en.ts");
const { fr } = await import("../src/lib/messages/fr.ts");
const { translate, formatMessage, pluralCategory, localeTag } = await import("../src/lib/messages-logic.ts");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
}

test("every English key resolves to words, not itself", () => {
  for (const key of Object.keys(en)) {
    const line = translate("en", key);
    assert.notEqual(line, key, `${key} has no English line`);
    assert.equal(line, en[key]);
  }
});

test("every key a language carries also exists in English", () => {
  for (const key of Object.keys(fr)) {
    assert.ok(key in en, `French carries "${key}" but English does not; the fallback would strand it`);
  }
});

test("French answers in French and falls back to English line by line", () => {
  assert.equal(translate("fr", "menu.settings"), fr["menu.settings"]);
  // While translation is under way, a key only English carries must read the
  // English line; once an area is fully translated this branch has no key to
  // prove itself with, and full coverage is the thing to assert instead.
  const untranslated = Object.keys(en).find((key) => !(key in fr));
  if (untranslated) {
    assert.equal(translate("fr", untranslated), en[untranslated]);
  } else {
    assert.equal(Object.keys(fr).length, Object.keys(en).length, "French carries keys English does not");
  }
});

test("a plural pair is never half-written", () => {
  for (const [locale, dictionary] of [["en", en], ["fr", fr]]) {
    for (const key of Object.keys(dictionary)) {
      if (key.endsWith("_one") || key.endsWith("_other")) {
        const base = key.replace(/_(one|other)$/, "");
        assert.ok(`${base}_one` in dictionary, `${locale}: "${base}_one" is missing`);
        assert.ok(`${base}_other` in dictionary, `${locale}: "${base}_other" is missing`);
      }
    }
  }
});

test("each locale counts zero its own way", () => {
  assert.equal(pluralCategory("en", 0), "other");
  assert.equal(pluralCategory("en", 1), "one");
  assert.equal(pluralCategory("en", 2), "other");
  assert.equal(pluralCategory("fr", 0), "one");
  assert.equal(pluralCategory("fr", 1), "one");
  assert.equal(pluralCategory("fr", 2), "other");
});

test("a plural key picks its form by the locale's rule and fills the count", () => {
  const key = "settings.deletion.graceCopy";
  assert.match(translate("en", key, { count: 1 }), /\b1 day\b/);
  assert.match(translate("en", key, { count: 14 }), /\b14 days\b/);
  assert.match(translate("fr", key, { count: 1 }), /1 jour\b/);
  assert.match(translate("fr", key, { count: 14 }), /14 jours\b/);
  assert.match(translate("fr", key, { count: 0 }), /0 jour\b/);
});

test("placeholders fill, and a missing variable stays visible", () => {
  assert.equal(formatMessage("Signed in as {name}", { name: "Kael" }), "Signed in as Kael");
  assert.equal(formatMessage("Signed in as {name}", {}), "Signed in as {name}");
  assert.equal(formatMessage("No slots here", { name: "Kael" }), "No slots here");
});

test("an unknown key renders as itself, where it can be grepped", () => {
  assert.equal(translate("en", "no.such.key"), "no.such.key");
  assert.equal(translate("fr", "no.such.key"), "no.such.key");
});

test("the locale's tag formats a date the locale's way", () => {
  assert.equal(localeTag("en"), "en-US");
  assert.equal(localeTag("fr"), "fr-FR");
  const iso = "2026-03-07T12:00:00Z";
  const english = new Date(iso).toLocaleDateString(localeTag("en"), { month: "long", day: "numeric" });
  const french = new Date(iso).toLocaleDateString(localeTag("fr"), { month: "long", day: "numeric" });
  assert.match(english, /March/);
  assert.match(french, /mars/);
});

console.log(`test-messages: ${passed} tests, all passed.`);
