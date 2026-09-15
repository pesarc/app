import { NextResponse } from "next/server";
import { z } from "zod";
import { addToWaitlist } from "@/lib/waitlist";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  source: z.string().trim().max(80).optional(),
  // Honeypot: bots fill hidden fields; humans leave it empty.
  company: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please check your details.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // Honeypot tripped — pretend success, store nothing.
  if (parsed.data.company) {
    return NextResponse.json({ ok: true, status: "created" });
  }

  const result = await addToWaitlist({
    email: parsed.data.email,
    source: parsed.data.source ?? "landing",
    createdAt: new Date().toISOString(),
  });

  if (result.status === "error") {
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, status: result.status });
}
