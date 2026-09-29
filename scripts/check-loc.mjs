#!/usr/bin/env node
// Enforce the per-file line cap (CLAUDE.md "Code organization"): no source file
// may exceed MAX_LOC lines. Exits non-zero and lists every offender, so it can
// gate CI / a pre-commit hook. Run: `node scripts/check-loc.mjs` or `pnpm lint:loc`.

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LOC = 600;
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// Source extensions we hold to the cap.
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sol", ".rs"]);

// Directories that are vendored, generated, or otherwise not our source.
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "target",
  "out",
  "dist",
  "build",
  "broadcast",
  "lib", // Foundry/vendored libraries
  ".git",
  "coverage",
]);

/** @type {{file: string, loc: number}[]} */
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full);
    } else if (EXTS.has(extname(name))) {
      const loc = readFileSync(full, "utf8").split("\n").length;
      if (loc > MAX_LOC) offenders.push({ file: full.slice(ROOT.length + 1), loc });
    }
  }
}

walk(ROOT);
offenders.sort((a, b) => b.loc - a.loc);

if (offenders.length === 0) {
  console.log(`✔ No file exceeds ${MAX_LOC} LoC.`);
  process.exit(0);
}

console.error(`✖ ${offenders.length} file(s) exceed the ${MAX_LOC} LoC cap:`);
for (const o of offenders) console.error(`  ${o.loc}\t${o.file}`);
console.error("\nSplit by responsibility (sub-views, use*.ts hooks, helpers/types).");
process.exit(1);
