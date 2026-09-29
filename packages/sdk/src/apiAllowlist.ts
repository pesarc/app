// Per-account IP allowlist for the public developer API (/api/v1/*).
//
// A business can restrict which source IPs may use their API keys. Opt-in, like
// the operator guard: an EMPTY allowlist means "allow any IP" (nothing is locked
// until the merchant adds an entry). Once one entry exists, only listed IPs and
// CIDR ranges may call the API with that account's keys.
//
// Storage mirrors apiKeys.ts: Postgres when DATABASE_URL is set, otherwise a
// zero-config JSONL file so dev works with no database.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getSql } from "./db";

export type AllowedIpRow = {
  id: string;
  account: string;
  /** A single IP (v4/v6) or an IPv4 CIDR, e.g. "203.0.113.7" or "203.0.113.0/24". */
  cidr: string;
  label: string;
  createdAt: string;
};

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS api_ip_allowlist (
      id         text PRIMARY KEY,
      account    text NOT NULL,
      cidr       text NOT NULL,
      label      text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.then(() =>
    sql`CREATE INDEX IF NOT EXISTS api_ip_allowlist_account_idx ON api_ip_allowlist (account)`.then(
      () => undefined,
    ),
  );
  return schemaReady;
}

function token(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

/** Validate + normalise an IP or IPv4 CIDR. Returns null when malformed. */
export function normalizeCidr(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const [addr, maskStr] = s.split("/");
  // IPv4 (optionally with CIDR mask).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    const octets = addr.split(".").map(Number);
    if (octets.some((o) => o > 255)) return null;
    if (maskStr === undefined) return addr;
    const mask = Number(maskStr);
    if (!Number.isInteger(mask) || mask < 0 || mask > 32) return null;
    return `${addr}/${mask}`;
  }
  // IPv6 — accept a plausible address (exact match only; no CIDR for v6 here).
  if (maskStr === undefined && /^[0-9a-f:]+$/.test(addr) && addr.includes(":")) {
    return addr;
  }
  return null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Does `ip` fall within `cidr` (single IP, IPv4 CIDR, or exact IPv6)? */
export function ipMatches(cidr: string, ip: string): boolean {
  const norm = normalizeCidr(cidr);
  if (!norm) return false;
  const cleanIp = ip.trim().toLowerCase();
  // IPv4 / IPv4-CIDR.
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d+)?$/.test(norm)) {
    const [base, maskStr] = norm.split("/");
    const mask = maskStr === undefined ? 32 : Number(maskStr);
    const a = ipv4ToInt(base);
    const b = ipv4ToInt(cleanIp);
    if (a === null || b === null) return false;
    if (mask === 0) return true;
    const shift = 32 - mask;
    return a >>> shift === b >>> shift;
  }
  // IPv6 exact match.
  return norm === cleanIp;
}

/**
 * True when `ip` may use `account`'s API. Empty allowlist => allow all (opt-in).
 * Never throws: a storage error fails OPEN to the empty-allowlist default so a
 * database blip can't lock a merchant out of their own API.
 */
export async function ipAllowed(account: string, ip: string): Promise<boolean> {
  try {
    const rows = await listAllowedIps(account);
    if (rows.length === 0) return true;
    return rows.some((r) => ipMatches(r.cidr, ip));
  } catch {
    return true;
  }
}

/** The account's allowlist entries, newest first. */
export async function listAllowedIps(account: string): Promise<AllowedIpRow[]> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM api_ip_allowlist WHERE account = ${account} ORDER BY created_at DESC
      `;
      return (rows as any[]).map(mapRow);
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  return all
    .filter((r) => r.account === account)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Add an entry. Returns the created row, or null when the CIDR is malformed. */
export async function addAllowedIp(
  account: string,
  cidr: string,
  label = "",
): Promise<AllowedIpRow | null> {
  const norm = normalizeCidr(cidr);
  if (!norm) return null;
  const row: AllowedIpRow = {
    id: `ip_${token(10)}`,
    account,
    cidr: norm,
    label: label.trim().slice(0, 60),
    createdAt: new Date().toISOString(),
  };
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      await sql`
        INSERT INTO api_ip_allowlist (id, account, cidr, label, created_at)
        VALUES (${row.id}, ${row.account}, ${row.cidr}, ${row.label}, ${row.createdAt})
      `;
      return row;
    } catch {
      /* fall through */
    }
  }
  await appendFile(row);
  return row;
}

/** Remove an entry the caller owns. */
export async function removeAllowedIp(account: string, id: string): Promise<boolean> {
  if (hasDb()) {
    try {
      const sql = getSql();
      await ensureSchema(sql);
      const rows = await sql`
        DELETE FROM api_ip_allowlist WHERE id = ${id} AND account = ${account} RETURNING id
      `;
      return (rows as any[]).length > 0;
    } catch {
      /* fall through */
    }
  }
  const all = await readFile();
  const next = all.filter((r) => !(r.id === id && r.account === account));
  if (next.length === all.length) return false;
  await writeFile(next);
  return true;
}

function mapRow(r: any): AllowedIpRow {
  return {
    id: r.id,
    account: r.account,
    cidr: r.cidr,
    label: r.label ?? "",
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/* ---- JSONL fallback (no DATABASE_URL) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "api-ip-allowlist.jsonl");
}

async function readFile(): Promise<AllowedIpRow[]> {
  try {
    const data = await fs.readFile(filePath(), "utf8");
    return data
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as AllowedIpRow);
  } catch {
    return [];
  }
}

async function appendFile(row: AllowedIpRow): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
}

async function writeFile(rows: AllowedIpRow[]): Promise<void> {
  const file = filePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
}
