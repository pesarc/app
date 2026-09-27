import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getSql } from "./db";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";
import { cngnConfigured, createVirtualAccount as cngnCreateVirtualAccount } from "./cngn";

// Dedicated virtual NGN accounts, per app account (Privy user id / demo bucket).
//
// A virtual account is a NUBAN a customer pays NGN into; cNGN mints the matching
// balance to the merchant (NGN in → cNGN). cNGN's own virtual-account list is
// merchant-level and not scoped to our end users, so we persist each created
// account locally against the owning account — mirroring payouts.ts: Neon when
// DATABASE_URL is set, with a JSONL file fallback so the flow works end-to-end
// with no database.
//
// Env-gated like the rest of the ramp seam: when cNGN isn't configured we mint a
// realistic simulated NUBAN so the app never breaks without a cNGN account.

export type VirtualAccountInput = {
  /** Expected deposit amount (NGN). */
  amount: number;
  /** Customer email (required by cNGN for a temporary account). */
  customerEmail: string;
  /** Customer display name. */
  customerName?: string;
  /** Statement narration. */
  narration?: string;
};

export type VirtualAccountRow = {
  id: string;
  /** Owning app account (verified Privy user id, or the demo bucket). */
  account: string;
  /** cNGN payment reference — the natural key for status updates. */
  reference: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  amount: number;
  currency: string;
  status: string;
  narration?: string;
  /** Which provider issued it ("cngn" | "simulated"). */
  provider: string;
  /** ISO expiry (temporary accounts). */
  expiresAt?: string;
  createdAt: string;
};

const hasNeon = () => Boolean(process.env.DATABASE_URL);

type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS virtual_accounts (
      id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account        text NOT NULL DEFAULT 'demo',
      reference      text NOT NULL,
      account_number text NOT NULL,
      account_name   text NOT NULL,
      bank_name      text NOT NULL,
      bank_code      text NOT NULL,
      amount         numeric NOT NULL,
      currency       text NOT NULL DEFAULT 'NGN',
      status         text NOT NULL DEFAULT 'pending',
      narration      text,
      provider       text NOT NULL DEFAULT 'simulated',
      expires_at     timestamptz,
      created_at     timestamptz NOT NULL DEFAULT now(),
      UNIQUE (reference)
    )
  `.then(() => undefined);
  return schemaReady;
}

function simRef(): string {
  return `VA-${randomBytes(6).toString("hex").toUpperCase()}`;
}

/** A believable 10-digit NUBAN for the simulated path. */
function simNuban(): string {
  let n = "";
  for (let i = 0; i < 10; i++) n += Math.floor(Math.random() * 10);
  return n;
}

/**
 * Create a dedicated virtual NGN account for a customer and record it against
 * the caller's account. Uses cNGN when configured; otherwise a simulated NUBAN.
 */
export async function createVirtualAccount(
  input: VirtualAccountInput,
  account = DEMO_ACCOUNT,
): Promise<VirtualAccountRow> {
  const now = new Date();
  let row: VirtualAccountRow;

  if (cngnConfigured()) {
    const res = await cngnCreateVirtualAccount({
      amount: input.amount,
      customer: { name: input.customerName, email: input.customerEmail },
      accountName: input.customerName,
      narration: input.narration,
    });
    const va = res.data;
    if (!res.success || !va) {
      throw new Error(res.error || "cNGN virtual account creation failed.");
    }
    row = {
      id: String(Date.now()),
      account,
      reference: va.reference || va.paymentReference || simRef(),
      accountNumber: va.accountNumber,
      accountName: va.accountName,
      bankName: va.bankName,
      bankCode: va.bankCode,
      amount: Number(va.amountExpected ?? va.amount ?? input.amount),
      currency: va.currency || "NGN",
      status: va.status || "pending",
      narration: va.narration || input.narration,
      provider: "cngn",
      expiresAt: va.expiresAt,
      createdAt: now.toISOString(),
    };
  } else {
    row = {
      id: String(Date.now()),
      account,
      reference: simRef(),
      accountNumber: simNuban(),
      accountName: input.customerName || "Pesarc Customer",
      bankName: "Pesarc Sandbox Bank",
      bankCode: "999",
      amount: input.amount,
      currency: "NGN",
      status: "pending",
      narration: input.narration,
      provider: "simulated",
      expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
      createdAt: now.toISOString(),
    };
  }

  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const inserted = await sql`
        INSERT INTO virtual_accounts
          (account, reference, account_number, account_name, bank_name, bank_code,
           amount, currency, status, narration, provider, expires_at)
        VALUES
          (${account}, ${row.reference}, ${row.accountNumber}, ${row.accountName},
           ${row.bankName}, ${row.bankCode}, ${row.amount}, ${row.currency}, ${row.status},
           ${row.narration ?? null}, ${row.provider}, ${row.expiresAt ?? null})
        ON CONFLICT (reference) DO NOTHING
        RETURNING id, created_at
      `;
      if (inserted.length > 0) {
        row.id = String((inserted[0] as { id: unknown }).id);
        row.createdAt = new Date(
          (inserted[0] as { created_at: string | Date }).created_at,
        ).toISOString();
      }
      return row;
    } catch {
      /* fall through to file store */
    }
  }
  await appendToFile(row);
  return row;
}

/** Virtual accounts for an account, most-recent first. */
export async function listVirtualAccounts(
  account = DEMO_ACCOUNT,
  limit = 50,
): Promise<VirtualAccountRow[]> {
  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM virtual_accounts
        WHERE account = ${account}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return (rows as Record<string, unknown>[]).map(rowFromDb);
    } catch {
      /* fall through */
    }
  }
  const rows = await readFileRows();
  return rows
    .filter((r) => (r.account ?? DEMO_ACCOUNT) === account)
    .reverse()
    .slice(0, limit);
}

/**
 * Apply a deposit status update (from /api/cngn/webhook) to a stored virtual
 * account, keyed by its reference. Idempotent. Returns true when a row changed.
 */
export async function updateVirtualAccountStatus(
  reference: string,
  status: string,
): Promise<boolean> {
  if (hasNeon()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const res = await sql`
        UPDATE virtual_accounts SET status = ${status} WHERE reference = ${reference} RETURNING id
      `;
      if (res.length > 0) return true;
    } catch {
      /* fall through to file store */
    }
  }
  const rows = await readFileRows();
  let changed = false;
  const next = rows.map((r) => {
    if (r.reference === reference) {
      changed = true;
      return { ...r, status };
    }
    return r;
  });
  if (changed) await rewriteFile(next);
  return changed;
}

function rowFromDb(r: Record<string, unknown>): VirtualAccountRow {
  const createdAt =
    r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at);
  const expiresAt =
    r.expires_at == null
      ? undefined
      : r.expires_at instanceof Date
        ? r.expires_at.toISOString()
        : String(r.expires_at);
  return {
    id: String(r.id),
    account: String(r.account),
    reference: String(r.reference),
    accountNumber: String(r.account_number),
    accountName: String(r.account_name),
    bankName: String(r.bank_name),
    bankCode: String(r.bank_code),
    amount: Number(r.amount),
    currency: String(r.currency),
    status: String(r.status),
    narration: (r.narration as string) ?? undefined,
    provider: (r.provider as string) ?? "simulated",
    expiresAt,
    createdAt,
  };
}

/* ---- local JSONL fallback (zero-config dev) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "virtual-accounts.jsonl");
}

async function appendToFile(row: VirtualAccountRow) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

async function readFileRows(): Promise<VirtualAccountRow[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as VirtualAccountRow);
  } catch {
    return [];
  }
}

async function rewriteFile(rows: VirtualAccountRow[]) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}
