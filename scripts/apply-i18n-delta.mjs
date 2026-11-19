#!/usr/bin/env node
// Merges a small i18n-delta-fr.json file into src/lib/i18n/fr.json and removes
// the delta file. Designed for Stage 2 of the Option A i18n automation flow.
//
// Expected delta schema:
// {
//   "messages": { "English key": "Traduction française", ... },
//   "contexts": { "English key": { "ctx.name": "Traduction", ... } },
//   "plurals":  { "singular\u0000plural": ["singulier", "pluriel"] }
// }

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DELTA_PATH = path.join(ROOT, process.argv[2] || "i18n-delta-fr.json");
const FR_PATH = path.join(ROOT, "src/lib/i18n/fr.json");

if (!fs.existsSync(DELTA_PATH)) {
  console.error(`apply-i18n-delta: ${DELTA_PATH} not found`);
  process.exit(1);
}

const delta = JSON.parse(fs.readFileSync(DELTA_PATH, "utf8"));
const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));

let applied = 0;

if (delta.messages && typeof delta.messages === "object") {
  fr.messages ??= {};
  for (const [k, v] of Object.entries(delta.messages)) {
    if (typeof v === "string" && v.length > 0) {
      fr.messages[k] = v;
      applied++;
    }
  }
}

if (delta.contexts && typeof delta.contexts === "object") {
  fr.contexts ??= {};
  for (const [key, ctxMap] of Object.entries(delta.contexts)) {
    if (!ctxMap || typeof ctxMap !== "object") continue;
    fr.contexts[key] ??= {};
    for (const [ctx, v] of Object.entries(ctxMap)) {
      if (typeof v === "string" && v.length > 0) {
        fr.contexts[key][ctx] = v;
        applied++;
      }
    }
  }
}

if (delta.plurals && typeof delta.plurals === "object") {
  fr.plurals ??= {};
  for (const [k, v] of Object.entries(delta.plurals)) {
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === "string" && typeof v[1] === "string") {
      fr.plurals[k] = v;
      applied++;
    }
  }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n");
fs.unlinkSync(DELTA_PATH);
console.log(`apply-i18n-delta: applied ${applied} translation(s) to src/lib/i18n/fr.json and removed ${path.basename(DELTA_PATH)}`);
