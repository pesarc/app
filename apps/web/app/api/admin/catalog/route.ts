import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import {
  listCatalog,
  createCatalog,
  updateCatalog,
  removeCatalog,
  CATALOG_KINDS,
  type CatalogKind,
} from "@pesarc/sdk/catalog";

// CRUD for admin-managed catalogs (markets / stocks / agents).
// Optional gate: if ADMIN_SECRET is set, requires `x-admin-secret` to match;
// otherwise open (demo). Always rate-limited.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("x-admin-secret") !== secret;
}

function kindOf(v: string | null): CatalogKind | null {
  return (CATALOG_KINDS as string[]).includes(v ?? "") ? (v as CatalogKind) : null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "admin-read", 60, 60_000);
  if (limited) return limited;
  if (forbidden(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const kind = kindOf(new URL(request.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ ok: false, error: "unknown kind" }, { status: 400 });
  return NextResponse.json({ ok: true, items: await listCatalog(kind) });
}

const writeSchema = z.object({
  kind: z.enum(["markets", "stocks", "agents"]),
  id: z.string().min(1).max(80).optional(),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "admin-write", 30, 60_000);
  if (limited) return limited;
  if (forbidden(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  const item = await createCatalog(parsed.data.kind, parsed.data.data);
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, "admin-write", 30, 60_000);
  if (limited) return limited;
  if (forbidden(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const parsed = writeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const item = await updateCatalog(parsed.data.kind, parsed.data.id, parsed.data.data);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, "admin-write", 30, 60_000);
  if (limited) return limited;
  if (forbidden(request)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const kind = kindOf(url.searchParams.get("kind"));
  const id = url.searchParams.get("id");
  if (!kind || !id) return NextResponse.json({ ok: false, error: "kind + id required" }, { status: 400 });
  await removeCatalog(kind, id);
  return NextResponse.json({ ok: true });
}
