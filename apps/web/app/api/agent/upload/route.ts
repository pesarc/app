import { NextResponse } from "next/server";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { getAccount } from "@pesarc/sdk/api/auth";
import { parseUploadFile } from "@pesarc/sdk/agent/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED = new Set(["csv", "tsv", "zip", "txt", "md"]);

/**
 * Agent file ingestion (read + draft only). The user attaches a CSV/ZIP of
 * recipients (or plain text); we parse it DETERMINISTICALLY server-side and
 * return a draft the chat renders as a preview. This route NEVER moves money —
 * the user confirms each row in the Send flow afterwards.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "agent-upload", 12, 60_000);
  if (limited) return limited;

  // Account scope (kept for parity / future per-account drafts); parsing itself
  // holds no PII at rest.
  await getAccount(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, summary: "That upload wasn't a valid file." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, summary: "Attach a file to read." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, summary: "That file is over 4MB. Trim it or split it into smaller files." }, { status: 413 });
  }
  const ext = (file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "");
  if (!ALLOWED.has(ext)) {
    return NextResponse.json(
      { ok: false, kind: "unsupported", filename: file.name, rows: [], rowCount: 0, totals: {}, warnings: [], summary: `I can read CSV, ZIP and text files. I can't read “.${ext}” yet.` },
      { status: 200 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseUploadFile(file.name, bytes);
  return NextResponse.json(parsed, { status: 200 });
}
