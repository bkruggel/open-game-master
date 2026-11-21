#!/usr/bin/env node
// Scans src/ with the TypeScript AST for t(...) and tp(...) calls whose keys
// are missing from src/lib/i18n/fr.json, and emits compact AST-based vicinity
// candidates (with +-2 line snippets) near missing keys and git-diff hunks so
// downstream automation does not need to fetch full source files just to audit
// surrounding code.
//
// Options:
//   --diff <ref>  Also scan +-10 lines around git diff hunks since <ref> for
//                 unwrapped user-facing UI strings.
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
const vicinityCandidates = [];

const MISSING_WINDOW = 15;
const DIFF_WINDOW = 10;
const MAX_CANDIDATES = 60;

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

function makeSnippet(lines, lineNum, radius = 2) {
  const start = Math.max(0, lineNum - 1 - radius);
  const end = Math.min(lines.length, lineNum - 1 + radius + 1);
  return lines
    .slice(start, end)
    .map((text, idx) => `${start + idx + 1}: ${text}`)
    .join("\n");
}

function scanMissingAst(sf, relPath) {
  const missingLines = new Set();
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text;
      const callArgs = node.arguments;
      if (fn === "t" && callArgs.length >= 1 && ts.isStringLiteralLike(callArgs[0])) {
        const key = callArgs[0].text;
        const ctx = getContextProp(callArgs[1]);
        if (!hasKey(key, ctx)) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          missing.push({ file: relPath, line, fn: "t", key, ctx });
          missingLines.add(line);
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
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          missing.push({ file: relPath, line, fn: "tp", key: `${singular} | ${plural}` });
          missingLines.add(line);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return missingLines;
}

const UI_PROPS = new Set([
  "label",
  "title",
  "placeholder",
  "hint",
  "aria-label",
  "alt",
  "actionLabel",
  "confirmLabel",
  "cancelLabel",
  "emptyText",
  "description",
]);
const UI_OBJ_KEYS = new Set([
  "label",
  "title",
  "detail",
  "message",
  "error",
  "hint",
  "description",
  "placeholder",
  "actionLabel",
]);
const CODE_TAGS = new Set(["code", "pre", "kbd", "samp"]);

function looksLikeEnglishProse(raw, strictPhrase = false) {
  const withoutEntities = raw.replace(/&[a-zA-Z0-9#]+;/g, " ").trim();
  if (withoutEntities.length < 3) return false;
  if (!/[A-Za-z]{2,}/.test(withoutEntities)) return false;
  // Skip paths, URLs, identifiers, CSS class lists, env vars, placeholder masks.
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/.test(withoutEntities)) return false;
  if (/^[a-z0-9_.:/-]+$/.test(withoutEntities)) return false;
  if (/^[A-Z0-9_]+$/.test(withoutEntities)) return false;
  if (/^(?:[A-Z]+-)*X{3,}(?:-[A-Z0-9X]+)*$/.test(withoutEntities)) return false;
  if (/^(?:[a-z0-9-]+(?::[a-z0-9-\[\]/.%]+)?\s+){2,}[a-z0-9-]+(?::[a-z0-9-\[\]/.%]+)?$/.test(withoutEntities)) {
    // Tailwind utility class string (all lowercase hyphenated tokens)
    return false;
  }
  if (strictPhrase) {
    // For JS expressions / .ts strings, require a space (multi-word) or sentence punctuation
    const hasSpace = /\s/.test(withoutEntities);
    const startsUpper = /^[A-Z]/.test(withoutEntities);
    if (!hasSpace && !/[.?!]$/.test(withoutEntities)) return false;
    if (!startsUpper && !/[.?!]$/.test(withoutEntities)) return false;
  }
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

function insideTranslateCall(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isCallExpression(cur) &&
      ts.isIdentifier(cur.expression) &&
      (cur.expression.text === "t" || cur.expression.text === "tp" || cur.expression.text === "contentName")
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function insideConsoleOrErrorLog(node) {
  let cur = node.parent;
  while (cur) {
    if (
      ts.isCallExpression(cur) &&
      ts.isPropertyAccessExpression(cur.expression) &&
      ts.isIdentifier(cur.expression.expression) &&
      cur.expression.expression.text === "console"
    ) {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}

function isNearAny(line, lineSet, radius) {
  if (!lineSet || lineSet.size === 0) return false;
  for (const target of lineSet) {
    if (Math.abs(line - target) <= radius) return true;
  }
  return false;
}

function isSkippableTsFile(relPath) {
  if (/\.(test|spec)\.(ts|tsx)$/.test(relPath)) return true;
  if (relPath.startsWith("src/lib/i18n/")) return true;
  if (relPath.startsWith("src/lib/db/")) return true;
  if (/prompt/i.test(path.basename(relPath)) && relPath.endsWith(".ts")) return true;
  return false;
}

function scanVicinity(sf, relPath, srcLines, missingLines, addedLines) {
  if (isSkippableTsFile(relPath)) return;
  const isTsx = relPath.endsWith(".tsx");
  const seen = new Set();

  function classifyReason(line) {
    const nearMissing = isNearAny(line, missingLines, MISSING_WINDOW);
    const inDiff = isNearAny(line, addedLines, DIFF_WINDOW);
    if (nearMissing && inDiff) return "near-missing+diff";
    if (nearMissing) return "near-missing";
    if (inDiff) return "in-diff";
    return null;
  }

  function record(line, kind, text) {
    const reason = classifyReason(line);
    if (!reason) return;
    const trimmed = text.trim();
    const dedupeKey = `${line}:${trimmed}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    vicinityCandidates.push({
      file: relPath,
      line,
      kind,
      reason,
      text: trimmed,
      snippet: makeSnippet(srcLines, line, 2),
    });
  }

  function visit(node) {
    if (isTsx && ts.isJsxText(node) && !insideCodeTag(node) && looksLikeEnglishProse(node.text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      record(line, "jsx-text", node.text);
    } else if (
      isTsx &&
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      UI_PROPS.has(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      looksLikeEnglishProse(node.initializer.text)
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      record(line, `prop:${node.name.text}`, node.initializer.text);
    } else if (
      ts.isStringLiteralLike(node) &&
      !insideTranslateCall(node) &&
      !insideConsoleOrErrorLog(node)
    ) {
      const parent = node.parent;
      // Skip imports, exports, type literals, JSX attribute values (handled above)
      if (
        ts.isImportDeclaration(parent) ||
        ts.isExportDeclaration(parent) ||
        ts.isLiteralTypeNode(parent) ||
        ts.isJsxAttribute(parent)
      ) {
        return;
      }
      // Flag UI object properties (e.g. { label: "...", detail: "...", error: "..." })
      if (
        ts.isPropertyAssignment(parent) &&
        parent.initializer === node &&
        ts.isIdentifier(parent.name) &&
        UI_OBJ_KEYS.has(parent.name.text) &&
        looksLikeEnglishProse(node.text, true)
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        record(line, `obj:${parent.name.text}`, node.text);
      } else if (
        isTsx &&
        (ts.isJsxExpression(parent) || ts.isConditionalExpression(parent) || ts.isBinaryExpression(parent)) &&
        !insideCodeTag(node) &&
        looksLikeEnglishProse(node.text, true)
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        record(line, "jsx-expr", node.text);
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
const changedFiles = addedByFile
  ? [...addedByFile.keys()].filter(
      (f) => /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.(ts|tsx)$/.test(f),
    )
  : [];

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
    const missingLines = scanMissingAst(sf, relPath);
    const addedLines = addedByFile?.get(relPath);
    if (missingLines.size > 0 || addedLines?.size > 0) {
      scanVicinity(sf, relPath, src.split("\n"), missingLines, addedLines);
    }
  }
}

walk(SRC_DIR);

// Prioritize candidates closest to missing keys first, then diff hunks.
const REASON_ORDER = { "near-missing+diff": 0, "near-missing": 1, "in-diff": 2 };
vicinityCandidates.sort(
  (a, b) =>
    (REASON_ORDER[a.reason] ?? 9) - (REASON_ORDER[b.reason] ?? 9) ||
    a.file.localeCompare(b.file) ||
    a.line - b.line,
);
const cappedCandidates = vicinityCandidates.slice(0, MAX_CANDIDATES);

if (jsonOut) {
  console.log(
    JSON.stringify(
      {
        missing,
        vicinityCandidates: cappedCandidates,
        vicinityTotal: vicinityCandidates.length,
        changedFiles,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`check-i18n-gaps: ${missing.length} missing t/tp keys in fr.json`);
  for (const m of missing) {
    console.log(
      `  - ${m.file}:${m.line} [${m.fn}] ${JSON.stringify(m.key)}${m.ctx ? ` (context: ${m.ctx})` : ""}`,
    );
  }
  console.log(
    `check-i18n-gaps: ${vicinityCandidates.length} vicinity unwrapped candidates (${cappedCandidates.length} shown)`,
  );
  for (const c of cappedCandidates.slice(0, 40)) {
    console.log(`  - ${c.file}:${c.line} [${c.kind} | ${c.reason}] ${JSON.stringify(c.text)}`);
  }
  if (diffRef) {
    console.log(`check-i18n-gaps: ${changedFiles.length} changed src/**/*.{ts,tsx} files since ${diffRef}`);
  }
}

if (strict && missing.length > 0) {
  process.exit(1);
}
