// Payment sessions — the OPay-style "come into Pesarc to pay, then get
// redirected back" flow, and the object the public REST API creates.
//
// A merchant creates a session with an amount + a redirect_url. Pesarc hosts a
// checkout the customer completes; on success we redirect the browser back to
// redirect_url with a signed status the merchant verifies with their whsec.
//
// Storage mirrors transfers.ts / apiKeys.ts: Postgres when configured, else a
// zero-config JSONL file.

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSql } from "./db";

export type PaymentStatus = "pending" | "paid" | "expired" | "canceled";

export type PaymentRow = {
  id: string;
  account: string; // merchant account (owns the key that created it)
  apiKeyId: string;
  amount: number;
  currency: string;
  reference: string; // merchant reference (idempotent-ish receipt code)
  merchantName: string;
  description?: string;
  redirectUrl: string;
  /** Optional on-chain payout address for a real settlement in live mode. */
  payoutAddress?: string;
  metadata?: Record<string, unknown>;
  status: PaymentStatus;
  customerLabel?: string;
  txHash?: string;
  createdAt: string;
  paidAt?: string;
  expiresAt: string;
};

export type CreatePaymentInput = {
  account: string;
  apiKeyId: string;
  amount: number;
  currency: string;
  reference?: string;
  merchantName?: string;
  description?: string;
  redirectUrl: string;
  payoutAddress?: string;
  metadata?: Record<string, unknown>;
  /** Session lifetime in minutes (default 30). */
  ttlMinutes?: number;
};

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS payment_sessions (
      id             text PRIMARY KEY,
      account        text NOT NULL,
      api_key_id     text NOT NULL,
      amount         numeric NOT NULL,
      currency       text NOT NULL,
      reference      text NOT NULL,
      merchant_name  text NOT NULL DEFAULT 'A Pesarc merchant',
      description    text,
      redirect_url   text NOT NULL,
      payout_address text,
      metadata       jsonb,
      status         text NOT NULL DEFAULT 'pending',
      customer_label text,
      tx_hash        text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      paid_at        timestamptz,
      expires_at     timestamptz NOT NULL
    )
  `.then(() =>
    sql`CREATE INDEX IF NOT EXISTS payment_sessions_account_idx ON payment_sessions (account, created_at DESC)`.then(
      () => undefined,
    ),
  );
  return schemaReady;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow> {
  const now = Date.now();
  const row: PaymentRow = {
    id: `pay_${randomBytes(12).toString("hex")}`,
    account: input.account,
    apiKeyId: input.apiKeyId,
    amount: input.amount,
    currency: input.currency.toUpperCase(),
    reference: input.reference?.trim() || `PSC-${randomBytes(6).toString("hex").toUpperCase()}`,
    merchantName: input.merchantName?.trim() || "A Pesarc merchant",
    description: input.description?.trim() || undefined,
    redirectUrl: input.redirectUrl,
    payoutAddress: input.payoutAddress,
    metadata: input.metadata,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (input.ttlMinutes ?? 30) * 60_000).toISOString(),
  };

  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO payment_sessions
          (id, account, api_key_id, amount, currency, reference, merchant_name,
           description, redirect_url, payout_address, metadata, status,
           created_at, expires_at)
        VALUES
          (${row.id}, ${row.account}, ${row.apiKeyId}, ${row.amount}, ${row.currency},
           ${row.reference}, ${row.merchantName}, ${row.description ?? null},
           ${row.redirectUrl}, ${row.payoutAddress ?? null},
           ${row.metadata ? sql.json(row.metadata as any) : null}, ${row.status},
           ${row.createdAt}, ${row.expiresAt})
      `;
      return row;
    } catch {
      /* fall through */
    }
  }
  await appendFile(row);
  return row;
}

export async function getPayment(id: string): Promise<PaymentRow | null> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`SELECT * FROM payment_sessions WHERE id = ${id} LIMIT 1`;
      const r = (rows as any[])[0];
      return r ? withExpiry(mapRow(r)) : null;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const r = all.find((p) => p.id === id);
  return r ? withExpiry(r) : null;
}

export async function listPayments(account: string, limit = 50): Promise<PaymentRow[]> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM payment_sessions WHERE account = ${account}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
      return (rows as any[]).map((r) => withExpiry(mapRow(r)));
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return all
    .filter((p) => p.account === account)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
    .map(withExpiry);
}

/** Mark a pending session paid. No-op (returns current) if already settled. */
export async function markPaid(
  id: string,
  settle: { customerLabel?: string; txHash?: string } = {},
): Promise<PaymentRow | null> {
  const current = await getPayment(id);
  if (!current) return null;
  if (current.status !== "pending") return current;
  const paidAt = new Date().toISOString();

  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        UPDATE payment_sessions
        SET status = 'paid', paid_at = ${paidAt},
            customer_label = ${settle.customerLabel ?? null},
            tx_hash = ${settle.txHash ?? null}
        WHERE id = ${id} AND status = 'pending'
      `;
      return { ...current, status: "paid", paidAt, ...settle };
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const r = all.find((p) => p.id === id);
  if (!r || r.status !== "pending") return current;
  Object.assign(r, { status: "paid", paidAt, customerLabel: settle.customerLabel, txHash: settle.txHash });
  await writeFile(all);
  return r;
}

/** Serialize a session for the public API / checkout (no internal/secret fields). */
export function publicPayment(p: PaymentRow, origin: string) {
  return {
    id: p.id,
    object: "payment" as const,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    reference: p.reference,
    merchant_name: p.merchantName,
    description: p.description ?? null,
    redirect_url: p.redirectUrl,
    checkout_url: `${origin}/checkout?session=${p.id}`,
    payout_address: p.payoutAddress ?? null,
    metadata: p.metadata ?? {},
    tx_hash: p.txHash ?? null,
    created_at: p.createdAt,
    paid_at: p.paidAt ?? null,
    expires_at: p.expiresAt,
  };
}

/** HMAC-SHA256 of `${paymentId}.${reference}.${status}` in hex. */
export function signPayment(
  signingSecret: string,
  payment: Pick<PaymentRow, "id" | "reference" | "status">,
): string {
  return createHmac("sha256", signingSecret)
    .update(`${payment.id}.${payment.reference}.${payment.status}`)
    .digest("hex");
}

/** Constant-time verify of a redirect/webhook signature. */
export function verifyPaymentSignature(
  signingSecret: string,
  payment: Pick<PaymentRow, "id" | "reference" | "status">,
  signature: string,
): boolean {
  const expected = signPayment(signingSecret, payment);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Build the merchant redirect URL with the signed status appended. */
export function buildRedirect(
  payment: Pick<PaymentRow, "id" | "reference" | "status" | "redirectUrl">,
  signature: string,
): string {
  try {
    const url = new URL(payment.redirectUrl);
    url.searchParams.set("paymentId", payment.id);
    url.searchParams.set("reference", payment.reference);
    url.searchParams.set("status", payment.status);
    url.searchParams.set("signature", signature);
    return url.toString();
  } catch {
    return payment.redirectUrl;
  }
}

function withExpiry(p: PaymentRow): PaymentRow {
  if (p.status === "pending" && Date.now() > Date.parse(p.expiresAt)) {
    return { ...p, status: "expired" };
  }
  return p;
}

function mapRow(r: any): PaymentRow {
  const iso = (v: any) => (v instanceof Date ? v.toISOString() : v ? String(v) : undefined);
  return {
    id: r.id,
    account: r.account,
    apiKeyId: r.api_key_id,
    amount: Number(r.amount),
    currency: r.currency,
    reference: r.reference,
    merchantName: r.merchant_name,
    description: r.description ?? undefined,
    redirectUrl: r.redirect_url,
    payoutAddress: r.payout_address ?? undefined,
    metadata: r.metadata ?? undefined,
    status: r.status,
    customerLabel: r.customer_label ?? undefined,
    txHash: r.tx_hash ?? undefined,
    createdAt: iso(r.created_at)!,
    paidAt: iso(r.paid_at),
    expiresAt: iso(r.expires_at)!,
  };
}

/* ---- JSONL fallback (no DATABASE_URL) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "payments.jsonl");
}

async function readFile(): Promise<PaymentRow[]> {
  try {
    const data = await fs.readFile(filePath(), "utf8");
    return data.split("\n").filter(Boolean).map((l) => JSON.parse(l) as PaymentRow);
  } catch {
    return [];
  }
}

async function appendFile(row: PaymentRow): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
}

async function writeFile(rows: PaymentRow[]): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}
