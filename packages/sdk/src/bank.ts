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
  accountNumber: string; // 10-digit NUBAN ("pending" until a provider assigns one)
  bankName: string;
  accountName: string;
  provider: string; // "stub" | "paystack" | "flutterwave"
  status: "active" | "pending";
  /** Provider handle used to reconcile an async assignment (Paystack: the email). */
  providerRef?: string;
  createdAt: string;
};

/** Which real provider is configured, if any. Creation stays stubbed until wired. */
export function bankProvider(): "paystack" | "flutterwave" | null {
  if (process.env.PAYSTACK_SECRET_KEY) return "paystack";
  if (process.env.FLUTTERWAVE_TEST_CLIENT_SECRET || process.env.FLUTTERWAVE_TEST_ENCRYPTION_KEY)
    return "flutterwave";
  return null;
}

// ---- Paystack Dedicated Virtual Account (test/live via PAYSTACK_SECRET_KEY) ----
// The assign flow is async (Paystack provisions the NUBAN, then fires a webhook).
// Webhooks can't reach localhost, so we reconcile on READ by looking the customer
// up by email. The BVN is passed once to Paystack and never stored by us.

const PAYSTACK = "https://api.paystack.co";
const DVA_BANK = process.env.PAYSTACK_DVA_BANK || "test-bank";

function paystackHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Deterministic Paystack customer email for an app account (reconciliation key). */
function paystackEmail(account: string): string {
  const slug = account.replace(/[^a-zA-Z0-9]/g, "").slice(-24).toLowerCase() || "user";
  return `${slug}@wallet.pesarc.xyz`;
}

/** Kick off an async DVA assignment with BVN. Returns the reconciliation email. */
async function paystackAssign(
  account: string,
  bvn: string,
  accountName: string,
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const email = paystackEmail(account);
  const [first, ...rest] = (accountName || "Pesarc Wallet").split(" ");
  try {
    const res = await fetch(`${PAYSTACK}/dedicated_account/assign`, {
      method: "POST",
      headers: paystackHeaders(),
      body: JSON.stringify({
        email,
        first_name: first || "Pesarc",
        last_name: rest.join(" ") || "Wallet",
        phone: "+2340000000000",
        preferred_bank: DVA_BANK,
        country: "NG",
        bvn,
      }),
    });
    const j = (await res.json()) as { status?: boolean; message?: string };
    if (j.status) return { ok: true, email };
    return { ok: false, error: j.message || "Paystack declined the request." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Paystack request failed." };
  }
}

/** Read the assigned DVA for a customer email, once Paystack has provisioned it. */
async function paystackFetchDva(
  email: string,
): Promise<{ accountNumber: string; bankName: string; accountName: string } | null> {
  try {
    const res = await fetch(`${PAYSTACK}/customer/${encodeURIComponent(email)}`, {
      headers: paystackHeaders(),
    });
    const j = (await res.json()) as {
      status?: boolean;
      data?: { dedicated_account?: { account_number?: string; account_name?: string; bank?: { name?: string } } };
    };
    const dva = j.data?.dedicated_account;
    if (j.status && dva?.account_number) {
      return {
        accountNumber: dva.account_number,
        bankName: dva.bank?.name || "Bank",
        accountName: dva.account_name || "Pesarc Wallet",
      };
    }
    return null;
  } catch {
    return null;
  }
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
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        account        text PRIMARY KEY,
        account_number text NOT NULL,
        bank_name      text NOT NULL,
        account_name   text NOT NULL,
        provider       text NOT NULL,
        status         text NOT NULL DEFAULT 'active',
        provider_ref   text,
        created_at     timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
    await sql`ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS provider_ref text`;
  })();
  return schemaReady;
}

export async function getBankAccount(account = DEMO_ACCOUNT): Promise<LinkedBankAccount | null> {
  const rec = await loadRaw(account);
  if (!rec) return null;
  return reconcile(account, rec);
}

/**
 * If a Paystack account is still pending, ask Paystack whether the NUBAN has been
 * provisioned yet (webhooks can't reach localhost, so we reconcile on read).
 */
async function reconcile(account: string, rec: LinkedBankAccount): Promise<LinkedBankAccount> {
  if (rec.status !== "pending" || rec.provider !== "paystack" || !rec.providerRef) return rec;
  const dva = await paystackFetchDva(rec.providerRef);
  if (!dva) return rec;
  const active: LinkedBankAccount = {
    ...rec,
    accountNumber: dva.accountNumber,
    bankName: dva.bankName,
    accountName: dva.accountName,
    status: "active",
  };
  await persist(account, active);
  return active;
}

/**
 * Link/create a payout bank account for `account`. `opts.bvn` is validated for
 * shape and discarded (passed once to the provider, never stored). Idempotent.
 */
export async function linkBankAccount(
  account: string,
  opts: { bvn: string; accountName?: string },
): Promise<{ ok: boolean; account?: LinkedBankAccount; error?: string }> {
  if (!isValidBvn(opts.bvn)) return { ok: false, error: "Enter a valid 11-digit BVN." };
  const accountName = (opts.accountName || "Pesarc Wallet").slice(0, 64);

  let linked: LinkedBankAccount;
  if (bankProvider() === "paystack") {
    const assigned = await paystackAssign(account, opts.bvn, accountName);
    if (!assigned.ok) return { ok: false, error: assigned.error ?? "Could not link your account." };
    linked = {
      accountNumber: "pending",
      bankName: "Assigning…",
      accountName,
      provider: "paystack",
      status: "pending",
      providerRef: assigned.email,
      createdAt: new Date().toISOString(),
    };
  } else {
    // Stub: deterministic test NUBAN, no provider call, BVN discarded.
    linked = {
      accountNumber: stubNuban(account),
      bankName: "Wema Bank (test)",
      accountName,
      provider: "stub",
      status: "active",
      createdAt: new Date().toISOString(),
    };
  }

  if (!(await persist(account, linked))) {
    return { ok: false, error: "Could not save account." };
  }
  // Paystack test mode often assigns immediately — reconcile once before replying.
  const finalAccount = await reconcile(account, linked);
  return { ok: true, account: finalAccount };
}

/** Upsert a bank account record (Neon, else file). */
async function persist(account: string, a: LinkedBankAccount): Promise<boolean> {
  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO bank_accounts
          (account, account_number, bank_name, account_name, provider, status, provider_ref)
        VALUES
          (${account}, ${a.accountNumber}, ${a.bankName}, ${a.accountName}, ${a.provider}, ${a.status}, ${a.providerRef ?? null})
        ON CONFLICT (account) DO UPDATE SET
          account_number = EXCLUDED.account_number,
          bank_name = EXCLUDED.bank_name,
          account_name = EXCLUDED.account_name,
          provider = EXCLUDED.provider,
          status = EXCLUDED.status,
          provider_ref = EXCLUDED.provider_ref
      `;
      return true;
    } catch {
      /* fall through to file */
    }
  }
  return writeToFile(account, a);
}

async function loadRaw(account: string): Promise<LinkedBankAccount | null> {
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

function mapRow(r: Record<string, unknown>): LinkedBankAccount {
  return {
    accountNumber: String(r.account_number),
    bankName: String(r.bank_name),
    accountName: String(r.account_name),
    provider: String(r.provider),
    status: (r.status as "active" | "pending") ?? "active",
    providerRef: r.provider_ref ? String(r.provider_ref) : undefined,
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
  const rec = (await readAll())[account];
  if (!rec) return null;
  return { ...rec, status: rec.status ?? "active" };
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
