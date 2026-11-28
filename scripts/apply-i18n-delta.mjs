#!/usr/bin/env node
// Merges a small i18n-delta-fr.json file (and optionally upstream main's
// src/lib/i18n/fr.json and es.json) into src/lib/i18n/fr.json (and keeps
// src/lib/i18n/es.json in key parity per scripts/test-i18n-gettext.mjs)
// and removes the delta file.
//
// Usage:
//   node apply-i18n-delta.mjs [i18n-delta-fr.json] [upstream-fr.json] [upstream-es.json]
//   node apply-i18n-delta.mjs --upstream-only <upstream-fr.json> [upstream-es.json]

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FR_PATH = path.join(ROOT, "src/lib/i18n/fr.json");
const ES_PATH = path.join(ROOT, "src/lib/i18n/es.json");
const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));
const es = fs.existsSync(ES_PATH) ? JSON.parse(fs.readFileSync(ES_PATH, "utf8")) : null;

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

function ensureEsParity(frCatalog, esCatalog) {
  if (!esCatalog) return 0;
  let backfilled = 0;
  esCatalog.messages ??= {};
  for (const key of Object.keys(frCatalog.messages ?? {})) {
    if (!Object.hasOwn(esCatalog.messages, key)) {
      esCatalog.messages[key] = key;
      backfilled++;
    }
  }
  esCatalog.contexts ??= {};
  for (const [key, ctxMap] of Object.entries(frCatalog.contexts ?? {})) {
    for (const ctx of Object.keys(ctxMap ?? {})) {
      esCatalog.contexts[key] ??= {};
      if (!Object.hasOwn(esCatalog.contexts[key], ctx)) {
        esCatalog.contexts[key][ctx] = key;
        backfilled++;
      }
    }
  }
  esCatalog.plurals ??= {};
  for (const key of Object.keys(frCatalog.plurals ?? {})) {
    if (!Object.hasOwn(esCatalog.plurals, key)) {
      const [one, other] = key.split("\0");
      esCatalog.plurals[key] = [one, other ?? one];
      backfilled++;
    }
  }
  return backfilled;
}

const args = process.argv.slice(2);
if (args[0] === "--upstream-only") {
  const upstreamFrPath = path.resolve(ROOT, args[1]);
  const upstreamFr = JSON.parse(fs.readFileSync(upstreamFrPath, "utf8"));
  const mergedFr = mergeCatalog(fr, upstreamFr);
  if (mergedFr > 0) {
    fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n");
  }
  let mergedEs = 0;
  if (es && args[2] && fs.existsSync(path.resolve(ROOT, args[2]))) {
    const upstreamEs = JSON.parse(fs.readFileSync(path.resolve(ROOT, args[2]), "utf8"));
    mergedEs += mergeCatalog(es, upstreamEs);
  }
  mergedEs += ensureEsParity(fr, es);
  if (es && mergedEs > 0) {
    fs.writeFileSync(ES_PATH, JSON.stringify(es, null, 2) + "\n");
  }
  console.log(`apply-i18n-delta: synced ${mergedFr} FR and ${mergedEs} ES entries`);
  process.exit(0);
}

const DELTA_PATH = path.join(ROOT, args[0] || "i18n-delta-fr.json");
const UPSTREAM_FR_PATH = args[1] ? path.resolve(ROOT, args[1]) : null;
const UPSTREAM_ES_PATH = args[2] ? path.resolve(ROOT, args[2]) : null;

if (!fs.existsSync(DELTA_PATH)) {
  console.error(`apply-i18n-delta: ${DELTA_PATH} not found`);
  process.exit(1);
}

const delta = JSON.parse(fs.readFileSync(DELTA_PATH, "utf8"));
let applied = mergeCatalog(fr, delta);

if (UPSTREAM_FR_PATH && fs.existsSync(UPSTREAM_FR_PATH)) {
  const upstreamFr = JSON.parse(fs.readFileSync(UPSTREAM_FR_PATH, "utf8"));
  const synced = mergeCatalog(fr, upstreamFr);
  console.log(`apply-i18n-delta: synced ${synced} upstream FR translation(s)`);
  applied += synced;
}

let esUpdated = 0;
if (es) {
  if (delta.es && typeof delta.es === "object") {
    esUpdated += mergeCatalog(es, delta.es);
  }
  if (UPSTREAM_ES_PATH && fs.existsSync(UPSTREAM_ES_PATH)) {
    const upstreamEs = JSON.parse(fs.readFileSync(UPSTREAM_ES_PATH, "utf8"));
    esUpdated += mergeCatalog(es, upstreamEs);
  }
  esUpdated += ensureEsParity(fr, es);
  if (esUpdated > 0) {
    fs.writeFileSync(ES_PATH, JSON.stringify(es, null, 2) + "\n");
    console.log(`apply-i18n-delta: synced/backfilled ${esUpdated} ES key(s) for parity`);
  }
}

fs.writeFileSync(FR_PATH, JSON.stringify(fr, null, 2) + "\n");
fs.unlinkSync(DELTA_PATH);
console.log(`apply-i18n-delta: applied ${applied} FR translation(s) to src/lib/i18n/fr.json and removed ${path.basename(DELTA_PATH)}`);
