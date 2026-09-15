import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

// Fiat payout orchestration (testnet sandbox). The crypto leg is real — the
// swapped cNGN lands in the ramp escrow wallet on-chain — and this module
// tracks the fiat leg the way a ramp partner integration would: a payout
// record that advances initiated → processing → paid. Statuses are derived
// from elapsed time (stateless partner simulation); a real RampAdapter swaps
// in webhook-driven updates without touching callers.

export type PayoutMethod = "bank" | "mobile_money";

export type PayoutStatus = "initiated" | "processing" | "paid";

export type PayoutInput = {
  /** Transfer reference (SARC-… / QRP-…) this payout settles. */
  reference: string;
  beneficiary: string;
  method: PayoutMethod;
  amountNgn: number;
  /** On-chain tx that funded the escrow. */
  txHash?: string;
};

export type PayoutRow = PayoutInput & {
  /** Owning account (verified Privy user id, or the demo bucket). */
  account?: string;
  id: string;
  status: PayoutStatus;
  createdAt: string;
  /** Simulated partner payout reference. */
  partnerRef: string;
};

// Sandbox partner SLA: ~20s to accept, ~45s to pay out.
const PROCESSING_AFTER_MS = 8_000;
const PAID_AFTER_MS = 45_000;

function statusFor(createdAt: string): PayoutStatus {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age >= PAID_AFTER_MS) return "paid";
  if (age >= PROCESSING_AFTER_MS) return "processing";
  return "initiated";
}

const hasNeon = () => Boolean(process.env.DATABASE_URL);

function sqlClient() {
  return neon(process.env.DATABASE_URL!);
}

type Sql = ReturnType<typeof sqlClient>;

// Migrations (scripts/migrate.mjs) own the schema. This runs at most ONCE per
// process as a zero-config dev fallback — never DDL on the request hot path.
let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= createSchema(sql);
  return schemaReady;
}

async function createSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS payouts (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account      text NOT NULL DEFAULT 'demo',
      reference    text NOT NULL,
      beneficiary  text NOT NULL,
      method       text NOT NULL,
      amount_ngn   numeric NOT NULL,
      tx_hash      text,
      partner_ref  text NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Payouts predate per-user scoping — upgrade in place.
  await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'demo'`;
  await sql`CREATE INDEX IF NOT EXISTS payouts_account_ref_idx ON payouts (account, reference)`;
}

function partnerRef(): string {
  return `RMP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export async function createPayout(
  input: PayoutInput,
  account = DEMO_ACCOUNT,
): Promise<PayoutRow> {
  const row: PayoutRow = {
    ...input,
    account,
    id: String(Date.now()),
    status: "initiated",
    createdAt: new Date().toISOString(),
    partnerRef: partnerRef(),
  };

  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const inserted = await sql`
        INSERT INTO payouts (account, reference, beneficiary, method, amount_ngn, tx_hash, partner_ref)
        VALUES (${account}, ${input.reference}, ${input.beneficiary}, ${input.method},
                ${input.amountNgn}, ${input.txHash ?? null}, ${row.partnerRef})
        RETURNING id, created_at
      `;
      row.id = String((inserted[0] as { id: unknown }).id);
      row.createdAt = new Date(
        (inserted[0] as { created_at: string | Date }).created_at,
      ).toISOString();
      return row;
    } catch {
      /* fall through to file store */
    }
  }
  await appendToFile(row);
  return row;
}

/**
 * Looks up a payout **within the caller's own account**. Scoping by account is
 * what stops a guessed reference from returning someone else's beneficiary
 * name and amount (the audit's IDOR finding).
 */
export async function getPayout(
  reference: string,
  account = DEMO_ACCOUNT,
): Promise<PayoutRow | null> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM payouts
        WHERE reference = ${reference} AND account = ${account}
        ORDER BY created_at DESC LIMIT 1
      `;
      if (rows.length === 0) return null;
      const r = rows[0] as Record<string, unknown>;
      const createdAt =
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at);
      return {
        id: String(r.id),
        reference: String(r.reference),
        beneficiary: String(r.beneficiary),
        method: r.method as PayoutMethod,
        amountNgn: Number(r.amount_ngn),
        txHash: (r.tx_hash as string) ?? undefined,
        partnerRef: String(r.partner_ref),
        createdAt,
        status: statusFor(createdAt),
      };
    } catch {
      /* fall through */
    }
  }
  const rows = await readFileRows();
  // Scope the fallback too — otherwise "no DATABASE_URL" quietly reopens the
  // IDOR the account column exists to close.
  const row =
    rows.reverse().find(
      (r) => r.reference === reference && (r.account ?? DEMO_ACCOUNT) === account,
    ) ?? null;
  return row ? { ...row, status: statusFor(row.createdAt) } : null;
}

/* ---- local JSONL fallback (zero-config dev) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "payouts.jsonl");
}

async function appendToFile(row: PayoutRow) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

async function readFileRows(): Promise<PayoutRow[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as PayoutRow);
  } catch {
    return [];
  }
}
