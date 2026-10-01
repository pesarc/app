// Durable session-key GRANT store (server only). One active grant per
// (account, chain). The session PRIVATE key is sealed with the identity envelope
// (AES-256-GCM under IDENTITY_ENC_KEY) and never leaves the server in the clear;
// the agent decrypts it only to sign a scoped, capped, expiring cross-chain move.
//
// This stores a key that can move funds within its cap, so it is held to the same
// bar as PII: encrypted at rest, short-lived, revocable, and testnet-gated by the
// callers in permissions.ts. Postgres when configured, JSONL for dev — the same
// pattern as the identity store.

import { promises as fs } from "node:fs";
import path from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getSql, hasDb } from "../../db";
import { seal, open, encryptionReady } from "../../identity/crypto";

type Sql = ReturnType<typeof getSql>;

export type GrantStatus = "pending" | "active" | "revoked";

export type SessionGrant = {
  account: string; // smart account address (lowercased)
  chainKey: string;
  sessionAddress: `0x${string}`; // the session key's public address
  sessionKeySealed: string; // sealed private key — server only, never returned to clients
  context?: `0x${string}`; // the on-chain grant context from grantPermissions
  capWei: string; // max USDC (wei) the key may move over its life
  spentWei: string; // cumulative moved so far
  expirySec: number;
  status: GrantStatus;
  createdAt: string;
  updatedAt: string;
};

/** What a client may see — never the sealed key. */
export type SafeGrant = Omit<SessionGrant, "sessionKeySealed">;
export const toSafe = (g: SessionGrant): SafeGrant => {
  const { sessionKeySealed: _omit, ...rest } = g;
  void _omit;
  return rest;
};

const key = (account: string, chainKey: string) => `${account.toLowerCase()}:${chainKey}`;
const now = () => new Date().toISOString();
const isLive = (g: SessionGrant) =>
  g.status === "active" && g.expirySec > Math.floor(Date.now() / 1000);

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS session_grants (
      account            text NOT NULL,
      chain_key          text NOT NULL,
      session_address    text NOT NULL,
      session_key_sealed text NOT NULL,
      context            text,
      cap_wei            text NOT NULL,
      spent_wei          text NOT NULL DEFAULT '0',
      expiry_sec         bigint NOT NULL,
      status             text NOT NULL DEFAULT 'pending',
      created_at         timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (account, chain_key)
    )
  `.then(() => undefined);
  return schemaReady;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowTo(r: any): SessionGrant {
  return {
    account: r.account,
    chainKey: r.chain_key,
    sessionAddress: r.session_address,
    sessionKeySealed: r.session_key_sealed,
    context: r.context ?? undefined,
    capWei: String(r.cap_wei),
    spentWei: String(r.spent_wei ?? "0"),
    expirySec: Number(r.expiry_sec),
    status: r.status,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// ---- file fallback ---------------------------------------------------------

type FileShape = Record<string, SessionGrant>;
const filePath = () => path.join(process.cwd(), ".data", "session-grants.json");
async function readFile(): Promise<FileShape> {
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as FileShape;
  } catch {
    return {};
  }
}
async function writeFile(data: FileShape): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data), "utf8");
}

async function put(g: SessionGrant): Promise<void> {
  if (hasDb()) {
    const sql = getSql();
    await ensureSchema(sql);
    await sql`
      INSERT INTO session_grants
        (account, chain_key, session_address, session_key_sealed, context, cap_wei, spent_wei, expiry_sec, status, updated_at)
      VALUES
        (${g.account}, ${g.chainKey}, ${g.sessionAddress}, ${g.sessionKeySealed}, ${g.context ?? null},
         ${g.capWei}, ${g.spentWei}, ${g.expirySec}, ${g.status}, now())
      ON CONFLICT (account, chain_key) DO UPDATE SET
        session_address = EXCLUDED.session_address,
        session_key_sealed = EXCLUDED.session_key_sealed,
        context = EXCLUDED.context,
        cap_wei = EXCLUDED.cap_wei,
        spent_wei = EXCLUDED.spent_wei,
        expiry_sec = EXCLUDED.expiry_sec,
        status = EXCLUDED.status,
        updated_at = now()
    `;
    return;
  }
  const all = await readFile();
  all[key(g.account, g.chainKey)] = g;
  await writeFile(all);
}

export async function getGrant(account: string, chainKey: string): Promise<SessionGrant | null> {
  if (hasDb()) {
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT * FROM session_grants WHERE account = ${account.toLowerCase()} AND chain_key = ${chainKey} LIMIT 1
    `;
    return rows[0] ? rowTo(rows[0]) : null;
  }
  const all = await readFile();
  return all[key(account, chainKey)] ?? null;
}

/** A usable grant: active, unexpired, with a context. Null otherwise. */
export async function getActiveGrant(account: string, chainKey: string): Promise<SessionGrant | null> {
  const g = await getGrant(account, chainKey);
  return g && isLive(g) && g.context ? g : null;
}

/**
 * Mint a fresh session keypair, seal the private key, and store a PENDING grant.
 * Returns the session key's public address so the client can grant on-chain
 * permissions to it. The private key never leaves the server.
 */
export async function createPending(args: {
  account: string;
  chainKey: string;
  capWei: bigint;
  expirySec: number;
}): Promise<{ sessionAddress: `0x${string}` }> {
  if (!encryptionReady()) throw new Error("IDENTITY_ENC_KEY is not set; cannot seal a session key");
  const pk = generatePrivateKey();
  const acct = privateKeyToAccount(pk);
  const g: SessionGrant = {
    account: args.account.toLowerCase(),
    chainKey: args.chainKey,
    sessionAddress: acct.address,
    sessionKeySealed: seal(pk),
    capWei: args.capWei.toString(),
    spentWei: "0",
    expirySec: args.expirySec,
    status: "pending",
    createdAt: now(),
    updatedAt: now(),
  };
  await put(g);
  return { sessionAddress: acct.address };
}

/** Attach the on-chain grant context and activate. Verifies the pending key. */
export async function finalizeGrant(args: {
  account: string;
  chainKey: string;
  sessionAddress: string;
  context: `0x${string}`;
}): Promise<SafeGrant> {
  const g = await getGrant(args.account, args.chainKey);
  if (!g) throw new Error("No pending grant to finalize");
  if (g.sessionAddress.toLowerCase() !== args.sessionAddress.toLowerCase()) {
    throw new Error("Session address mismatch");
  }
  const next: SessionGrant = { ...g, context: args.context, status: "active", updatedAt: now() };
  await put(next);
  return toSafe(next);
}

/** The decrypted session private key for signing. Server-internal only. */
export function openSessionKey(g: SessionGrant): `0x${string}` {
  return open(g.sessionKeySealed) as `0x${string}`;
}

/** Add to the cumulative spend after a successful move. */
export async function recordSpend(account: string, chainKey: string, addWei: bigint): Promise<void> {
  const g = await getGrant(account, chainKey);
  if (!g) return;
  const spent = (BigInt(g.spentWei) + addWei).toString();
  await put({ ...g, spentWei: spent, updatedAt: now() });
}

/** Remaining headroom under the cap, in wei. */
export function remainingWei(g: SessionGrant): bigint {
  const left = BigInt(g.capWei) - BigInt(g.spentWei);
  return left > 0n ? left : 0n;
}

/** Revoke a grant. The server stops using it immediately; the on-chain grant
 *  still lapses at expiry (or can be revoked on-chain separately). */
export async function revokeGrant(account: string, chainKey: string): Promise<void> {
  const g = await getGrant(account, chainKey);
  if (!g) return;
  await put({ ...g, status: "revoked", updatedAt: now() });
}
