#!/usr/bin/env node
// Scans src/ with the TypeScript AST for t(...) and tp(...) calls whose keys
// are missing from src/lib/i18n/fr.json.
//
// Options:
//   --diff <ref>  Also report unwrapped JSX text and UI string props on lines
//                 added in `git diff -U0 <ref>..HEAD -- src/`.
//   --strict      Exit with code 1 if any missing t/tp keys are found.
//   --json        Emit machine-readable JSON summary (for CI / GitHub Actions).

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const ROOT = process.cwd();
const FR_PATH = path.join(ROOT, "src/lib/i18n/fr.json");
const SRC_DIR = path.join(ROOT, "src");

const args = process.argv.slice(2);
const diffIdx = args.indexOf("--diff");
const diffRef = diffIdx !== -1 ? args[diffIdx + 1] : null;
const strict = args.includes("--strict");
const jsonOut = args.includes("--json");

const fr = JSON.parse(fs.readFileSync(FR_PATH, "utf8"));
const missing = [];
const unwrapped = [];

function getContextProp(arg) {
  if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
  for (const prop of arg.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === "context" &&
      ts.isStringLiteralLike(prop.initializer)
    ) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

function hasKey(key, ctx) {
  if (ctx) return Boolean(fr.contexts?.[key]?.[ctx] || fr.messages?.[key]);
  return Boolean(fr.messages?.[key]);
}

function hasPlural(singular, plural) {
  return Boolean(
    fr.plurals?.[`${singular}\u0000${plural}`] ||
      fr.plurals?.[singular] ||
      fr.messages?.[singular],
  );
}

function scanAst(sf, relPath) {
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text;
      const callArgs = node.arguments;
      if (fn === "t" && callArgs.length >= 1 && ts.isStringLiteralLike(callArgs[0])) {
        const key = callArgs[0].text;
        const ctx = getContextProp(callArgs[1]);
        if (!hasKey(key, ctx)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          missing.push({ file: relPath, line: line + 1, fn: "t", key, ctx });
        }
      } else if (
        fn === "tp" &&
        callArgs.length >= 2 &&
        ts.isStringLiteralLike(callArgs[0]) &&
        ts.isStringLiteralLike(callArgs[1])
      ) {
        const singular = callArgs[0].text;
        const plural = callArgs[1].text;
        if (!hasPlural(singular, plural)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          missing.push({ file: relPath, line: line + 1, fn: "tp", key: `${singular} | ${plural}` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const UI_PROPS = new Set(["label", "title", "placeholder", "hint", "aria-label"]);
const CODE_TAGS = new Set(["code", "pre", "kbd", "samp"]);

function looksLikeEnglishProse(raw) {
  const withoutEntities = raw.replace(/&[a-zA-Z0-9#]+;/g, " ").trim();
  if (withoutEntities.length < 3) return false;
  if (!/[A-Za-z]{2,}/.test(withoutEntities)) return false;
  // Skip paths, identifiers, env vars (ALL_CAPS), placeholder masks (XXXX-XXXX).
  if (/^[a-z0-9_.:/-]+$/.test(withoutEntities)) return false;
  if (/^[A-Z0-9_]+$/.test(withoutEntities)) return false;
  if (/^(?:[A-Z]+-)*X{3,}(?:-[A-Z0-9X]+)*$/.test(withoutEntities)) return false;
  return true;
}

function insideCodeTag(node) {
  let cur = node.parent;
  while (cur) {
    if (ts.isJsxElement(cur) && ts.isIdentifier(cur.openingElement.tagName)) {
      if (CODE_TAGS.has(cur.openingElement.tagName.text.toLowerCase())) return true;
    }
    cur = cur.parent;
  }
  return false;
}

function scanUnwrappedUi(sf, relPath, addedLines) {
  function visit(node) {
    if (ts.isJsxText(node) && !insideCodeTag(node) && looksLikeEnglishProse(node.text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      if (addedLines.has(line)) {
        unwrapped.push({ file: relPath, line, kind: "jsx-text", text: node.text.trim() });
      }
    } else if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      UI_PROPS.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      looksLikeEnglishProse(node.initializer.text)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      if (addedLines.has(line)) {
        unwrapped.push({
          file: relPath,
          line,
          kind: `prop:${node.name.text}`,
          text: node.initializer.text.trim(),
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

function getAddedLinesByFile(ref) {
  const diff = execFileSync("git", ["diff", "-U0", `${ref}..HEAD`, "--", "src/"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const byFile = new Map();
  let currentFile = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6).trim();
      if (!byFile.has(currentFile)) byFile.set(currentFile, new Set());
    } else if (line.startsWith("@@ ") && currentFile) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (m) {
        const start = Number(m[1]);
        const count = m[2] === undefined ? 1 : Number(m[2]);
        const set = byFile.get(currentFile);
        for (let i = 0; i < count; i++) set.add(start + i);
      }
    }
  }
  return byFile;
}

const addedByFile = diffRef ? getAddedLinesByFile(diffRef) : null;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const relPath = path.relative(ROOT, full);
    const src = fs.readFileSync(full, "utf8");
    const kind = entry.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(full, src, ts.ScriptTarget.Latest, true, kind);
    scanAst(sf, relPath);
    if (addedByFile && entry.name.endsWith(".tsx")) {
      const addedLines = addedByFile.get(relPath);
      if (addedLines?.size) {
        scanUnwrappedUi(sf, relPath, addedLines);
      }
    }
  }
}

walk(SRC_DIR);

if (jsonOut) {
  console.log(JSON.stringify({ missing, unwrapped }, null, 2));
} else {
  console.log(`check-i18n-gaps: ${missing.length} missing t/tp keys in fr.json`);
  for (const m of missing) {
    console.log(`  - ${m.file}:${m.line} [${m.fn}] ${JSON.stringify(m.key)}${m.ctx ? ` (context: ${m.ctx})` : ""}`);
  }
  if (diffRef) {
    console.log(`check-i18n-gaps: ${unwrapped.length} potential unwrapped UI strings on lines added since ${diffRef}`);
    for (const u of unwrapped.slice(0, 40)) {
      console.log(`  - ${u.file}:${u.line} [${u.kind}] ${JSON.stringify(u.text)}`);
    }
    if (unwrapped.length > 40) {
      console.log(`  ... and ${unwrapped.length - 40} more`);
    }
  }
}

if (strict && missing.length > 0) {
  process.exit(1);
}
