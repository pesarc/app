// Developer API keys.
//
// A merchant (business account) creates a key pair to call the public REST API
// and to receive OPay-style redirects/webhooks:
//   - pk_live_…  publishable id (safe to store/show; identifies the key)
//   - sk_live_…  secret key (shown ONCE; only its SHA-256 hash is stored)
//   - whsec_…    signing secret used to HMAC redirect/webhook payloads so the
//                merchant can verify them server-side (stored so we can sign)
//
// Storage mirrors transfers.ts: Postgres when DATABASE_URL is set, otherwise a
// zero-config JSONL file so dev works with no database. Secrets never leave the
// server except the one-time reveal at creation.

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "./db";

export type ApiKeyRow = {
  id: string;
  account: string;
  label: string;
  /** Publishable id, safe to display in full (pk_live_…). */
  publishable: string;
  /** First chars of the secret for display (sk_live_abcd…). Never the whole key. */
  secretPrefix: string;
  /** Webhook/redirect signing secret (whsec_…), retrievable by the owner. */
  signingSecret: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

/** Full row plus the one-time secret. Returned only from createApiKey. */
export type ApiKeyCreated = ApiKeyRow & { secret: string };

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id             text PRIMARY KEY,
      account        text NOT NULL,
      label          text NOT NULL DEFAULT 'API key',
      publishable    text NOT NULL,
      secret_prefix  text NOT NULL,
      secret_hash    text NOT NULL,
      signing_secret text NOT NULL,
      created_at     timestamptz NOT NULL DEFAULT now(),
      last_used_at   timestamptz,
      revoked_at     timestamptz
    )
  `.then(() =>
    sql`CREATE INDEX IF NOT EXISTS api_keys_secret_hash_idx ON api_keys (secret_hash)`.then(
      () => undefined,
    ),
  );
  return schemaReady;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function token(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/** Create a key for `account`. The returned `secret` is shown only here. */
export async function createApiKey(
  account: string,
  label: string,
): Promise<ApiKeyCreated> {
  const id = `key_${token(12)}`;
  const publishable = `pk_live_${token(16)}`;
  const secret = `sk_live_${token(24)}`;
  const signingSecret = `whsec_${token(24)}`;
  const secretPrefix = secret.slice(0, 16); // sk_live_ + 8 hex
  const secretHash = sha256(secret);
  const createdAt = new Date().toISOString();

  const row: ApiKeyRow = {
    id,
    account,
    label,
    publishable,
    secretPrefix,
    signingSecret,
    createdAt,
  };

  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO api_keys
          (id, account, label, publishable, secret_prefix, secret_hash, signing_secret, created_at)
        VALUES
          (${id}, ${account}, ${label}, ${publishable}, ${secretPrefix},
           ${secretHash}, ${signingSecret}, ${createdAt})
      `;
      return { ...row, secret };
    } catch {
      /* fall through to file */
    }
  }
  await appendFile({ ...row, secretHash });
  return { ...row, secret };
}

/** The owner's keys (safe fields), newest first. */
export async function listApiKeys(account: string): Promise<ApiKeyRow[]> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM api_keys WHERE account = ${account} ORDER BY created_at DESC
      `;
      return (rows as any[]).map(mapRow);
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return all
    .filter((r) => r.account === account)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(stripStored);
}

/** Verify a presented secret key. Returns the owning account + signing secret. */
export async function verifyApiKey(
  rawSecret: string,
): Promise<{ account: string; keyId: string; signingSecret: string } | null> {
  if (!rawSecret.startsWith("sk_live_")) return null;
  const hash = sha256(rawSecret);

  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT id, account, signing_secret FROM api_keys
        WHERE secret_hash = ${hash} AND revoked_at IS NULL
        LIMIT 1
      `;
      const r = (rows as any[])[0];
      if (!r) return null;
      // Best-effort last-used stamp; never block the request on it.
      sql`UPDATE api_keys SET last_used_at = now() WHERE id = ${r.id}`.catch(() => {});
      return { account: r.account, keyId: r.id, signingSecret: r.signing_secret };
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const r = all.find((k) => k.secretHash === hash && !k.revokedAt);
  return r ? { account: r.account, keyId: r.id, signingSecret: r.signingSecret } : null;
}

/** The signing secret for a key id (owner-scoped), for HMAC verification/signing. */
export async function signingSecretFor(
  account: string,
  keyId: string,
): Promise<string | null> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT signing_secret FROM api_keys
        WHERE id = ${keyId} AND account = ${account} AND revoked_at IS NULL LIMIT 1
      `;
      return (rows as any[])[0]?.signing_secret ?? null;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const r = all.find((k) => k.id === keyId && k.account === account && !k.revokedAt);
  return r?.signingSecret ?? null;
}

/** Revoke a key the caller owns. */
export async function revokeApiKey(account: string, id: string): Promise<boolean> {
  const revokedAt = new Date().toISOString();
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        UPDATE api_keys SET revoked_at = ${revokedAt}
        WHERE id = ${id} AND account = ${account} AND revoked_at IS NULL
        RETURNING id
      `;
      return (rows as any[]).length > 0;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const r = all.find((k) => k.id === id && k.account === account && !k.revokedAt);
  if (!r) return false;
  r.revokedAt = revokedAt;
  await writeFile(all);
  return true;
}

function mapRow(r: any): ApiKeyRow {
  return {
    id: r.id,
    account: r.account,
    label: r.label,
    publishable: r.publishable,
    secretPrefix: r.secret_prefix,
    signingSecret: r.signing_secret,
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    lastUsedAt: r.last_used_at
      ? r.last_used_at instanceof Date
        ? r.last_used_at.toISOString()
        : String(r.last_used_at)
      : undefined,
    revokedAt: r.revoked_at
      ? r.revoked_at instanceof Date
        ? r.revoked_at.toISOString()
        : String(r.revoked_at)
      : undefined,
  };
}

/* ---- JSONL fallback (no DATABASE_URL) ---- */

type StoredKey = ApiKeyRow & { secretHash: string };

function filePath() {
  return path.join(process.cwd(), ".data", "api-keys.jsonl");
}

function stripStored(r: StoredKey): ApiKeyRow {
  const { secretHash: _omit, ...safe } = r;
  return safe;
}

async function readFile(): Promise<StoredKey[]> {
  try {
    const data = await fs.readFile(filePath(), "utf8");
    return data
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as StoredKey);
  } catch {
    return [];
  }
}

async function appendFile(row: StoredKey): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
}

async function writeFile(rows: StoredKey[]): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}
