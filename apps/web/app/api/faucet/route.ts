import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { faucetDrip, faucetReady } from "@pesarc/sdk/faucet";

// Testnet faucet: mints local-currency test stablecoins (+ a gas drip) to a
// wallet so users can try the app end-to-end. Arb Sepolia only.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "not an address"),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "faucet", 4, 60_000);
  if (limited) return limited;

  if (!faucetReady()) {
    return NextResponse.json({ ok: false, error: "faucet not configured" }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "valid wallet address required" }, { status: 400 });
  }

  try {
    const result = await faucetDrip(parsed.data.address as `0x${string}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "faucet failed" },
      { status: 500 },
    );
  }
}
