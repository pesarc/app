"use client";

// Wormhole corridor page — the destination of the crosschain router's Wormhole
// handoff. It opens the audited Connect widget scoped to the requested route
// (?from=&to=&net=), so a move the app can't do natively (e.g. to Algorand / Sui)
// is completed in Wormhole's own widget. Chains come from the Wormhole registry,
// so adding a chain there makes it selectable here automatically.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WormholeConnect from "@/components/app/bridge/WormholeConnect";
import { wormholeConnectChains, type WormholeNetwork } from "@pesarc/sdk/chain/wormhole/registry";

function WormholePageInner() {
  const sp = useSearchParams();
  const network: WormholeNetwork = sp.get("net") === "testnet" ? "testnet" : "mainnet";
  // Pin the requested from/to first, then the rest of the registry.
  const pinned = [sp.get("from"), sp.get("to")].filter(Boolean) as string[];
  const chains = wormholeConnectChains(network, pinned);

  return (
    <div className="mx-auto max-w-md px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold text-harbor">Bridge with Wormhole</h1>
      <p className="mt-1 text-sm text-slate">
        For chains we don&apos;t move natively. Pick your route and wallet in the widget below.
      </p>
      <WormholeConnect network={network} chains={chains} />
    </div>
  );
}

export default function WormholeBridgePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-8 text-sm text-slate">Loading…</div>}>
      <WormholePageInner />
    </Suspense>
  );
}
