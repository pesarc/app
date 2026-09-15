// Server-side guards for privileged API routes (operator-key endpoints).
//
// Two layers:
//  1. Bearer-secret auth — routes that spend the operator key or mutate the
//     netting set require `Authorization: Bearer $OPERATOR_API_SECRET`.
//     Gating on "is the key configured" is NOT authorization.
//  2. Best-effort in-memory rate limiting — blunts spam / gas-drain on a
//     single serverless instance. For real multi-instance limits, front with
//     an edge limiter (Vercel WAF / Upstash); this is the floor, not the wall.

import { NextResponse } from "next/server";

const encoder = new TextEncoder();

/** Constant-time string compare (avoids timing oracles on the secret). */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Enforces operator bearer auth **when configured**. Returns an error
 * response to return directly, or null when the caller may proceed.
 *
 * Enforcement is opt-in: set OPERATOR_API_SECRET to lock these routes down
 * (production MUST). While it's unset, the routes stay open for the public
 * testnet demo — the audit's requirement is that production sets it, so
 * ship with it set. This is auth-by-configuration, not "gate on the signing
 * key's presence" (that anti-pattern used SETTLE_OPERATOR_PK; this is a
 * separate secret whose sole job is authorization).
 */
export function requireOperator(request: Request): NextResponse | null {
  const secret = process.env.OPERATOR_API_SECRET;
  if (!secret) return null; // demo mode — enforcement disabled until configured
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !timingSafeEqual(token, secret)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }
  return null;
}

// --- rate limiting -------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

/**
 * Fixed-window limiter: at most `limit` requests per `windowMs` per IP+scope.
 * Returns a 429 response when exceeded, else null.
 */
export function rateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): NextResponse | null {
  const key = clientKey(request, scope);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  if (b.count >= limit) {
    const retry = Math.ceil((b.resetAt - now) / 1000);
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(retry) } },
    );
  }
  b.count++;
  // Opportunistic cleanup so the map can't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
  }
  return null;
}
