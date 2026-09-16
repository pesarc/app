import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";
import { getRampAdapter, type PayoutStatus as RampPayoutStatus } from "./ramp";

// Fiat payout orchestration (testnet sandbox). The crypto leg is real — the
// swapped cNGN lands in the ramp escrow wallet on-chain — and this module
// tracks the fiat leg. Status comes from the active RampAdapter (see ramp.ts):
// the simulated adapter advances initiated → processing → paid on a timeline,
// and a real off-ramp partner swaps in webhook-driven status without touching
// callers.

export type PayoutMethod = "bank" | "mobile_money";

export type PayoutStatus = RampPayoutStatus;

export type PayoutInput = {
  /** Transfer reference (SARC-… / QRP-…) this payout settles. */
  reference: string;
  beneficiary: string;
  method: PayoutMethod;
  amountNgn: number;
  /** On-chain tx that funded the escrow. */
  txHash?: string;
  // Structured destination for a real provider (Paystack et al.). Used only to
  // create the transfer at initiate time; NOT persisted (no account PII at rest).
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
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
      status       text NOT NULL DEFAULT 'initiated',
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Payouts predate per-user scoping + webhook-driven status — upgrade in place.
  await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'demo'`;
  await sql`ALTER TABLE payouts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'initiated'`;
  await sql`CREATE INDEX IF NOT EXISTS payouts_account_ref_idx ON payouts (account, reference)`;
  await sql`CREATE INDEX IF NOT EXISTS payouts_partner_ref_idx ON payouts (partner_ref)`;
}

export async function createPayout(
  input: PayoutInput,
  account = DEMO_ACCOUNT,
): Promise<PayoutRow> {
  // Hand the payout to the ramp provider (real when configured, else simulated).
  const { partnerRef, status } = await getRampAdapter().initiate(input);
  const row: PayoutRow = {
    ...input,
    account,
    id: String(Date.now()),
    status,
    createdAt: new Date().toISOString(),
    partnerRef,
  };

  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const inserted = await sql`
        INSERT INTO payouts (account, reference, beneficiary, method, amount_ngn, tx_hash, partner_ref, status)
        VALUES (${account}, ${input.reference}, ${input.beneficiary}, ${input.method},
                ${input.amountNgn}, ${input.txHash ?? null}, ${row.partnerRef}, ${row.status})
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
        status: await resolveStatus(createdAt, String(r.partner_ref), r.status as PayoutStatus),
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
  if (!row) return null;
  return { ...row, status: await resolveStatus(row.createdAt, row.partnerRef, row.status) };
}

/** With a real provider the stored (webhook-driven) status is authoritative;
 *  the simulator derives it from elapsed time. */
async function resolveStatus(
  createdAt: string,
  partnerRef: string,
  stored?: PayoutStatus,
): Promise<PayoutStatus> {
  const adapter = getRampAdapter();
  if (adapter.name !== "simulated") return stored ?? "initiated";
  return adapter.statusFor(createdAt, partnerRef);
}

/**
 * Apply a provider status update (from /api/payouts/webhook) to the stored
 * payout, keyed by the partner's reference. Idempotent.
 */
export async function updatePayoutStatus(
  partnerRef: string,
  status: PayoutStatus,
): Promise<boolean> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const res = await sql`
        UPDATE payouts SET status = ${status} WHERE partner_ref = ${partnerRef} RETURNING id
      `;
      if (res.length > 0) return true;
    } catch {
      /* fall through to file store */
    }
  }
  const rows = await readFileRows();
  let changed = false;
  const next = rows.map((r) => {
    if (r.partnerRef === partnerRef) {
      changed = true;
      return { ...r, status };
    }
    return r;
  });
  if (changed) await rewriteFile(next);
  return changed;
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

async function rewriteFile(rows: PayoutRow[]) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}
