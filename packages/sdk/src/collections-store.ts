import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql } from "./db";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";
import type { CollectionKind, CollectionStatus } from "./collections";

// Persistence for collection (pay-in) sessions — the deposit-side mirror of
// payouts.ts. A hosted-checkout top-up has no user session on the server when
// the webhook lands, so the mapping it needs to credit the right wallet is
// stored HERE at create time: session id -> { account, wallet address, amount,
// currency, chain } . The webhook looks the row up by session id (or our
// reference) and credits the stored wallet on-chain, idempotently (credited_at
// is the once-only latch). Neon-backed, with a local JSONL fallback for
// zero-config dev — same two-tier approach as payouts.ts.

export type CollectionRow = {
  /** Owning account (verified Privy user id, or the demo bucket). */
  account: string;
  /** Our top-up reference (ADD-…), also the provider idempotency key. */
  reference: string;
  /** Which collection method handled it (routes webhook/status back). */
  provider: string;
  kind: CollectionKind;
  /** Provider session id (checkout_id). Empty for DVA. */
  sessionId: string;
  /** Amount to credit, MAJOR units of `currency`. */
  amount: number;
  currency: string;
  /** Wallet to credit + the chain to credit it on (from the client at create). */
  address: string;
  chainKey?: string;
  status: CollectionStatus;
  id: string;
  createdAt: string;
  /** Set once, when the wallet has been credited (the double-credit latch). */
  creditedAt?: string;
  /** On-chain tx + chain of the credit mint. */
  creditTx?: string;
  creditChainKey?: string;
};

export type NewCollection = {
  account?: string;
  reference: string;
  provider: string;
  kind: CollectionKind;
  sessionId: string;
  amount: number;
  currency: string;
  address: string;
  chainKey?: string;
  status: CollectionStatus;
};

const hasNeon = () => Boolean(process.env.DATABASE_URL);

function sqlClient() {
  return getSql();
}

type Sql = ReturnType<typeof sqlClient>;

// At most ONCE per process (zero-config dev fallback) — never DDL on the hot path.
let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= createSchema(sql);
  return schemaReady;
}

async function createSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account       text NOT NULL DEFAULT 'demo',
      reference     text NOT NULL,
      provider      text NOT NULL DEFAULT 'dva',
      kind          text NOT NULL DEFAULT 'checkout',
      session_id    text NOT NULL DEFAULT '',
      amount        numeric NOT NULL,
      currency      text NOT NULL DEFAULT 'NGN',
      address       text NOT NULL,
      chain_key     text,
      status        text NOT NULL DEFAULT 'pending',
      credited_at   timestamptz,
      credit_tx     text,
      credit_chain  text,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS collections_session_idx ON collections (session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS collections_account_ref_idx ON collections (account, reference)`;
}

export async function createCollection(input: NewCollection): Promise<CollectionRow> {
  const account = input.account ?? DEMO_ACCOUNT;
  const row: CollectionRow = {
    account,
    reference: input.reference,
    provider: input.provider,
    kind: input.kind,
    sessionId: input.sessionId,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    address: input.address,
    chainKey: input.chainKey,
    status: input.status,
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
  };

  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const inserted = await sql`
        INSERT INTO collections
          (account, reference, provider, kind, session_id, amount, currency, address, chain_key, status)
        VALUES
          (${account}, ${row.reference}, ${row.provider}, ${row.kind}, ${row.sessionId},
           ${row.amount}, ${row.currency}, ${row.address}, ${row.chainKey ?? null}, ${row.status})
        RETURNING id, created_at
      `;
      row.id = String((inserted[0] as { id: unknown }).id);
      row.createdAt = new Date((inserted[0] as { created_at: string | Date }).created_at).toISOString();
      return row;
    } catch {
      /* fall through to file store */
    }
  }
  await appendToFile(row);
  return row;
}

function mapRow(r: Record<string, unknown>): CollectionRow {
  const createdAt = r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at);
  const creditedAt = r.credited_at
    ? r.credited_at instanceof Date
      ? r.credited_at.toISOString()
      : String(r.credited_at)
    : undefined;
  return {
    id: String(r.id),
    account: String(r.account ?? DEMO_ACCOUNT),
    reference: String(r.reference),
    provider: String(r.provider ?? "dva"),
    kind: (r.kind as CollectionKind) ?? "checkout",
    sessionId: String(r.session_id ?? ""),
    amount: Number(r.amount),
    currency: String(r.currency ?? "NGN"),
    address: String(r.address),
    chainKey: (r.chain_key as string) ?? undefined,
    status: (r.status as CollectionStatus) ?? "pending",
    creditedAt,
    creditTx: (r.credit_tx as string) ?? undefined,
    creditChainKey: (r.credit_chain as string) ?? undefined,
    createdAt,
  };
}

/** Find a session by its provider id, then (fallback) by our reference. */
export async function getCollection(sessionId: string, reference?: string): Promise<CollectionRow | null> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      if (sessionId) {
        const rows = await sql`SELECT * FROM collections WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT 1`;
        if (rows.length) return mapRow(rows[0] as Record<string, unknown>);
      }
      if (reference) {
        const rows = await sql`SELECT * FROM collections WHERE reference = ${reference} ORDER BY created_at DESC LIMIT 1`;
        if (rows.length) return mapRow(rows[0] as Record<string, unknown>);
      }
      return null;
    } catch {
      /* fall through */
    }
  }
  const rows = (await readFileRows()).reverse();
  return (
    rows.find((r) => sessionId && r.sessionId === sessionId) ??
    (reference ? rows.find((r) => r.reference === reference) ?? null : null)
  );
}

/**
 * Claim this session for crediting, atomically. Returns the row ONLY on the
 * first claim (credited_at was null and is now set); a second concurrent/retry
 * webhook gets null and must not credit again. Mint AFTER the claim succeeds,
 * then record the tx with setCollectionCreditTx — so a crash between claim and
 * mint fails safe (no double credit; status already paid).
 */
export async function claimCollectionCredit(sessionId: string): Promise<CollectionRow | null> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const rows = await sql`
        UPDATE collections SET status = 'paid', credited_at = now()
        WHERE session_id = ${sessionId} AND credited_at IS NULL
        RETURNING *
      `;
      return rows.length ? mapRow(rows[0] as Record<string, unknown>) : null;
    } catch {
      /* fall through */
    }
  }
  const rows = await readFileRows();
  let claimed: CollectionRow | null = null;
  const next = rows.map((r) => {
    if (r.sessionId === sessionId && !r.creditedAt) {
      claimed = { ...r, status: "paid", creditedAt: new Date().toISOString() };
      return claimed;
    }
    return r;
  });
  if (claimed) await rewriteFile(next);
  return claimed;
}

/** Record the credit tx (and the chain it minted on) after a successful mint. */
export async function setCollectionCreditTx(sessionId: string, tx: string, chainKey?: string): Promise<void> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      await sql`UPDATE collections SET credit_tx = ${tx}, credit_chain = ${chainKey ?? null} WHERE session_id = ${sessionId}`;
      return;
    } catch {
      /* fall through */
    }
  }
  const rows = await readFileRows();
  const next = rows.map((r) => (r.sessionId === sessionId ? { ...r, creditTx: tx, creditChainKey: chainKey } : r));
  await rewriteFile(next);
}

/** Apply a non-success status update (expired / failed). Never moves a credited
 *  row backwards off "paid". Idempotent. */
export async function updateCollectionStatus(sessionId: string, status: CollectionStatus): Promise<boolean> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const res = await sql`
        UPDATE collections SET status = ${status}
        WHERE session_id = ${sessionId} AND credited_at IS NULL RETURNING id
      `;
      return res.length > 0;
    } catch {
      /* fall through */
    }
  }
  const rows = await readFileRows();
  let changed = false;
  const next = rows.map((r) => {
    if (r.sessionId === sessionId && !r.creditedAt) {
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
  return path.join(process.cwd(), ".data", "collections.jsonl");
}

async function appendToFile(row: CollectionRow) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

async function readFileRows(): Promise<CollectionRow[]> {
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as CollectionRow);
  } catch {
    return [];
  }
}

async function rewriteFile(rows: CollectionRow[]) {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}
