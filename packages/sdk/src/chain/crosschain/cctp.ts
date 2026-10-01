// CCTP adapter — Circle CCTP V2, the primary USDC rail (EVM↔EVM, incl. Arc).
// Non-custodial and gasless: approve + depositForBurn as one batched userOp on
// the source, then the server relayer mints on the destination. mintRecipient is
// baked into the attested message, so the relayer cannot redirect the funds.
//
// This is the exact flow proven in useRouteRunner / CrossChainBridge — lifted
// here once so both the Send flow and the Bridge UI can share it.

import { encodeFunctionData } from "viem";
import { tokenMessengerV2Abi, erc20ApproveAbi } from "../cctp/abi";
import { cctpChainByKey, tokenMessengerV2, type CctpNetwork } from "../cctp/network";
import {
  FINALITY,
  toBytes32,
  parseUsdc,
  formatUsdc,
  quoteFast,
  quoteStandard,
  maxFeeFor,
  fetchFee,
  relayMint,
} from "../cctp/bridge";
import { registryChainKey } from "../stablecoin-registry";
import type { BridgeAdapter, CrossSendRequest } from "./types";

const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;

/** Resolve an app registry chain key (e.g. "arbitrum-sepolia") to its CCTP entry. */
function cctpFor(appChainKey: string, network: CctpNetwork) {
  return cctpChainByKey(registryChainKey(appChainKey), network as CctpNetwork);
}

export const cctpAdapter: BridgeAdapter = {
  id: "cctp",
  label: "Circle CCTP",
  kind: "programmatic",

  supports(req) {
    if (req.token.toUpperCase() !== "USDC") return false;
    if (req.fromChainId === req.toChainId) return false; // same chain = direct transfer
    const src = cctpFor(req.fromChainKey, req.network);
    const dst = cctpFor(req.toChainKey, req.network);
    return Boolean(src && dst && src.kind === "evm" && dst.kind === "evm");
  },

  async quote(req) {
    const src = cctpFor(req.fromChainKey, req.network)!;
    const dst = cctpFor(req.toChainKey, req.network)!;
    const amountIn = parseUsdc(req.amount);
    const fee = await fetchFee(src.domain, dst.domain, req.network).catch(() => ({
      fastBps: null as number | null,
    }));
    const q =
      fee.fastBps != null ? quoteFast(amountIn, fee.fastBps) : quoteStandard(amountIn);
    return { amountOut: formatUsdc(q.amountOut), feeLabel: q.feeUsdc > 0n ? `${formatUsdc(q.feeUsdc)} USDC` : "No fee", etaLabel: q.etaLabel };
  },

  async execute(req, sender) {
    const src = cctpFor(req.fromChainKey, req.network);
    const dst = cctpFor(req.toChainKey, req.network);
    if (!src || !dst) throw new Error("This CCTP route isn't available.");
    const amountIn = parseUsdc(req.amount);
    const fee = await fetchFee(src.domain, dst.domain, req.network).catch(() => ({
      fastBps: null as number | null,
    }));
    const useFast = fee.fastBps != null;
    const maxFee = useFast ? maxFeeFor(amountIn, fee.fastBps as number) : 0n;
    const finality = useFast ? FINALITY.fast : FINALITY.standard;

    const tx = await sender.sendCalls([
      {
        to: src.usdc as `0x${string}`,
        data: encodeFunctionData({
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [tokenMessengerV2(req.network), amountIn],
        }),
      },
      {
        to: tokenMessengerV2(req.network),
        data: encodeFunctionData({
          abi: tokenMessengerV2Abi,
          functionName: "depositForBurn",
          args: [
            amountIn,
            dst.domain,
            toBytes32(req.recipient),
            src.usdc as `0x${string}`,
            ZERO32,
            maxFee,
            finality,
          ],
        }),
      },
    ]);
    if (!tx) throw new Error("The transfer didn't go through.");
    return { sourceTx: tx as `0x${string}` };
  },

  async settle(req, sourceTx) {
    const src = cctpFor(req.fromChainKey, req.network);
    const dst = cctpFor(req.toChainKey, req.network);
    if (!src || !dst) return { ok: false, error: "Route unavailable." };
    const r = await relayMint({
      srcDomain: src.domain,
      burnTx: sourceTx,
      dstKey: dst.key,
      network: req.network,
    });
    if (r.ok) return { ok: true, destTx: r.mintTx, explorer: r.explorer };
    return { ok: false, pending: r.pending, error: r.pending ? undefined : r.error };
  },
};
