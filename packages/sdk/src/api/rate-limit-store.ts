// Store-backed rate limiting + usage metering for the public developer API.
//
// The in-memory limiter (guard.ts) is a per-instance floor. This adds a shared
// fixed-window counter in Postgres so the limit holds ACROSS instances/replicas
// and per API key, plus a daily usage meter developers can see. It FAILS OPEN:
// a DB hiccup never blocks a request (the in-memory floor still applies), and
// with no DATABASE_URL it is a no-op.

import { NextResponse } from "next/server";
import { getSql } from "../db";

const hasDb = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket   text PRIMARY KEY,
      count    integer NOT NULL DEFAULT 0,
      reset_at timestamptz NOT NULL
    )
  `
    .then(
      () =>
        sql`CREATE TABLE IF NOT EXISTS api_usage (
          account text NOT NULL,
          key_id  text NOT NULL,
          day     date NOT NULL,
          count   integer NOT NULL DEFAULT 0,
          PRIMARY KEY (account, key_id, day)
        )`,
    )
    .then(() => undefined);
  return schemaReady;
}

/**
 * Shared fixed-window rate limit for `key` (e.g. `v1:<apiKeyId>`). Returns a 429
 * NextResponse when exceeded, else null. No-op (null) without a DB, and
 * fail-open on any DB error so a database blip can't lock out the API.
 */
export async function storeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<NextResponse | null> {
  if (!hasDb()) return null;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucket = `${key}:${windowStart}`;
  const resetAt = new Date(windowStart + windowMs);
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      INSERT INTO rate_limits (bucket, count, reset_at)
      VALUES (${bucket}, 1, ${resetAt})
      ON CONFLICT (bucket) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `;
    const count = Number((rows as any[])[0]?.count ?? 1);
    // Opportunistic cleanup so the table can't grow unbounded.
    if (Math.random() < 0.02) {
      sql`DELETE FROM rate_limits WHERE reset_at < now()`.catch(() => {});
    }
    if (count > limit) {
      const retry = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
      return NextResponse.json(
        { error: { type: "rate_limit_error", message: "Too many requests." } },
        { status: 429, headers: { "Retry-After": String(retry) } },
      );
    }
    return null;
  } catch {
    return null; // fail open — the in-memory floor still guards
  }
}

/** Increment the daily usage meter for a key (best-effort, never blocks). */
export function recordUsage(account: string, keyId: string): void {
  if (!hasDb()) return;
  const day = new Date().toISOString().slice(0, 10);
  const sql = getSql();
  ensureSchema(sql)
    .then(
      () => sql`
        INSERT INTO api_usage (account, key_id, day, count)
        VALUES (${account}, ${keyId}, ${day}, 1)
        ON CONFLICT (account, key_id, day) DO UPDATE SET count = api_usage.count + 1
      `,
    )
    .catch(() => {});
}

/** Today's total API calls for an account (across its keys). */
export async function getUsageToday(account: string): Promise<number> {
  if (!hasDb()) return 0;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const day = new Date().toISOString().slice(0, 10);
    const rows = await sql`
      SELECT COALESCE(SUM(count), 0) AS c FROM api_usage WHERE account = ${account} AND day = ${day}
    `;
    return Number((rows as any[])[0]?.c ?? 0);
  } catch {
    return 0;
  }
}
