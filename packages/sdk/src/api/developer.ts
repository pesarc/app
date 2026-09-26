// Guard for the public developer REST API (/api/v1/*).
//
// Callers authenticate with a secret key: `Authorization: Bearer sk_live_…`.
// Unlike the operator guard (a single shared secret), each merchant has their
// own key, so a verified key also tells us WHICH account to scope writes to.

import { NextResponse } from "next/server";
import { verifyApiKey } from "../apiKeys";

export type ApiKeyContext = { account: string; keyId: string; signingSecret: string };

/**
 * Resolve the caller's API key. Returns the key context, or a NextResponse to
 * return directly (401) when the key is missing/invalid/revoked.
 */
export async function requireApiKey(
  request: Request,
): Promise<ApiKeyContext | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!raw) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Missing API key. Send Authorization: Bearer sk_live_…" } },
      { status: 401 },
    );
  }
  const ctx = await verifyApiKey(raw);
  if (!ctx) {
    return NextResponse.json(
      { error: { type: "authentication_error", message: "Invalid or revoked API key." } },
      { status: 401 },
    );
  }
  return ctx;
}

/** Type guard so routes can branch on the union cleanly. */
export function isApiError(x: ApiKeyContext | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}
