// Provider selection — the one place that decides which rail moves a given
// (token, fromChain, toChain). Priority: CCTP for USDC (EVM↔EVM, incl. Arc),
// Hyperbridge for everything else it has a route for, Wormhole as the Algorand
// handoff. First adapter whose `supports` is true wins. Returns null when no
// rail covers the route (the caller shows "not supported yet" rather than
// guessing a path).

import { cctpAdapter } from "./cctp";
import { hyperbridgeAdapter } from "./hyperbridge";
import { wormholeAdapter } from "./wormhole";
import type { BridgeAdapter, CrossSendRequest } from "./types";

/** Ordered by preference; selection takes the first that supports the request. */
export const ADAPTERS: BridgeAdapter[] = [cctpAdapter, hyperbridgeAdapter, wormholeAdapter];

export function selectAdapter(req: CrossSendRequest): BridgeAdapter | null {
  return ADAPTERS.find((a) => a.supports(req)) ?? null;
}

/** True when some rail can move this transfer cross-chain. */
export function canBridge(req: CrossSendRequest): boolean {
  return selectAdapter(req) !== null;
}
