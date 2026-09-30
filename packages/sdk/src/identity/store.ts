// Durable identity store (Postgres when configured, JSONL fallback for
// zero-config dev) — the same storage pattern as transfers.ts / earn-positions.ts.
// One row per identity; phone / username / nuban are columns, addresses are
// jsonb so a wallet address resolves with a containment query. Nothing here is
// custodial: it maps handles to public addresses, never keys or funds.

import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql } from "../db";
import type { ChainAddress, Identity } from "./types";

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS identities (
      id         text PRIMARY KEY,
      phone      text UNIQUE,
      username   text UNIQUE,
      nuban      text UNIQUE,
      bank_code  text,
      provider   text,
      kyc        text NOT NULL DEFAULT 'none',
      addresses  jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.then(() => undefined);
  return schemaReady;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToIdentity(r: any): Identity {
  return {
    id: r.id,
    phone: r.phone ?? undefined,
    username: r.username ?? undefined,
    addresses: (r.addresses ?? []) as ChainAddress[],
    bank: r.nuban ? { number: r.nuban, bankCode: r.bank_code ?? undefined, provider: r.provider ?? undefined } : undefined,
    kyc: r.kyc ?? "none",
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// ---- file fallback ---------------------------------------------------------

type FileShape = Record<string, Identity>;
const filePath = () => path.join(process.cwd(), ".data", "identities.json");

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

const norm = (s: string) => s.trim().toLowerCase();

// ---- reads -----------------------------------------------------------------

export async function getIdentity(id: string): Promise<Identity | null> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = (await sql`SELECT * FROM identities WHERE id = ${id} LIMIT 1`) as any[];
      return rows[0] ? rowToIdentity(rows[0]) : null;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return all[id] ?? null;
}

/** Find an identity by any handle. `by` narrows the column; address matches any chain. */
export async function findIdentity(
  value: string,
  by: "phone" | "username" | "nuban" | "address",
): Promise<Identity | null> {
  const v = by === "address" ? value : norm(value);
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      let rows: any[];
      if (by === "phone") rows = (await sql`SELECT * FROM identities WHERE phone = ${v} LIMIT 1`) as any[];
      else if (by === "username") rows = (await sql`SELECT * FROM identities WHERE username = ${v} LIMIT 1`) as any[];
      else if (by === "nuban") rows = (await sql`SELECT * FROM identities WHERE nuban = ${v} LIMIT 1`) as any[];
      else
        rows = (await sql`
          SELECT * FROM identities WHERE addresses @> ${JSON.stringify([{ address: v.toLowerCase() }])}::jsonb LIMIT 1
        `) as any[];
      return rows[0] ? rowToIdentity(rows[0]) : null;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  for (const idty of Object.values(all)) {
    if (by === "phone" && idty.phone && norm(idty.phone) === v) return idty;
    if (by === "username" && idty.username && norm(idty.username) === v) return idty;
    if (by === "nuban" && idty.bank?.number === v) return idty;
    if (by === "address" && idty.addresses.some((a) => a.address.toLowerCase() === v.toLowerCase())) return idty;
  }
  return null;
}

// ---- writes ----------------------------------------------------------------

/** Create or update an identity by id, merging the given fields. */
export async function upsertIdentity(
  id: string,
  patch: Partial<Omit<Identity, "id" | "createdAt" | "updatedAt">>,
): Promise<Identity> {
  const now = new Date().toISOString();
  const existing = (await getIdentity(id)) ?? {
    id,
    addresses: [] as ChainAddress[],
    kyc: "none" as const,
    createdAt: now,
    updatedAt: now,
  };
  // Merge addresses by (chain,address), dedup.
  const addresses = [...existing.addresses];
  for (const a of patch.addresses ?? []) {
    if (!addresses.some((x) => x.chain === a.chain && x.address.toLowerCase() === a.address.toLowerCase()))
      addresses.push(a);
  }
  const next: Identity = {
    ...existing,
    ...patch,
    id,
    addresses,
    kyc: patch.kyc ?? existing.kyc,
    createdAt: existing.createdAt,
    updatedAt: now,
  };

  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO identities (id, phone, username, nuban, bank_code, provider, kyc, addresses, created_at, updated_at)
        VALUES (${id}, ${next.phone ?? null}, ${next.username ?? null}, ${next.bank?.number ?? null},
                ${next.bank?.bankCode ?? null}, ${next.bank?.provider ?? null}, ${next.kyc},
                ${JSON.stringify(next.addresses)}::jsonb, ${next.createdAt}, ${now})
        ON CONFLICT (id) DO UPDATE SET
          phone = EXCLUDED.phone, username = EXCLUDED.username, nuban = EXCLUDED.nuban,
          bank_code = EXCLUDED.bank_code, provider = EXCLUDED.provider, kyc = EXCLUDED.kyc,
          addresses = EXCLUDED.addresses, updated_at = ${now}
      `;
      return next;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  all[id] = next;
  await writeFile(all);
  return next;
}

/** Attach a chain address to an identity (idempotent). */
export function linkAddress(id: string, chain: string, address: string): Promise<Identity> {
  return upsertIdentity(id, { addresses: [{ chain, address }] });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
