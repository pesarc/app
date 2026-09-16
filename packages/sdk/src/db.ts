// Single shared Postgres client (postgres.js). Speaks standard Postgres, so it
// works with a self-hosted database, DigitalOcean Managed Postgres, or Neon over
// TCP — unlike the old Neon serverless driver, which only reached Neon's HTTP
// endpoint. On a long-lived server (our container) a pooled TCP client is the
// right choice; the pool is created once and reused.

import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

/** The shared pooled SQL client. Call only when DATABASE_URL is set (hasDb). */
export function getSql() {
  if (!client) {
    const url = process.env.DATABASE_URL as string;
    // Enable TLS only for managed hosts (or an explicit sslmode=require). A
    // self-hosted Postgres on the private container network needs no TLS.
    const needsSsl =
      /[?&]sslmode=require/.test(url) || /\.neon\.tech|\.ondigitalocean\.com/.test(url);
    client = postgres(url, { ssl: needsSsl ? "require" : false, max: 10 });
  }
  return client;
}

export const hasDb = () => Boolean(process.env.DATABASE_URL);
