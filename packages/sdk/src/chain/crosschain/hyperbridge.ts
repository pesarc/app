// Hyperbridge adapter — the rail for coins CCTP can't move (local stablecoins
// like cNGN, plus USDT / PYUSD). Wraps the proven `hyperSend`: approve (for a
// wrapped/home token) + send as one gasless batched userOp, with the recipient
// baked into the on-chain `send` params. Delivery to the destination is handled
// by Hyperbridge's relayers after the source tx, so there is no client-side mint
// to poll — once the source leg lands, the funds are in transit.
//
// Capability is route-gated: today only testnet cNGN (Base Sepolia ↔ Arbitrum
// Sepolia) is deployed, so `supports` returns true only where a route actually
// exists. Arc is not a Hyperbridge chain.

import { hyperSend } from "../hyperbridge/send";
import { hasHyperRoute, hyperRouteFor, type HyperNetwork } from "../hyperbridge/registry";
import type { BridgeAdapter, CrossSendRequest } from "./types";

export const hyperbridgeAdapter: BridgeAdapter = {
  id: "hyperbridge",
  label: "Hyperbridge",
  kind: "programmatic",

  supports(req) {
    if (req.token.toUpperCase() === "USDC") return false; // CCTP owns USDC
    if (req.fromChainId === req.toChainId) return false;
    const net = req.network as HyperNetwork;
    if (!hasHyperRoute(net, req.token)) return false;
    return hyperRouteFor(net, req.token, req.fromChainId, req.toChainId) !== null;
  },

  async quote(req) {
    // Testnet host prices the per-byte protocol fee at 0; relayerFee is 0.
    return { amountOut: req.amount, feeLabel: "No fee", etaLabel: "~a few minutes" };
  },

  async execute(req, sender) {
    const tx = await hyperSend(
      {
        network: req.network as HyperNetwork,
        symbol: req.token,
        fromChainId: req.fromChainId,
        toChainId: req.toChainId,
        recipient: req.recipient,
        amount: req.amount,
      },
      sender
    );
    return { sourceTx: tx };
  },

  async settle() {
    // No client-side mint to poll — Hyperbridge relayers deliver after the source
    // tx. The source leg succeeding (execute resolved with a hash) means the funds
    // have left the wallet and are in transit.
    return { ok: true };
  },
};
