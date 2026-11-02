// Merges the official French SRD 5.1 name maps (scripts/data/fr-names/) into
// the generated module the render helper reads (src/lib/content/names-fr.ts).
//
// The maps are extracted and verified from SRD_CC_v5.1_FR.pdf, Wizards of the
// Coast's official French translation of the System Reference Document 5.1
// (CC-BY-4.0). Keys follow each table's own convention:
//
// - spells / monsters / species / backgrounds: the row slug ("acid-arrow",
//   "adult-black-dragon");
// - weapons / armor: the Open5e row slug ("crossbow-light", "chain-mail");
// - gear: the gearKey of the SRD gear's English name
//   (src/lib/srd/adventuring-gear.ts) — lowercase words, punctuation and
//   apostrophes dropped ("alchemists fire flask");
// - conditions: the lowercase condition id ("blinded");
// - classes: 12 bare class ids ("cleric") plus class-feature keys of the
//   canonical form the render helper slugs a display name to
//   ("cleric:bonus-proficiency-heavy-armor", "cleric:channel-divinity-1-rest",
//   "warlock:invocation-agonizing-blast"): lowercase, punctuation deleted,
//   every other run of non-alphanumeric characters one hyphen;
// - speciesTraits: "<speciesSlug>:<traitNameSlugified>" ("wood-elf:keen-senses"),
//   the species the way srdRaceId spells it, hyphenated;
// - backgroundFeatures: "<backgroundSlug>:<featureNameSlugified>"
//   ("acolyte:shelter-of-the-faithful");
// - subclasses: "<classSlug>:<subclassSlug>" ("cleric:life-domain"), whole
//   name and bare form ("cleric:life").
//
// Run: node scripts/build-names-fr.mjs   (the generated file is committed, so
// the app builds without running any script.)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "data", "fr-names");
const outFile = join(here, "..", "src", "lib", "content", "names-fr.ts");

// table -> generated export name.
const TABLES = {
  spells: "SPELL_NAMES_FR",
  weapons: "WEAPON_NAMES_FR",
  armor: "ARMOR_NAMES_FR",
  gear: "GEAR_NAMES_FR",
  conditions: "CONDITION_NAMES_FR",
  species: "SPECIES_NAMES_FR",
  backgrounds: "BACKGROUND_NAMES_FR",
  monsters: "MONSTER_NAMES_FR",
  classes: "CLASS_NAMES_FR",
  classFeatures: "CLASS_FEATURE_NAMES_FR",
  speciesTraits: "SPECIES_TRAIT_NAMES_FR",
  backgroundFeatures: "BACKGROUND_FEATURE_NAMES_FR",
  subclasses: "SUBCLASS_NAMES_FR",
};

const read = (table) => JSON.parse(readFileSync(join(dataDir, `${table}-fr.json`), "utf8"));

const raw = {
  spells: read("spells"),
  weapons: read("weapons"),
  armor: read("armor"),
  gear: read("gear"),
  conditions: read("conditions"),
  species: read("species"),
  backgrounds: read("backgrounds"),
  monsters: read("monsters"),
};

// The classes file carries the 12 bare class names beside the feature keys
// ("cleric:..."), which the extractor wrote into one JSON; split them.
const classEntries = Object.entries(read("classes"));
const classes = {};
const classFeatures = {};
for (const [key, name] of classEntries) {
  if (key.includes(":")) {
    classFeatures[key] = name;
  } else {
    classes[key] = name;
  }
}

const tables = {
  ...raw,
  classes,
  classFeatures,
  speciesTraits: read("species-traits"),
  backgroundFeatures: read("background-features"),
  subclasses: read("subclasses"),
};

const total = Object.values(tables).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
if (total !== 1222) {
  throw new Error(`expected 1,222 name pairs, read ${total}`);
}

const tsLiteral = (value) => JSON.stringify(value);
const record = (name, entries) =>
  `export const ${name}: Record<string, string> = {\n${Object.entries(entries)
    .map(([key, value]) => `  ${tsLiteral(key)}: ${tsLiteral(value)},`)
    .join("\n")}\n};\n`;

const counts = Object.fromEntries(Object.entries(tables).map(([table, entries]) => [table, Object.keys(entries).length]));

const header = `// NOMS OFFICIELS FRANÇAIS du Document de Référence du Système 5.1 de
// Wizards of the Coast (CC-BY-4.0), extraits de SRD_CC_v5.1_FR.pdf — la
// traduction française officielle des noms du SRD 5.1 (sorts, monstres,
// espèces, Historiques, classes et leurs aptitudes, conditions, armes,
// armures et équipement d'aventurier). Généré par scripts/build-names-fr.mjs
// depuis scripts/data/fr-names/ ; NE PAS ÉDITER À LA MAIN (regénérer).
//
// Les clés suivent la convention de chaque table (voir le script) : le slug
// de la ligne, ou le gearKey du nom anglais, ou "<classe>:<aptitude>" pour
// les aptitudes de classe. L'aide qui les lit est src/lib/content/names.ts.
`;

const body = [
  ...Object.entries(TABLES).map(([table, name]) => record(name, tables[table])),
  `// The combined lookup the render helper reads, one table at a time. Typed`,
  `// as a plain string-keyed record: the table names are data here, and the`,
  `// narrow union of tables lives in src/lib/content/names.ts.`,
  `export const FR_NAMES_BY_TABLE: Record<string, Record<string, string>> = {`,
  ...Object.keys(TABLES).map((table) => `  ${table}: ${TABLES[table]},`),
  `};`,
  ``,
  `// 1,222 official pairs in total, by table.`,
  `export const FR_NAME_COUNTS: Record<string, number> = ${JSON.stringify(counts)};`,
].join("\n");

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, header + "\n" + body, "utf8");

console.log(
  `names-fr.ts written: ${total} pairs — ` +
    Object.entries(counts)
      .map(([table, count]) => `${table} ${count}`)
      .join(", "),
);
