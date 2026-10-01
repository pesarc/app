"use client";

// Runs a multi-hop CCTP route leg by leg, in the browser, with the in-app smart
// wallet signing each leg gaslessly. For every leg it: switches the active chain
// to the source, approves + burns USDC (one batched userOp), waits for the
// destination mint to settle, records both tx hashes, then advances. Works on any
// CCTP chain the app supports (Arc included) — no session key needed, because the
// wallet is right here. A state machine driven by one effect so chain switches
// (which are async) are awaited by reacting to state, never by blocking.

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFunctionData } from "viem";
import { tokenMessengerV2Abi, erc20ApproveAbi } from "@pesarc/sdk/chain/cctp/abi";
import { cctpChains, tokenMessengerV2, type CctpNetwork } from "@pesarc/sdk/chain/cctp/network";
import { FINALITY, toBytes32, parseUsdc, quoteFast, maxFeeFor, fetchFee, relayMint, solanaRpc } from "@pesarc/sdk/chain/cctp/bridge";
import { burnOnSolana, evmRecipient32 } from "@pesarc/sdk/svm/cctp";
import { getLifiQuote, getLifiStatus, LIFI_SOLANA_CHAIN } from "@pesarc/sdk/chain/aggregator/lifi";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { useActiveNetwork, SOLANA_NETWORK_KEY } from "@pesarc/sdk/chain/activeNetwork";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import type { RoutePlan } from "@pesarc/sdk/agent/run";

const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Friendly label -> registry chain key (what sets the active chain), per network.
const REG: Record<CctpNetwork, Record<string, string>> = {
  testnet: { Arc: "arc-testnet", Base: "base-sepolia", Arbitrum: "arbitrum-sepolia", Optimism: "optimism-sepolia", Polygon: "polygon-amoy", Ethereum: "sepolia", Avalanche: "avalanche-fuji" },
  mainnet: { Arc: "arc", Base: "base", Arbitrum: "arbitrum", Optimism: "optimism", Polygon: "polygon", Ethereum: "ethereum", Avalanche: "avalanche" },
};
// Friendly label -> CCTP network key (same across networks). Solana is mainnet-only.
const CCTP: Record<string, string> = { Arc: "arc", Base: "base", Arbitrum: "arbitrum", Optimism: "optimism", Polygon: "polygon", Ethereum: "ethereum", Avalanche: "avalanche", Solana: "solana" };

export type LegPhase = "pending" | "switching" | "sending" | "settling" | "done" | "error";
export type Leg = {
  fromLabel: string;
  toLabel: string;
  /** "svm" = Solana; "evm" = an EVM chain. */
  fromKind: "evm" | "svm";
  toKind: "evm" | "svm";
  /** "cctp" = Circle burn+relay (EVM↔EVM, Solana→EVM); "lifi" = aggregator
   *  (EVM→Solana, which has no native Solana mint). */
  rail: "cctp" | "lifi";
  fromKey: string; // registry key (EVM) or the Solana network key
  fromCctp: string;
  toCctp: string;
  fromChainId?: number; // EVM only; Solana has none
};
export type LegState = { phase: LegPhase; burnTx?: string; mintTx?: string; note?: string };
export type RouteStatus = "idle" | "running" | "done" | "error";

export type RouteRunner = {
  status: RouteStatus;
  legs: Leg[];
  states: LegState[];
  activeIdx: number;
  network: CctpNetwork;
  start: (plan: RoutePlan, network: CctpNetwork) => string | null;
  explorerTx: (cctpKey: string, tx: string) => string;
  switchTo: (i: number) => void;
  needsSwitch: (i: number) => boolean;
  sourceReady: (i: number) => boolean;
};

function resolveLegs(chains: string[], network: CctpNetwork): Leg[] | string {
  // Any Solana hop is mainnet-only (no Solana CCTP on testnet).
  if (chains.includes("Solana") && network !== "mainnet") {
    return "Solana transfers run on mainnet. Switch to Live to route through Solana.";
  }
  const book = cctpChains(network);
  const legs: Leg[] = [];
  for (let i = 0; i < chains.length - 1; i++) {
    const from = chains[i];
    const to = chains[i + 1];
    const fromKind: "evm" | "svm" = from === "Solana" ? "svm" : "evm";
    const toKind: "evm" | "svm" = to === "Solana" ? "svm" : "evm";
    if (fromKind === "svm" && toKind === "svm") {
      return "Pick a different source and destination.";
    }
    // Solana -> EVM = Circle CCTP; EVM -> Solana = aggregator (no native Solana
    // mint); EVM -> EVM = Circle CCTP.
    const rail: "cctp" | "lifi" = toKind === "svm" ? "lifi" : "cctp";
    const fromCctp = CCTP[from];
    const toCctp = CCTP[to];
    const fromKey = fromKind === "svm" ? SOLANA_NETWORK_KEY : REG[network][from];
    const src = fromCctp ? book[fromCctp] : undefined;
    const dst = toCctp ? book[toCctp] : undefined;
    if (!fromKey || !src || !dst) return `${from} to ${to} isn't available on ${network === "testnet" ? "testnet" : "mainnet"}.`;
    legs.push({
      fromLabel: from,
      toLabel: to,
      fromKind,
      toKind,
      rail,
      fromKey,
      fromCctp,
      toCctp,
      fromChainId: fromKind === "evm" ? (src.chainId as number) : undefined,
    });
  }
  return legs;
}

export function useRouteRunner(): RouteRunner {
  const smart = useSmartWallet();
  const { chain: activeEvm, setChainKey } = useActiveEvmChain();
  const activeNet = useActiveNetwork(); // isSvm + setNetwork(key) — for Solana legs
  const solana = useSolanaSigner();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [states, setStates] = useState<LegState[]>([]);
  const [idx, setIdx] = useState(-1);
  const [status, setStatus] = useState<RouteStatus>("idle");
  const [network, setNetwork] = useState<CctpNetwork>("testnet");
  const amountRef = useRef<bigint>(0n);
  const guard = useRef<string>(""); // "<idx>:<phase>" we've already acted on

  const patch = useCallback((i: number, p: Partial<LegState>) => {
    setStates((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));
  }, []);

  // Per-leg: is the active network NOT this leg's source (needs a switch)? And is
  // the source network active AND its wallet ready (can sign)? Solana legs key off
  // isSvm + the Solana signer; EVM legs off the active chain id + the smart wallet.
  const needsSwitch = useCallback(
    (i: number): boolean => {
      const leg = legs[i];
      if (!leg) return false;
      return leg.fromKind === "svm" ? !activeNet.isSvm : activeEvm.chain.id !== leg.fromChainId;
    },
    [legs, activeNet.isSvm, activeEvm.chain.id],
  );
  const sourceReady = useCallback(
    (i: number): boolean => {
      const leg = legs[i];
      if (!leg) return false;
      return leg.fromKind === "svm"
        ? activeNet.isSvm && !!solana?.address
        : activeEvm.chain.id === leg.fromChainId && smart.ready && !!smart.address;
    },
    [legs, activeNet.isSvm, solana?.address, activeEvm.chain.id, smart.ready, smart.address],
  );

  const start = useCallback(
    (plan: RoutePlan, net: CctpNetwork): string | null => {
      if (!smart.address) return "Sign in with your wallet first.";
      if (!plan.amount || plan.amount <= 0) return "Tell me how much USDC to route.";
      const resolved = resolveLegs(plan.chains, net);
      if (typeof resolved === "string") return resolved;
      amountRef.current = parseUsdc(String(plan.amount));
      guard.current = "";
      setNetwork(net);
      setLegs(resolved);
      setStates(resolved.map((_, i) => ({ phase: i === 0 ? "switching" : "pending" })));
      setIdx(0);
      setStatus("running");
      // Don't auto-switch the wallet's network — prompt the user to switch in-app
      // (switchTo), then the leg signs once the wallet is ready on that chain.
      return null;
    },
    [smart.address],
  );

  /** User taps "Switch to <chain>" for the active leg — change the in-app network.
   *  Solana legs switch the whole network to Solana; EVM legs switch the chain. */
  const switchTo = useCallback(
    (i: number) => {
      const leg = legs[i];
      if (!leg) return;
      if (leg.fromKind === "svm") activeNet.setNetwork(SOLANA_NETWORK_KEY);
      else setChainKey(leg.fromKey);
    },
    [legs, setChainKey, activeNet],
  );

  const sendLeg = useCallback(
    async (i: number) => {
      const leg = legs[i];
      const book = cctpChains(network);
      const src = book[leg.fromCctp];
      const dst = book[leg.toCctp];
      try {
        const amountIn = amountRef.current;

        // Solana source: burn USDC on Solana with the Solana wallet; the mint
        // recipient is the user's own EVM smart account on the destination chain.
        // Not gasless — the Solana wallet pays the (tiny) SOL fee.
        if (leg.fromKind === "svm") {
          if (!solana?.address) throw new Error("Connect your Solana wallet to sign this hop.");
          if (!smart.address) throw new Error("Sign in with your EVM wallet to receive on the destination.");
          const sig = await burnOnSolana(solana, solanaRpc(), {
            amount: amountIn,
            destinationDomain: dst.domain,
            mintRecipient: evmRecipient32(smart.address),
            maxFee: 0n,
            minFinalityThreshold: FINALITY.standard,
          });
          if (!sig) throw new Error("The Solana burn didn't go through.");
          patch(i, { burnTx: sig, phase: "settling" });
          return;
        }

        // EVM -> Solana: no native Solana mint, so route via the aggregator. The
        // smart wallet signs the approve + the route tx (gasless); the recipient
        // is the user's Solana wallet. Settlement polls the aggregator's status.
        if (leg.rail === "lifi") {
          if (!smart.address) throw new Error("Sign in with your wallet to move funds.");
          if (!solana?.address) throw new Error("Connect your Solana wallet to receive on Solana.");
          const quote = await getLifiQuote({
            fromChain: src.chainId as number,
            toChain: LIFI_SOLANA_CHAIN,
            fromToken: src.usdc as string,
            toToken: SOLANA_USDC_MINT,
            fromAmount: amountIn.toString(),
            fromAddress: smart.address,
            toAddress: solana.address,
          });
          const spender = quote.transactionRequest.to;
          const value = quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n;
          const tx = await smart.sendCalls([
            { to: src.usdc as `0x${string}`, data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [spender, amountIn] }) },
            { to: quote.transactionRequest.to, data: quote.transactionRequest.data, value },
          ]);
          if (!tx) throw new Error("The transfer didn't go through.");
          patch(i, { burnTx: tx, phase: "settling" });
          return;
        }

        const fee = await fetchFee(src.domain, dst.domain, network).catch(() => ({ fastBps: null as number | null }));
        const useFast = fee.fastBps != null;
        const maxFee = useFast ? maxFeeFor(amountIn, fee.fastBps as number) : 0n;
        const finality = useFast ? FINALITY.fast : FINALITY.standard;
        const to = smart.address as `0x${string}`;
        const burnTx = await smart.sendCalls([
          { to: src.usdc as `0x${string}`, data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [tokenMessengerV2(network), amountIn] }) },
          { to: tokenMessengerV2(network), data: encodeFunctionData({ abi: tokenMessengerV2Abi, functionName: "depositForBurn", args: [amountIn, dst.domain, toBytes32(to), src.usdc as `0x${string}`, ZERO32, maxFee, finality] }) },
        ]);
        if (!burnTx) throw new Error("The transfer didn't go through.");
        // Feed the received amount into the next hop (fast deducts a small fee).
        amountRef.current = useFast ? quoteFast(amountIn, fee.fastBps as number).amountOut : amountIn;
        patch(i, { burnTx, phase: "settling" });
      } catch (e: unknown) {
        const msg = (e as { shortMessage?: string; message?: string })?.shortMessage || (e as Error)?.message || "That leg didn't go through.";
        patch(i, { phase: "error", note: msg });
        setStatus("error");
      }
    },
    [legs, network, smart, solana, patch],
  );

  const settleLeg = useCallback(
    async (i: number) => {
      const leg = legs[i];
      const burnTx = states[i]?.burnTx;
      if (!burnTx) return;
      // Advance to the next hop (prompting a switch) or finish.
      const advance = () => {
        if (i + 1 < legs.length) {
          patch(i + 1, { phase: "switching" });
          setIdx(i + 1);
        } else {
          setStatus("done");
        }
      };
      const deadline = Date.now() + 25 * 60_000;
      try {
        if (leg.rail === "lifi") {
          // EVM -> Solana: poll the aggregator until the Solana side lands.
          while (Date.now() < deadline) {
            const s = await getLifiStatus(burnTx, leg.fromChainId, LIFI_SOLANA_CHAIN);
            if (s.status === "DONE") {
              patch(i, { mintTx: s.receivingTx, phase: "done" });
              advance();
              return;
            }
            if (s.status === "FAILED") throw new Error(`That route didn't go through: ${s.substatus || "unknown"}`);
            await sleep(15_000);
          }
          throw new Error("This is taking longer than usual. Your money left safely and will arrive shortly.");
        }
        const src = cctpChains(network)[leg.fromCctp];
        while (Date.now() < deadline) {
          const r = await relayMint({ srcDomain: src.domain, burnTx, dstKey: leg.toCctp, network });
          if (r.ok) {
            patch(i, { mintTx: r.mintTx, phase: "done" });
            advance();
            return;
          }
          if (!r.pending) throw new Error(r.error);
          await sleep(15_000);
        }
        throw new Error("This leg is taking longer than usual. Your USDC is safe and will arrive shortly.");
      } catch (e: unknown) {
        patch(i, { phase: "error", note: (e as Error)?.message || "Settlement failed." });
        setStatus("error");
      }
    },
    [legs, network, states, patch],
  );

  // The driver: react to chain/wallet readiness and phase, acting once per step.
  useEffect(() => {
    if (status !== "running" || idx < 0 || idx >= legs.length) return;
    const ph = states[idx]?.phase;
    const key = `${idx}:${ph}`;
    if (ph === "switching") {
      // Wait for the user to switch the network in-app (switchTo). No auto-switch.
      if (sourceReady(idx)) {
        if (guard.current === key) return;
        guard.current = key;
        patch(idx, { phase: "sending" });
      }
      return;
    }
    if (guard.current === key) return;
    guard.current = key;
    if (ph === "sending") void sendLeg(idx);
    else if (ph === "settling") void settleLeg(idx);
  }, [status, idx, states, legs, patch, sendLeg, settleLeg, sourceReady]);

  // After the user switches the network, don't spin forever waiting for the wallet
  // to be ready on that chain: if it isn't ready within the window (e.g. that
  // chain's gasless rails aren't up), fail the leg with a clear message instead of
  // a hang. Only runs once the active chain IS the source (the user has switched);
  // while we're still waiting for their tap there's no timeout.
  const activePhase = idx >= 0 ? states[idx]?.phase : undefined;
  // "Preparing" = the source network is active (user has switched) but the wallet
  // there isn't ready yet. Not while still awaiting their tap (needsSwitch).
  const preparing = activePhase === "switching" && idx >= 0 && !needsSwitch(idx) && !sourceReady(idx);
  useEffect(() => {
    if (status !== "running" || !preparing) return;
    const t = setTimeout(() => {
      setStates((prev) =>
        prev[idx]?.phase === "switching"
          ? prev.map((s, j) =>
              j === idx
                ? {
                    ...s,
                    phase: "error",
                    note: `Your wallet isn't ready on ${legs[idx]?.fromLabel ?? "that network"} yet. Give it a moment, then try again.`,
                  }
                : s,
            )
          : prev,
      );
      setStatus("error");
    }, 30_000);
    return () => clearTimeout(t);
  }, [status, preparing, idx, legs]);

  const explorerTx = useCallback(
    (cctpKey: string, tx: string) => {
      const c = cctpChains(network)[cctpKey];
      return c ? c.explorerTx(tx) : "#";
    },
    [network],
  );

  return {
    status,
    legs,
    states,
    activeIdx: idx,
    network,
    start,
    explorerTx,
    switchTo,
    /** Per-leg: does the active network need switching, and is its wallet ready? */
    needsSwitch,
    sourceReady,
  };
}
