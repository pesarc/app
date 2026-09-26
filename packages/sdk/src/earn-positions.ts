// Durable earn positions, scoped per account (Postgres when configured, JSONL
// fallback for zero-config dev) — the same storage pattern as transfers.ts.
// This replaces the old React-only positions so a deposit survives a reload,
// a new device, and is a real record. The retail-balance red line still holds:
// yield is corridor fees, never interest on a held balance.

import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql } from "./db";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

export type EarnPosition = {
  poolId: string;
  principal: number;
  updatedAt: string;
};

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS earn_positions (
      account    text NOT NULL,
      pool_id    text NOT NULL,
      principal  numeric NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (account, pool_id)
    )
  `.then(() => undefined);
  return schemaReady;
}

/** All of an account's positions (principal > 0), newest first. */
export async function listPositions(account = DEMO_ACCOUNT): Promise<EarnPosition[]> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT pool_id, principal, updated_at FROM earn_positions
        WHERE account = ${account} AND principal > 0
        ORDER BY updated_at DESC
      `;
      return (rows as any[]).map((r) => ({
        poolId: r.pool_id,
        principal: Number(r.principal),
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      }));
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return (all[account] ?? []).filter((p) => p.principal > 0);
}

/** Add to (or open) a position. Returns the new principal. */
export async function deposit(account: string, poolId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        INSERT INTO earn_positions (account, pool_id, principal, updated_at)
        VALUES (${account}, ${poolId}, ${amount}, now())
        ON CONFLICT (account, pool_id)
        DO UPDATE SET principal = earn_positions.principal + ${amount}, updated_at = now()
        RETURNING principal
      `;
      return Number((rows as any[])[0]?.principal ?? amount);
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const list = (all[account] ??= []);
  const existing = list.find((p) => p.poolId === poolId);
  if (existing) existing.principal += amount;
  else list.push({ poolId, principal: amount, updatedAt: new Date().toISOString() });
  const row = list.find((p) => p.poolId === poolId)!;
  row.updatedAt = new Date().toISOString();
  await writeFile(all);
  return row.principal;
}

/** Withdraw a position fully (retail funds are never frozen). */
export async function withdraw(account: string, poolId: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        DELETE FROM earn_positions WHERE account = ${account} AND pool_id = ${poolId} RETURNING pool_id
      `;
      return (rows as any[]).length > 0;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const list = all[account] ?? [];
  const next = list.filter((p) => p.poolId !== poolId);
  if (next.length === list.length) return false;
  all[account] = next;
  await writeFile(all);
  return true;
}

/* ---- JSONL-ish fallback (a single JSON map by account) ---- */

type FileShape = Record<string, EarnPosition[]>;

function filePath() {
  return path.join(process.cwd(), ".data", "earn-positions.json");
}

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
