"use client";

// Generic Wormhole Connect embed — the audited, hosted widget, scoped to a
// configurable set of chains. Wormhole reaches ecosystems CCTP/Hyperbridge don't
// (Algorand, Sui, Aptos, Cosmos…), and hand-building those token-bridge txns
// would be reckless untested money code, so we embed Wormhole's own widget (it
// handles wallet + transfer + redeem end to end). Pass the chains to offer; it
// defaults to the full Wormhole registry for the network. The 3.9MB bundle loads
// from CDN only when this mounts, never in the app's own build.

import { useEffect, useRef } from "react";
import {
  wormholeConnectChains,
  type WormholeNetwork,
} from "@pesarc/sdk/chain/wormhole/registry";

const CDN = "https://cdn.jsdelivr.net/npm/@wormhole-foundation/wormhole-connect@5.1.1/dist";
const THEME = { mode: "light", primary: "#0EA5E9" };

export default function WormholeConnect({
  network = "mainnet",
  chains,
}: {
  network?: WormholeNetwork;
  /** Wormhole chain-name allowlist; defaults to the registry for the network. */
  chains?: string[];
}) {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    injected.current = true;

    if (!document.getElementById("wh-connect-css")) {
      const link = document.createElement("link");
      link.id = "wh-connect-css";
      link.rel = "stylesheet";
      link.href = `${CDN}/main.css`;
      document.head.appendChild(link);
    }
    // main.mjs auto-mounts into #wormhole-connect, reading data-config/data-theme.
    // Injected after the div is in the DOM so the mount point is found.
    if (!document.getElementById("wh-connect-js")) {
      const script = document.createElement("script");
      script.id = "wh-connect-js";
      script.type = "module";
      script.src = `${CDN}/main.mjs`;
      document.body.appendChild(script);
    }
  }, []);

  const config = {
    network: network === "testnet" ? "Testnet" : "Mainnet",
    chains: chains && chains.length ? chains : wormholeConnectChains(network),
  };

  return (
    <div className="mt-4">
      <div
        id="wormhole-connect"
        data-config={JSON.stringify(config)}
        data-theme={JSON.stringify(THEME)}
      />
      <p className="mt-3 text-xs text-black/40">
        Cross-chain transfers here are powered by Wormhole. Connect the right wallet for
        your source chain in the widget. Test a small amount first.
      </p>
    </div>
  );
}
