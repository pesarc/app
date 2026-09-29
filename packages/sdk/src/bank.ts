// Linked bank account for fiat payouts. Every user can have a web2 payout account
// alongside their web3 wallet: Nigerians link/create one via BVN. This is the data
// layer + a PROVIDER-STUBBED creation path — when PAYSTACK/FLUTTERWAVE keys are
// present we mark the provider, and the real DVA/BVN call is wired at the marked
// TODO. The BVN is validated for shape and then DISCARDED; it is never stored or
// logged. Store mirrors transfers.ts (Neon, with a zero-config file fallback).

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { getSql } from "./db";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

export type LinkedBankAccount = {
  accountNumber: string; // 10-digit NUBAN
  bankName: string;
  accountName: string;
  provider: string; // "stub" | "paystack" | "flutterwave"
  createdAt: string;
};

/** Which real provider is configured, if any. Creation stays stubbed until wired. */
export function bankProvider(): "paystack" | "flutterwave" | null {
  if (process.env.PAYSTACK_SECRET_KEY) return "paystack";
  if (process.env.FLUTTERWAVE_TEST_CLIENT_SECRET || process.env.FLUTTERWAVE_TEST_ENCRYPTION_KEY)
    return "flutterwave";
  return null;
}

/** A stable 10-digit test NUBAN derived from the account id (never from the BVN). */
function stubNuban(account: string): string {
  const h = createHash("sha256").update(`nuban:${account}`).digest();
  let n = "";
  for (let i = 0; n.length < 10 && i < h.length; i++) n += (h[i] % 10).toString();
  while (n.length < 10) n += "0";
  return (n[0] === "0" ? "9" : n[0]) + n.slice(1, 10);
}

/** Nigerian BVN shape check (11 digits). We validate, then discard — never store. */
export function isValidBvn(bvn: string): boolean {
  return /^\d{11}$/.test(bvn.trim());
}

const hasNeon = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      account        text PRIMARY KEY,
      account_number text NOT NULL,
      bank_name      text NOT NULL,
      account_name   text NOT NULL,
      provider       text NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `.then(() => {});
  return schemaReady;
}

export async function getBankAccount(account = DEMO_ACCOUNT): Promise<LinkedBankAccount | null> {
  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`SELECT * FROM bank_accounts WHERE account = ${account} LIMIT 1`;
      const r = (rows as Record<string, unknown>[])[0];
      return r ? mapRow(r) : null;
    } catch {
      /* fall through to file */
    }
  }
  return readFromFile(account);
}

/**
 * Link/create a payout bank account for `account`. `opts.bvn` is validated for
 * shape and discarded. Returns the linked account (idempotent per user).
 */
export async function linkBankAccount(
  account: string,
  opts: { bvn: string; accountName?: string },
): Promise<{ ok: boolean; account?: LinkedBankAccount; error?: string }> {
  if (!isValidBvn(opts.bvn)) return { ok: false, error: "Enter a valid 11-digit BVN." };

  const provider = bankProvider();
  // TODO(provider): when a provider is configured, call its BVN-resolve +
  // dedicated-virtual-account API here with the (transient) BVN instead of the
  // stub below, and use the returned NUBAN/bank. The BVN is not persisted.
  const linked: LinkedBankAccount = {
    accountNumber: stubNuban(account),
    bankName: "Wema Bank (test)",
    accountName: (opts.accountName || "Pesarc Wallet").slice(0, 64),
    provider: provider ?? "stub",
    createdAt: new Date().toISOString(),
  };

  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO bank_accounts (account, account_number, bank_name, account_name, provider)
        VALUES (${account}, ${linked.accountNumber}, ${linked.bankName}, ${linked.accountName}, ${linked.provider})
        ON CONFLICT (account) DO UPDATE SET account_name = EXCLUDED.account_name
      `;
      return { ok: true, account: linked };
    } catch {
      /* fall through to file */
    }
  }
  const saved = await writeToFile(account, linked);
  return saved ? { ok: true, account: linked } : { ok: false, error: "Could not save account." };
}

function mapRow(r: Record<string, unknown>): LinkedBankAccount {
  return {
    accountNumber: String(r.account_number),
    bankName: String(r.bank_name),
    accountName: String(r.account_name),
    provider: String(r.provider),
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/* ---- Local JSON fallback (zero-config dev without DATABASE_URL) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "bank-accounts.json");
}

async function readAll(): Promise<Record<string, LinkedBankAccount>> {
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as Record<string, LinkedBankAccount>;
  } catch {
    return {};
  }
}

async function readFromFile(account: string): Promise<LinkedBankAccount | null> {
  return (await readAll())[account] ?? null;
}

async function writeToFile(account: string, linked: LinkedBankAccount): Promise<boolean> {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const all = await readAll();
    all[account] = linked;
    await fs.writeFile(file, JSON.stringify(all, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}
