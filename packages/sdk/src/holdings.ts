// Durable invest holdings, scoped per account (Postgres when configured, JSONL
// fallback for zero-config dev). Replaces the old React-only portfolio so a
// buy is a real record that survives a reload and a new device. Prices/orders
// still flow through the broker adapter (broker.ts) — simulated by default,
// real when BROKER_API_URL is set.

import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql } from "./db";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

export type Holding = {
  symbol: string;
  shares: number;
  /** Volume-weighted average cost per share, in the instrument's currency. */
  avgPrice: number;
  updatedAt: string;
};

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS holdings (
      account    text NOT NULL,
      symbol     text NOT NULL,
      shares     numeric NOT NULL,
      avg_price  numeric NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (account, symbol)
    )
  `.then(() => undefined);
  return schemaReady;
}

export async function listHoldings(account = DEMO_ACCOUNT): Promise<Holding[]> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT symbol, shares, avg_price, updated_at FROM holdings
        WHERE account = ${account} AND shares > 0
        ORDER BY updated_at DESC
      `;
      return (rows as any[]).map(mapRow);
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return (all[account] ?? []).filter((h) => h.shares > 0);
}

/** Apply a filled buy: increase shares, roll the average cost. */
export async function applyBuy(
  account: string,
  symbol: string,
  shares: number,
  price: number,
): Promise<Holding | null> {
  if (shares <= 0) return null;
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        INSERT INTO holdings (account, symbol, shares, avg_price, updated_at)
        VALUES (${account}, ${symbol}, ${shares}, ${price}, now())
        ON CONFLICT (account, symbol) DO UPDATE SET
          avg_price = (holdings.shares * holdings.avg_price + ${shares} * ${price})
                      / (holdings.shares + ${shares}),
          shares = holdings.shares + ${shares},
          updated_at = now()
        RETURNING symbol, shares, avg_price, updated_at
      `;
      return mapRow((rows as any[])[0]);
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const list = (all[account] ??= []);
  const h = list.find((x) => x.symbol === symbol);
  if (h) {
    h.avgPrice = (h.shares * h.avgPrice + shares * price) / (h.shares + shares);
    h.shares += shares;
    h.updatedAt = new Date().toISOString();
  } else {
    list.push({ symbol, shares, avgPrice: price, updatedAt: new Date().toISOString() });
  }
  await writeFile(all);
  return list.find((x) => x.symbol === symbol)!;
}

/** Apply a filled sell: reduce shares (clamped at zero). Average cost unchanged. */
export async function applySell(
  account: string,
  symbol: string,
  shares: number,
): Promise<Holding | null> {
  if (shares <= 0) return null;
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        UPDATE holdings SET shares = GREATEST(0, shares - ${shares}), updated_at = now()
        WHERE account = ${account} AND symbol = ${symbol}
        RETURNING symbol, shares, avg_price, updated_at
      `;
      const r = (rows as any[])[0];
      return r ? mapRow(r) : null;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const h = (all[account] ?? []).find((x) => x.symbol === symbol);
  if (!h) return null;
  h.shares = Math.max(0, h.shares - shares);
  h.updatedAt = new Date().toISOString();
  await writeFile(all);
  return h;
}

function mapRow(r: any): Holding {
  return {
    symbol: r.symbol,
    shares: Number(r.shares),
    avgPrice: Number(r.avg_price),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

/* ---- JSON map fallback ---- */

type FileShape = Record<string, Holding[]>;

function filePath() {
  return path.join(process.cwd(), ".data", "holdings.json");
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
