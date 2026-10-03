import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@pesarc/sdk/api/auth";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { selectCollectionAdapter, collectionMethodFor } from "@pesarc/sdk/collections";
import { createCollection } from "@pesarc/sdk/collections-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pay-in (add-money) via hosted checkout. POST starts a checkout session for an
// amount and returns its hosted URL; the wallet is credited later by the
// collections webhook on the success event. GET reports which collection method
// is active for the caller's market so the UI can branch (static NUBAN vs an
// "Add money" button) without starting a session.

/** GET ?currency=NGN -> { method: "dva" | "checkout", currency }. */
export async function GET(request: Request) {
  const limited = rateLimit(request, "collections-read", 60, 60_000);
  if (limited) return limited;
  const currency = (new URL(request.url).searchParams.get("currency") || "NGN").toUpperCase();
  const adapter = await collectionMethodFor(currency);
  return NextResponse.json({ ok: true, method: adapter.kind, currency });
}

const schema = z.object({
  amount: z.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).optional(),
  country: z.string().trim().length(2).optional(),
  address: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "Connect your wallet first."),
  chainKey: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(120).optional(),
});

function newReference(): string {
  return `ADD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Start a hosted-checkout top-up, owned by the caller. */
export async function POST(request: Request) {
  const limited = rateLimit(request, "collections-write", 15, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data." },
      { status: 400 },
    );
  }
  const { amount, currency, country, address, chainKey, email } = parsed.data;
  const account = await getAccount(request);
  const reference = newReference();

  const adapter = await selectCollectionAdapter({ reference, amount, currency, country });
  if (adapter.kind !== "checkout" || !adapter.createCheckout) {
    // The active method is a dedicated account number, not a checkout — the UI
    // should be showing that instead. No provider name in the message.
    return NextResponse.json(
      { ok: false, error: "Checkout top-up isn't available right now." },
      { status: 409 },
    );
  }

  const origin = new URL(request.url).origin;
  const session = await adapter.createCheckout({
    reference,
    amount,
    currency,
    country,
    email,
    successUrl: `${origin}/add?topup=done`,
    cancelUrl: `${origin}/add?topup=cancelled`,
    // Echoed back on the webhook for cross-checking (no PII).
    metadata: { reference },
  });

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Couldn't start your top-up. Please try again." },
      { status: 502 },
    );
  }

  await createCollection({
    account,
    reference,
    provider: adapter.name,
    kind: "checkout",
    sessionId: session.sessionId,
    amount,
    currency: (currency ?? "NGN").toUpperCase(),
    address,
    chainKey,
    status: session.status,
  });

  // Only the URL + our reference go back — provider internals stay server-side.
  return NextResponse.json({ ok: true, url: session.url, reference });
}
