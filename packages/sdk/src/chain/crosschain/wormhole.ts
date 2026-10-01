// Wormhole adapter — the Algorand corridor, served by the audited Wormhole
// Connect widget embedded on the Bridge page. There is deliberately NO
// programmatic money path here: hand-rolling Algorand TEAL transfer+redeem would
// be untested money code, so this adapter is a HANDOFF — it recognises an
// Algorand-bound USDC transfer and points the user at the widget that does it
// end to end. Mainnet only (the widget is mainnet).

import type { BridgeAdapter, CrossSendRequest } from "./types";

/** Sentinel chain key the Send flow sets when the recipient is an Algorand address. */
export const ALGORAND_CHAIN_KEY = "algorand";

export const wormholeAdapter: BridgeAdapter = {
  id: "wormhole",
  label: "Wormhole",
  kind: "handoff",

  supports(req) {
    return (
      req.network === "mainnet" &&
      req.token.toUpperCase() === "USDC" &&
      (req.toChainKey === ALGORAND_CHAIN_KEY || req.fromChainKey === ALGORAND_CHAIN_KEY)
    );
  },

  async quote(req) {
    return { amountOut: req.amount, feeLabel: "Set in widget", etaLabel: "~a few minutes" };
  },

  async execute(): Promise<never> {
    throw new Error("Wormhole (Algorand) is completed in the bridge widget, not in-app.");
  },

  async settle() {
    return { ok: false, error: "Settlement happens in the Wormhole widget." };
  },

  handoffHref(req) {
    const amt = req.amount ? `&amount=${encodeURIComponent(req.amount)}` : "";
    return `/bridge?coin=USDC&net=mainnet${amt}`;
  },
};
