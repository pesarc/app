import { NextResponse } from "next/server";
import { publicJwks, isAuthJwtConfigured } from "@pesarc/sdk/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public JWKS for Privy custom auth. Point the Privy dashboard's JWKS URL at
 * https://app.pesarc.xyz/api/auth/jwks so Privy can verify our session tokens.
 */
export async function GET() {
  if (!isAuthJwtConfigured) {
    return NextResponse.json({ keys: [] });
  }
  return NextResponse.json(publicJwks(), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
