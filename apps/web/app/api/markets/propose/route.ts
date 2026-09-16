import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@pesarc/sdk/api/guard";
import { createCatalog } from "@pesarc/sdk/catalog";
import { evmCreateMarketOwner, marketsChainReady } from "@pesarc/sdk/market-create";

// Public "propose a market" endpoint. Anyone can propose a prediction market —
// binary (Yes/No) or multi-outcome — and seed it with an initial bond. The
// market is written to the shared catalog with status "proposed" so it shows on
// the board flagged "Community"; the private admin can then curate it.
//
// Community markets are store-backed (the on-chain program is binary-only), so
// funding here records the seed bond. A production deployment posts the bond
// on-chain when the market is promoted.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(8).max(160),
  type: z.enum(["binary", "multi"]),
  outcomes: z.array(z.string().trim().min(1).max(40)).min(2).max(8).optional(),
  kind: z.enum(["fx", "macro", "sports", "politics"]),
  collateral: z.enum(["cNGN", "cKES", "cGHS"]),
  flag: z.string().trim().max(8).optional(),
  closes: z.string().trim().max(24).optional(),
  resolves: z.string().trim().max(24).optional(),
  bond: z.number().nonnegative().max(1_000_000_000).optional(),
  bondCoin: z.string().trim().max(8).optional(),
  proposer: z.string().trim().max(64).optional(),
  chainKey: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, "market-propose", 10, 60_000);
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid proposal" }, { status: 400 });
  }
  const p = parsed.data;

  // A multi market needs at least two distinct outcomes.
  const labels = (p.outcomes ?? []).map((s) => s.trim()).filter(Boolean);
  if (p.type === "multi" && new Set(labels.map((l) => l.toLowerCase())).size < 2) {
    return NextResponse.json(
      { ok: false, error: "add at least two distinct outcomes" },
      { status: 400 },
    );
  }

  const bond = p.bond ?? 0;

  // Seed the parimutuel pools evenly with the bond so odds start balanced and
  // there's initial liquidity to trade against.
  const data: Record<string, unknown> = {
    question: p.question,
    kind: p.kind,
    collateral: p.collateral,
    flag: p.flag || (p.kind === "sports" ? "⚽" : p.kind === "politics" ? "🏛️" : "🌍"),
    closes: p.closes || "TBD",
    resolves: p.resolves || "TBD",
    resolver: "attested",
    type: p.type,
    status: "proposed",
    proposer: p.proposer || "community",
    bond,
    bondCoin: p.bondCoin || p.collateral,
  };

  if (p.type === "multi") {
    const each = labels.length ? bond / labels.length : 0;
    data.outcomes = labels.map((label) => ({ label, pool: each }));
  } else {
    data.poolYes = bond / 2;
    data.poolNo = bond / 2;
  }

  // Binary markets are created on-chain (owner-signed) when the markets chain is
  // configured; the pools then live on-chain. Multi-outcome stays store-backed
  // (the contract is binary-only). On-chain failure degrades to store-backed.
  let onChain: Awaited<ReturnType<typeof evmCreateMarketOwner>> | null = null;
  if (p.type === "binary" && marketsChainReady(p.collateral, p.chainKey)) {
    try {
      onChain = await evmCreateMarketOwner({
        question: p.question,
        collateral: p.collateral,
        chainKey: p.chainKey,
      });
      data.onChainId = onChain.id;
      data.venue = onChain.venue;
      data.chainKey = onChain.chainKey;
      data.txHash = onChain.tx;
      data.txUrl = onChain.txUrl;
      data.status = "live";
      // On-chain pools start empty (real stakes); don't seed display pools.
      data.poolYes = 0;
      data.poolNo = 0;
    } catch (e) {
      onChain = null;
      data.onChainError = e instanceof Error ? e.message.slice(0, 140) : "on-chain create failed";
    }
  }

  try {
    const item = await createCatalog("markets", data);
    return NextResponse.json({ ok: true, item, onChain });
  } catch {
    return NextResponse.json({ ok: false, error: "could not save proposal" }, { status: 500 });
  }
}
