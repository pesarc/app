import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { listCatalog, type CatalogKind } from "@pesarc/sdk/catalog";

// PUBLIC, read-only view of the catalog for the app's screens (Invest, Markets).
// Only public kinds are exposed here; all writes + the agents catalog live behind
// the admin-gated /api/admin/catalog.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_KINDS = new Set<CatalogKind>(["markets", "stocks"]);

export async function GET(request: Request) {
  const limited = rateLimit(request, "catalog-read", 120, 60_000);
  if (limited) return limited;
  const kind = new URL(request.url).searchParams.get("kind") as CatalogKind | null;
  if (!kind || !PUBLIC_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, items: await listCatalog(kind) });
}
