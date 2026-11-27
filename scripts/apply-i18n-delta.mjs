#!/usr/bin/env node
// Merges a small i18n-delta-fr.json file (and optionally upstream main's
// src/lib/i18n/fr.json) into src/lib/i18n/fr.json and removes the delta file.
//
// Usage:
//   node apply-i18n-delta.mjs [i18n-delta-fr.json] [upstream-fr.json]
//   node apply-i18n-delta.mjs --upstream-only <upstream-fr.json>

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FR_PATH = path.join(ROOT, "src/lib/i18n/fr.json");
const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));

function mergeCatalog(target, source) {
  let count = 0;
  if (source.messages && typeof source.messages === "object") {
    target.messages ??= {};
    for (const [k, v] of Object.entries(source.messages)) {
      if (typeof v === "string" && v.length > 0 && target.messages[k] !== v) {
        target.messages[k] = v;
        count++;
      }
    }
  }
  if (source.contexts && typeof source.contexts === "object") {
    target.contexts ??= {};
    for (const [key, ctxMap] of Object.entries(source.contexts)) {
      if (!ctxMap || typeof ctxMap !== "object") continue;
      target.contexts[key] ??= {};
      for (const [ctx, v] of Object.entries(ctxMap)) {
        if (typeof v === "string" && v.length > 0 && target.contexts[key][ctx] !== v) {
          target.contexts[key][ctx] = v;
          count++;
        }
      }
    }
  }
  if (source.plurals && typeof source.plurals === "object") {
    target.plurals ??= {};
    for (const [k, v] of Object.entries(source.plurals)) {
      if (
        Array.isArray(v) &&
        v.length === 2 &&
        typeof v[0] === "string" &&
        typeof v[1] === "string" &&
        JSON.stringify(target.plurals[k]) !== JSON.stringify(v)
      ) {
        target.plurals[k] = v;
        count++;
      }
    }
  }
  return count;
}

const args = process.argv.slice(2);
if (args[0] === "--upstream-only") {
  const upstreamPath = path.resolve(ROOT, args[1]);
  const upstreamFr = JSON.parse(fs.readFileSync(upstreamPath, "utf8"));
  const merged = mergeCatalog(fr, upstreamFr);
  if (merged > 0) {
    fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n");
  }
  console.log(`apply-i18n-delta: synced ${merged} upstream translation(s) into src/lib/i18n/fr.json`);
  process.exit(0);
}

const DELTA_PATH = path.join(ROOT, args[0] || "i18n-delta-fr.json");
const UPSTREAM_PATH = args[1] ? path.resolve(ROOT, args[1]) : null;

if (!fs.existsSync(DELTA_PATH)) {
  console.error(`apply-i18n-delta: ${DELTA_PATH} not found`);
  process.exit(1);
}

const delta = JSON.parse(fs.readFileSync(DELTA_PATH, "utf8"));
let applied = mergeCatalog(fr, delta);

if (UPSTREAM_PATH && fs.existsSync(UPSTREAM_PATH)) {
  const upstreamFr = JSON.parse(fs.readFileSync(UPSTREAM_PATH, "utf8"));
  const synced = mergeCatalog(fr, upstreamFr);
  console.log(`apply-i18n-delta: synced ${synced} upstream translation(s) from ${path.basename(UPSTREAM_PATH)}`);
  applied += synced;
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n");
fs.unlinkSync(DELTA_PATH);
console.log(`apply-i18n-delta: applied ${applied} translation(s) to src/lib/i18n/fr.json and removed ${path.basename(DELTA_PATH)}`);
