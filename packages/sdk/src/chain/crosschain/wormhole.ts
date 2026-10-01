// Wormhole adapter — the broad-coverage rail. Wormhole reaches ecosystems CCTP
// and Hyperbridge don't (Algorand, Sui, Aptos, Cosmos, …), so it's the catch-all
// the router falls to for routes the native rails can't serve. It is a HANDOFF:
// the transfer is completed in the audited Wormhole Connect widget (we never
// hand-roll Wormhole transfer/redeem/TEAL money code), so execute/settle throw
// and the caller sends the user to handoffHref instead. Which chains it covers is
// config — see chain/wormhole/registry.ts; add a row there to add a chain.

import { hasWormholeRoute, wormholeName, type WormholeNetwork } from "../wormhole/registry";
import type { BridgeAdapter, CrossSendRequest } from "./types";

/** Back-compat export (the Send flow's Algorand sentinel). */
export const ALGORAND_CHAIN_KEY = "algorand";

export const wormholeAdapter: BridgeAdapter = {
  id: "wormhole",
  label: "Wormhole",
  kind: "handoff",

  supports(req) {
    // Any two distinct Wormhole-supported chains. The router tries CCTP and
    // Hyperbridge first, so Wormhole only catches what they can't serve.
    return hasWormholeRoute(req.fromChainKey, req.toChainKey, req.network as WormholeNetwork);
  },

  async quote(req) {
    return { amountOut: req.amount, feeLabel: "Set in widget", etaLabel: "~a few minutes" };
  },

  async execute(): Promise<never> {
    throw new Error("Wormhole transfers are completed in the bridge widget, not in-app.");
  },

  async settle() {
    return { ok: false, error: "Settlement happens in the Wormhole widget." };
  },

  handoffHref(req) {
    const net = req.network as WormholeNetwork;
    const p = new URLSearchParams({ net });
    const from = wormholeName(req.fromChainKey, net);
    const to = wormholeName(req.toChainKey, net);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (req.token) p.set("token", req.token);
    if (req.amount) p.set("amount", req.amount);
    return `/bridge/wormhole?${p.toString()}`;
  },
};
