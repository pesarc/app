// Apply the canonical schema (deploy/schema.sql) to DATABASE_URL. Idempotent,
// so it is safe to run on every deploy. This is the source of truth for the
// schema; the app's lazy CREATE TABLE IF NOT EXISTS is only a zero-config dev
// fallback. Run with `pnpm db:migrate` (or `node scripts/migrate.mjs`).
//
// Per environment: each of dev/staging/prod has its OWN DATABASE_URL and runs
// this against its own instance (see deploy/ENVIRONMENTS.md).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SCHEMA_VERSION = "2026-09-26";
const dryRun = process.argv.includes("--dry-run");

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, "..", "deploy", "schema.sql");
const raw = readFileSync(schemaPath, "utf8");

// Drop full-line comments, then split into individual statements.
const statements = raw
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

if (dryRun) {
  console.log(`migrate --dry-run: ${statements.length} statements from deploy/schema.sql`);
  for (const s of statements) console.log("  •", s.split("\n")[0].slice(0, 72));
  process.exit(0);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL is not set. Nothing to do.");
  process.exit(1);
}

const { default: postgres } = await import("postgres");

const needsSsl =
  /[?&]sslmode=require/.test(url) || /\.neon\.tech|\.ondigitalocean\.com/.test(url);
const sql = postgres(url, {
  ssl: needsSsl ? "require" : false,
  max: 1,
  onnotice: () => {}, // idempotent DDL emits "already exists" notices — quiet them
});

try {
  console.log(`migrate: applying ${statements.length} statements from deploy/schema.sql`);
  for (const stmt of statements) {
    await sql.unsafe(stmt);
  }
  await sql`INSERT INTO schema_migrations (version) VALUES (${SCHEMA_VERSION})`;
  console.log(`migrate: done (version ${SCHEMA_VERSION}).`);
} catch (err) {
  console.error("migrate: FAILED —", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
