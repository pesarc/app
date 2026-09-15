#!/usr/bin/env node
// Database migrations. Run at deploy time — NOT per request.
//
// The stores used to call CREATE TABLE IF NOT EXISTS on every single request
// (flagged in the audit): wasted round-trips on the hot path and DDL executed
// by user traffic. This script owns the schema; the stores just query.
//
//   pnpm migrate          # against $DATABASE_URL
//
// Safe to run repeatedly — every statement is idempotent.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

// Load .env when run outside Next (which injects it automatically).
if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* no .env — rely on the real environment */
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — nothing to migrate.");
  process.exit(1);
}

const sql = neon(url);

const statements = [
  // --- waitlist ---
  `CREATE TABLE IF NOT EXISTS waitlist (
     id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     email       text NOT NULL UNIQUE,
     source      text,
     created_at  timestamptz NOT NULL DEFAULT now()
   )`,

  // --- transfers ---
  `CREATE TABLE IF NOT EXISTS transfers (
     id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     account             text NOT NULL DEFAULT 'demo',
     direction           text NOT NULL,
     counterparty        text NOT NULL,
     counterparty_handle text,
     send_amount         numeric NOT NULL,
     send_currency       text NOT NULL,
     receive_amount      numeric NOT NULL,
     receive_currency    text NOT NULL,
     payout              text NOT NULL,
     reference           text NOT NULL,
     flag                text,
     tx_hash             text,
     created_at          timestamptz NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tx_hash text`,
  // Rows are read by account, newest first.
  `CREATE INDEX IF NOT EXISTS transfers_account_created_idx
     ON transfers (account, created_at DESC)`,

  // --- payouts ---
  `CREATE TABLE IF NOT EXISTS payouts (
     id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     account      text NOT NULL DEFAULT 'demo',
     reference    text NOT NULL,
     beneficiary  text NOT NULL,
     method       text NOT NULL,
     amount_ngn   numeric NOT NULL,
     tx_hash      text,
     partner_ref  text NOT NULL,
     created_at   timestamptz NOT NULL DEFAULT now()
   )`,
  // Pre-scoping payouts default to the demo bucket.
  `ALTER TABLE payouts ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'demo'`,
  // Lookups are always (account, reference) — never reference alone.
  `CREATE INDEX IF NOT EXISTS payouts_account_ref_idx
     ON payouts (account, reference)`,
];

let n = 0;
for (const stmt of statements) {
  await sql(stmt);
  n++;
}
console.log(`migrations applied: ${n} statements ok`);
