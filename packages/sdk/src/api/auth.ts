// Server-side user identity, derived from the Privy access token the client
// already holds after sign-in.
//
// Closes the audit's IDOR findings: rows are scoped to the *authenticated*
// user instead of one shared demo bucket, so nobody can read a stranger's
// payout PII by guessing a reference.
//
// Degradation is deliberate: with no valid token the caller is the shared demo
// account (mock mode has no Privy at all). Real users are always authenticated,
// so their rows are never in that bucket.

import { PrivyClient } from "@privy-io/server-auth";

/** Shared bucket for unauthenticated/mock-mode callers. Never holds real users. */
export const DEMO_ACCOUNT = "demo";

let client: PrivyClient | null = null;

function privy(): PrivyClient | null {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!appId || !secret) return null; // mock mode
  if (!client) client = new PrivyClient(appId, secret);
  return client;
}

/** True when the deployment can actually verify identities. */
export function authConfigured(): boolean {
  return privy() !== null;
}

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/**
 * The account id to scope DB rows by: the verified Privy user id, or the demo
 * bucket when there's no valid token. Never throws — callers get a usable id.
 */
export async function getAccount(request: Request): Promise<string> {
  return (await getVerifiedUserId(request)) ?? DEMO_ACCOUNT;
}

/**
 * The verified Privy user id, or null. Use when a route must be authenticated
 * (returns null → respond 401).
 */
export async function getVerifiedUserId(request: Request): Promise<string | null> {
  const p = privy();
  if (!p) return null;
  const token = bearer(request);
  if (!token) return null;
  try {
    const claims = await p.verifyAuthToken(token);
    return claims.userId ?? null;
  } catch {
    return null; // expired / forged / wrong app
  }
}
