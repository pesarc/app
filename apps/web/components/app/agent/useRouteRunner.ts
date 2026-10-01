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
import { FINALITY, toBytes32, parseUsdc, quoteFast, maxFeeFor, fetchFee, relayMint } from "@pesarc/sdk/chain/cctp/bridge";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import type { RoutePlan } from "@pesarc/sdk/agent/run";

const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Friendly label -> registry chain key (what sets the active chain), per network.
const REG: Record<CctpNetwork, Record<string, string>> = {
  testnet: { Arc: "arc-testnet", Base: "base-sepolia", Arbitrum: "arbitrum-sepolia", Optimism: "optimism-sepolia", Polygon: "polygon-amoy", Ethereum: "sepolia", Avalanche: "avalanche-fuji" },
  mainnet: { Arc: "arc", Base: "base", Arbitrum: "arbitrum", Optimism: "optimism", Polygon: "polygon", Ethereum: "ethereum", Avalanche: "avalanche" },
};
// Friendly label -> CCTP network key (same across networks).
const CCTP: Record<string, string> = { Arc: "arc", Base: "base", Arbitrum: "arbitrum", Optimism: "optimism", Polygon: "polygon", Ethereum: "ethereum", Avalanche: "avalanche" };

export type LegPhase = "pending" | "switching" | "sending" | "settling" | "done" | "error";
export type Leg = {
  fromLabel: string;
  toLabel: string;
  fromKey: string; // registry key (active chain)
  fromCctp: string;
  toCctp: string;
  fromChainId: number;
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
  activeChainId: number;
  walletReady: boolean;
};

function resolveLegs(chains: string[], network: CctpNetwork): Leg[] | string {
  const book = cctpChains(network);
  const legs: Leg[] = [];
  for (let i = 0; i < chains.length - 1; i++) {
    const from = chains[i];
    const to = chains[i + 1];
    const fromKey = REG[network][from];
    const fromCctp = CCTP[from];
    const toCctp = CCTP[to];
    const src = fromCctp ? book[fromCctp] : undefined;
    const dst = toCctp ? book[toCctp] : undefined;
    if (!fromKey || !src || !dst) return `${from} to ${to} isn't available on ${network === "testnet" ? "testnet" : "mainnet"}.`;
    legs.push({ fromLabel: from, toLabel: to, fromKey, fromCctp, toCctp, fromChainId: src.chainId as number });
  }
  return legs;
}

export function useRouteRunner(): RouteRunner {
  const smart = useSmartWallet();
  const { chain: activeEvm, setChainKey } = useActiveEvmChain();
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

  /** User taps "Switch to <chain>" for the active leg — change the in-app network. */
  const switchTo = useCallback(
    (i: number) => {
      const leg = legs[i];
      if (leg) setChainKey(leg.fromKey);
    },
    [legs, setChainKey],
  );

  const sendLeg = useCallback(
    async (i: number) => {
      const leg = legs[i];
      const book = cctpChains(network);
      const src = book[leg.fromCctp];
      const dst = book[leg.toCctp];
      try {
        const amountIn = amountRef.current;
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
    [legs, network, smart, patch],
  );

  const settleLeg = useCallback(
    async (i: number) => {
      const leg = legs[i];
      const src = cctpChains(network)[leg.fromCctp];
      const burnTx = states[i]?.burnTx;
      if (!burnTx) return;
      const deadline = Date.now() + 25 * 60_000;
      try {
        while (Date.now() < deadline) {
          const r = await relayMint({ srcDomain: src.domain, burnTx, dstKey: leg.toCctp, network });
          if (r.ok) {
            patch(i, { mintTx: r.mintTx, phase: "done" });
            if (i + 1 < legs.length) {
              // Next leg may be on another chain — prompt the user to switch
              // (switchTo on their tap); don't auto-switch.
              patch(i + 1, { phase: "switching" });
              setIdx(i + 1);
            } else {
              setStatus("done");
            }
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
    const leg = legs[idx];
    const ph = states[idx]?.phase;
    const key = `${idx}:${ph}`;
    if (ph === "switching") {
      // Wait for the user to switch the network in-app (switchTo). No auto-switch.
      if (activeEvm.chain.id === leg.fromChainId && smart.ready && smart.address) {
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
  }, [status, idx, states, smart.ready, smart.address, activeEvm.chain.id, legs, patch, sendLeg, settleLeg]);

  // After the user switches the network, don't spin forever waiting for the wallet
  // to be ready on that chain: if it isn't ready within the window (e.g. that
  // chain's gasless rails aren't up), fail the leg with a clear message instead of
  // a hang. Only runs once the active chain IS the source (the user has switched);
  // while we're still waiting for their tap there's no timeout.
  const activePhase = idx >= 0 ? states[idx]?.phase : undefined;
  const preparing =
    activePhase === "switching" && idx >= 0 && activeEvm.chain.id === legs[idx]?.fromChainId && !smart.ready;
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
    /** The in-app active chain id + wallet readiness, so the card can prompt a switch. */
    activeChainId: activeEvm.chain.id,
    walletReady: smart.ready,
  };
}
