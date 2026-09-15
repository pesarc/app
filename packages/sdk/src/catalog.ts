// A small CRUD store for admin-managed catalogs: prediction markets, stocks/ETFs
// and AI agents. JSON documents keyed by kind + id. Neon when DATABASE_URL is
// set, else a local JSONL file (same live-vs-mock pattern as transfers/payouts).
// Read paths seed from the static catalogs so the store is never empty.

import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

export type CatalogKind = "markets" | "stocks" | "agents";
export const CATALOG_KINDS: CatalogKind[] = ["markets", "stocks", "agents"];

export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  data: Record<string, unknown>;
  updatedAt: string;
};

const hasNeon = () => Boolean(process.env.DATABASE_URL);
function sql() {
  return neon(process.env.DATABASE_URL!);
}
type Sql = ReturnType<typeof sql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(c: Sql) {
  schemaReady ??= c`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id         text PRIMARY KEY,
      kind       text NOT NULL,
      data       jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.then(() => undefined);
  return schemaReady;
}

function newId(kind: string): string {
  return `${kind}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- public CRUD ---------------- */

// Persist one item: try Neon, fall back to the file store on any error (a
// misconfigured/broken DATABASE_URL must never 500 the CRUD).
async function persist(item: CatalogItem): Promise<void> {
  if (hasNeon()) {
    try {
      await upsertNeon(item);
      return;
    } catch {
      /* fall through to file */
    }
  }
  await replaceFile(item);
}

export async function listCatalog(kind: CatalogKind): Promise<CatalogItem[]> {
  let rows: CatalogItem[] = [];
  if (hasNeon()) {
    rows = await listNeon(kind); // catches internally, returns [] on error
  }
  if (rows.length === 0) rows = await listFile(kind);
  if (rows.length === 0) rows = await seed(kind); // seed from static catalog
  return rows;
}

export async function createCatalog(kind: CatalogKind, data: Record<string, unknown>): Promise<CatalogItem> {
  const item: CatalogItem = { id: newId(kind), kind, data, updatedAt: new Date().toISOString() };
  await persist(item);
  return item;
}

export async function updateCatalog(
  kind: CatalogKind,
  id: string,
  data: Record<string, unknown>,
): Promise<CatalogItem> {
  const item: CatalogItem = { id, kind, data, updatedAt: new Date().toISOString() };
  await persist(item);
  return item;
}

export async function removeCatalog(kind: CatalogKind, id: string): Promise<void> {
  if (hasNeon()) {
    try {
      const c = sql();
      await ensureSchema(c);
      await c`DELETE FROM catalog_items WHERE id = ${id} AND kind = ${kind}`;
      return;
    } catch {
      /* fall through to file */
    }
  }
  await deleteFile(kind, id);
}

/* ---------------- Neon ---------------- */

async function listNeon(kind: CatalogKind): Promise<CatalogItem[]> {
  try {
    const c = sql();
    await ensureSchema(c);
    const rows = (await c`SELECT * FROM catalog_items WHERE kind = ${kind} ORDER BY updated_at DESC`) as any[];
    return rows.map((r) => ({ id: r.id, kind: r.kind, data: r.data, updatedAt: String(r.updated_at) }));
  } catch {
    return [];
  }
}

async function upsertNeon(item: CatalogItem) {
  const c = sql();
  await ensureSchema(c);
  await c`
    INSERT INTO catalog_items (id, kind, data, updated_at)
    VALUES (${item.id}, ${item.kind}, ${JSON.stringify(item.data)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

/* ---------------- JSONL fallback ---------------- */

function file() {
  return path.join(process.cwd(), ".data", "catalog.jsonl");
}
async function readAll(): Promise<CatalogItem[]> {
  try {
    const raw = await fs.readFile(file(), "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as CatalogItem);
  } catch {
    return [];
  }
}
async function writeAll(rows: CatalogItem[]) {
  const f = file();
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}
async function listFile(kind: CatalogKind): Promise<CatalogItem[]> {
  return (await readAll()).filter((r) => r.kind === kind);
}
async function appendFile(item: CatalogItem) {
  const rows = await readAll();
  rows.push(item);
  await writeAll(rows);
}
async function replaceFile(item: CatalogItem) {
  const rows = await readAll();
  const i = rows.findIndex((r) => r.id === item.id);
  if (i >= 0) rows[i] = item;
  else rows.push(item);
  await writeAll(rows);
}
async function deleteFile(kind: CatalogKind, id: string) {
  const rows = (await readAll()).filter((r) => !(r.id === id && r.kind === kind));
  await writeAll(rows);
}

/* ---------------- seed from static catalogs ---------------- */

async function seed(kind: CatalogKind): Promise<CatalogItem[]> {
  const items = await defaults(kind);
  for (const it of items) await persist(it);
  return items;
}

async function defaults(kind: CatalogKind): Promise<CatalogItem[]> {
  const now = new Date().toISOString();
  const wrap = (data: Record<string, unknown>, i: number): CatalogItem => ({
    id: `${kind}_seed_${i}`,
    kind,
    data,
    updatedAt: now,
  });
  if (kind === "stocks") {
    const { INSTRUMENTS } = await import("./invest");
    return INSTRUMENTS.map((x, i) => wrap({ ...x }, i));
  }
  if (kind === "markets") {
    const { MARKETS } = await import("./markets");
    return MARKETS.map((m, i) => wrap({ question: m.question, kind: m.kind, collateral: m.collateral, closes: m.closes, resolves: m.resolves, flag: m.flag }, i));
  }
  // agents
  return [
    wrap({ name: "Pesarc Settlement Agent", model: "openai/gpt-4o-mini", capToken: "cNGN", cap: 50000, note: "Bounded by an on-chain session key." }, 0),
  ];
}
