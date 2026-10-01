// Provider-agnostic cross-chain transfer layer.
//
// One interface over the rails Pesarc already runs — CCTP (Circle, USDC),
// Hyperbridge (local stablecoins / USDT / PYUSD), and Wormhole (Algorand, via
// the embedded Connect widget). Each adapter wraps an EXISTING, proven execution
// path; this module only unifies "which rail, and how to drive it" so the Send
// flow and the Bridge UI stop duplicating that decision.

export type CrossNetwork = "mainnet" | "testnet";

/** Minimal smart-wallet shape used to sign gasless batched userOps in-app. */
export type CrossSender = {
  ready: boolean;
  address?: string;
  sendCalls: (
    calls: { to: `0x${string}`; data: `0x${string}`; value?: bigint }[]
  ) => Promise<string | undefined>;
};

export type CrossSendRequest = {
  /** Token symbol, e.g. "USDC", "cNGN". */
  token: string;
  /** App registry chain keys (e.g. "arbitrum-sepolia") + their EVM chain ids. */
  fromChainKey: string;
  fromChainId: number;
  toChainKey: string;
  toChainId: number;
  /** Human amount in the token's own units. */
  amount: string;
  /** External destination wallet on the target chain. */
  recipient: `0x${string}`;
  network: CrossNetwork;
};

export type CrossQuote = {
  /** Human amount expected at the destination. */
  amountOut: string;
  feeLabel: string;
  etaLabel: string;
};

export type CrossExecuteResult = {
  /** Source-chain burn/lock/send tx hash. */
  sourceTx: `0x${string}`;
};

/** One settlement poll. `pending` = not settled yet, call again; `ok` = done. */
export type CrossSettleResult = {
  ok: boolean;
  pending?: boolean;
  destTx?: string;
  explorer?: string;
  error?: string;
};

export interface BridgeAdapter {
  id: "cctp" | "hyperbridge" | "wormhole";
  label: string;
  /**
   * "programmatic" adapters execute in-app from the Send flow. "handoff"
   * adapters (Wormhole) can't be driven from here — the caller sends the user
   * to the external widget instead of calling execute/settle.
   */
  kind: "programmatic" | "handoff";
  /** Can this rail move `token` from→to on `network`? (Capability check.) */
  supports(req: CrossSendRequest): boolean;
  quote(req: CrossSendRequest): Promise<CrossQuote>;
  /**
   * Submit the source-chain leg. The caller MUST have switched the smart wallet
   * to the source chain first. Throws on failure (never fakes success).
   */
  execute(req: CrossSendRequest, sender: CrossSender): Promise<CrossExecuteResult>;
  /** One poll of destination settlement. Not all rails can confirm delivery. */
  settle(req: CrossSendRequest, sourceTx: string): Promise<CrossSettleResult>;
  /** For handoff adapters: where to send the user to complete the transfer. */
  handoffHref?(req: CrossSendRequest): string;
}
