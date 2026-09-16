import { promises as fs } from "node:fs";
import path from "node:path";
import { getSql } from "./db";

export type WaitlistEntry = {
  email: string;
  source?: string;
  createdAt: string;
};

export type StoreResult =
  | { status: "created" }
  | { status: "duplicate" }
  | { status: "error"; message: string };

/**
 * Pluggable waitlist store, in priority order:
 *
 * 1. DATABASE_URL set        → Neon Postgres (creates the `waitlist` table on
 *    first use; de-dupes on a unique email constraint).
 * 2. SUPABASE_URL + key set  → Supabase REST API.
 * 3. Otherwise               → local `.data/waitlist.jsonl` (zero-config dev).
 *
 * The route handler only depends on this `addToWaitlist` contract, so swapping
 * stores never touches the API or UI.
 */
export async function addToWaitlist(entry: WaitlistEntry): Promise<StoreResult> {
  if (process.env.DATABASE_URL) {
    return addViaNeon(entry);
  }

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    return addViaSupabase(url, key, entry);
  }

  return addViaFile(entry);
}

async function addViaNeon(entry: WaitlistEntry): Promise<StoreResult> {
  try {
    const sql = getSql();

    // Idempotent schema bootstrap — cheap, runs once meaningfully.
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email       text NOT NULL UNIQUE,
        source      text,
        created_at  timestamptz NOT NULL DEFAULT now()
      )
    `;

    // Explicit pre-check so "already registered" is detected even when the
    // table predates the UNIQUE constraint (ON CONFLICT throws there).
    const existing = await sql`
      SELECT id FROM waitlist WHERE lower(email) = lower(${entry.email}) LIMIT 1
    `;
    if (existing.length > 0) return { status: "duplicate" };

    try {
      const rows = await sql`
        INSERT INTO waitlist (email, source, created_at)
        VALUES (${entry.email}, ${entry.source ?? null}, ${entry.createdAt})
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      return rows.length > 0 ? { status: "created" } : { status: "duplicate" };
    } catch {
      // Legacy table without the unique constraint — plain insert; the
      // pre-check above already guarded against duplicates.
      await sql`
        INSERT INTO waitlist (email, source, created_at)
        VALUES (${entry.email}, ${entry.source ?? null}, ${entry.createdAt})
      `;
      return { status: "created" };
    }
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Neon query failed",
    };
  }
}

async function addViaSupabase(
  url: string,
  key: string,
  entry: WaitlistEntry
): Promise<StoreResult> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        email: entry.email,
        source: entry.source ?? null,
        created_at: entry.createdAt,
      }),
    });

    if (res.status === 409) return { status: "duplicate" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // 23505 = unique_violation if the table has a unique email constraint.
      if (text.includes("23505")) return { status: "duplicate" };
      return { status: "error", message: `Supabase ${res.status}: ${text}` };
    }
    return { status: "created" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Supabase request failed",
    };
  }
}

async function addViaFile(entry: WaitlistEntry): Promise<StoreResult> {
  try {
    const dir = path.join(process.cwd(), ".data");
    const file = path.join(dir, "waitlist.jsonl");
    await fs.mkdir(dir, { recursive: true });

    // Cheap duplicate check for the local dev store.
    try {
      const existing = await fs.readFile(file, "utf8");
      if (existing.includes(`"email":"${entry.email}"`)) {
        return { status: "duplicate" };
      }
    } catch {
      // file doesn't exist yet — fine.
    }

    await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
    return { status: "created" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "File write failed",
    };
  }
}
