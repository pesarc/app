"use client";

// Algorand corridor via Wormhole Connect (hosted CDN build). LI.FI/CCTP don't
// cover Algorand, and hand-building Algorand (TEAL) token-bridge txns would be
// reckless untested money code — so we embed Wormhole's own audited widget,
// which handles the Algorand wallet + transfer + redeem end to end. The 3.9MB
// bundle loads from CDN only when this mounts (i.e. when the user opens Algorand
// mode), never in the app's own build.
import { useEffect, useRef } from "react";

const CDN =
  "https://cdn.jsdelivr.net/npm/@wormhole-foundation/wormhole-connect@5.1.1/dist";

// Limit to the corridors that matter for Pesarc: Algorand ↔ the chains we settle
// on. The widget offers USDC (and other Wormhole assets) across these.
const CONFIG = {
  network: "Mainnet",
  chains: ["Algorand", "Ethereum", "Solana", "Base", "Arbitrum"],
};
const THEME = { mode: "light", primary: "#0EA5E9" };

export default function WormholeAlgorand() {
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

  return (
    <div className="mt-4">
      <div
        id="wormhole-connect"
        data-config={JSON.stringify(CONFIG)}
        data-theme={JSON.stringify(THEME)}
      />
      <p className="mt-3 text-xs text-black/40">
        Algorand transfers are powered by Wormhole. Connect an Algorand wallet
        (Pera/Defly) in the widget. Test a small amount first.
      </p>
    </div>
  );
}
