"use client";

// Cross-chain USDC over Circle CCTP V2 — the "move an asset between the chains you
// support" surface, on BOTH networks. Non-custodial: the user's wallet approves +
// burns USDC on the source; the server relayer mints native USDC on the
// destination (gasless for the user — see /api/bridge/relay). Testnet runs the
// exact same flow against Circle's sandbox attestation, so "Arc Sepolia -> Polygon
// Amoy" can be dry-run with faucet USDC. Solana (LI.FI) and Algorand (Wormhole)
// rails are mainnet-only; on testnet the picker is EVM CCTP corridors only.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createWalletClient, createPublicClient, custom, http, encodeFunctionData } from "viem";
import { Segmented } from "@/components/app/ui";
import { Dropdown } from "@/components/app/Dropdown";
import { STABLECOINS } from "@pesarc/sdk/stablecoins";
import { HYPER_ELIGIBLE_SYMBOLS } from "@pesarc/sdk/chain/hyperbridge/registry";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import WormholeAlgorand from "@/components/app/bridge/WormholeAlgorand";
import HyperPanel from "@/components/app/bridge/HyperPanel";
import CctpTransferCard from "@/components/app/bridge/CctpTransferCard";
import { HYPER_CHAIN_KEY, useTokenBalanceOn } from "@/components/app/bridge/shared";
import { tokenMessengerV2Abi, erc20ApproveAbi } from "@pesarc/sdk/chain/cctp/abi";
import {
  cctpChains,
  tokenMessengerV2,
  type CctpNetwork,
} from "@pesarc/sdk/chain/cctp/network";
import {
  FINALITY,
  toBytes32,
  parseUsdc,
  quoteStandard,
  quoteFast,
  maxFeeFor,
  fetchFee,
  viemChainFor,
  evmBridgeChains,
  relayMint,
  solanaRpc,
} from "@pesarc/sdk/chain/cctp/bridge";
import { useSolanaSigner } from "@pesarc/sdk/wallet/solana";
import { burnOnSolana, evmRecipient32 } from "@pesarc/sdk/svm/cctp";
import {
  getLifiQuote,
  getLifiStatus,
  LIFI_SOLANA_CHAIN,
  type LifiQuote,
} from "@pesarc/sdk/chain/aggregator/lifi";

// USDC rides the Circle rail; the other coins ride Hyperbridge (when their route
// is live). One selector, the rail is picked for the user.
const COIN_OPTS = [
  { value: "USDC", label: "🇺🇸 USDC" },
  ...HYPER_ELIGIBLE_SYMBOLS.map((s) => {
    const meta = STABLECOINS.find((c) => c.symbol === s);
    return { value: s, label: meta ? `${meta.flag} ${s}` : s };
  }),
];

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const isSolAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

type Phase = "idle" | "switching" | "approving" | "burning" | "attesting" | "done" | "error";
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;

function eth(): any {
  return typeof window !== "undefined" ? (window as any).ethereum : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function CrossChainBridge() {
  // Testnet first: it's the safe default (mainnet moves real USDC) and matches how
  // the app is tested. Everything below re-derives from this one value.
  const [network, setNetwork] = useState<CctpNetwork>("testnet");
  const [coin, setCoin] = useState("USDC");
  const isTestnet = network === "testnet";

  const evmChains = useMemo(() => evmBridgeChains(network), [network]);
  const solanaChain = cctpChains("mainnet").solana;
  // Solana is a mainnet-only rail (LI.FI); testnet stays EVM CCTP.
  const srcChains = useMemo(
    () => (isTestnet ? evmChains : [...evmChains, solanaChain]),
    [evmChains, isTestnet, solanaChain],
  );
  const dstChains = srcChains;

  const solanaSigner = useSolanaSigner();
  const smart = useSmartWallet();
  const { chain: activeEvm, setChainKey } = useActiveEvmChain();
  const [srcKey, setSrcKey] = useState("base");
  const [dstKey, setDstKey] = useState("arc");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");
  const [burnTx, setBurnTx] = useState<string>("");
  const [mintTx, setMintTx] = useState<string>("");
  const [speed, setSpeed] = useState<"fast" | "standard">("fast");
  const [fastBps, setFastBps] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [lifiQ, setLifiQ] = useState<LifiQuote | null>(null);
  const [lifiLoading, setLifiLoading] = useState(false);
  const [mode, setMode] = useState<"usdc" | "algorand">("usdc");

  const chains = cctpChains(network);
  const src = chains[srcKey] ?? evmChains[0];
  const dst = chains[dstKey] ?? evmChains[1] ?? evmChains[0];

  // Picking a source chain makes it the active network, so the embedded smart
  // wallet signs the burn there in-app (no MetaMask).
  const pickSrc = (v: string) => {
    setSrcKey(v);
    const c = chains[v];
    const key = c?.chainId ? HYPER_CHAIN_KEY[c.chainId] : undefined;
    if (key) setChainKey(key);
  };
  // The agent (and any deep link) can pre-fill the move via query params so the
  // user lands one tap from signing: ?coin=&from=&to=&amount=&net=. Applied once,
  // only for values that are valid on the chosen network, so a stale link can't
  // wedge the form.
  const params = useSearchParams();
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const net = params.get("net");
    const chainsFor = net === "mainnet" || net === "testnet" ? cctpChains(net) : null;
    if (net === "mainnet" || net === "testnet") setNetwork(net);
    const coinP = params.get("coin");
    if (coinP && COIN_OPTS.some((o) => o.value === coinP)) setCoin(coinP);
    const look = chainsFor ?? chains;
    const fromP = params.get("from");
    if (fromP && look[fromP]) pickSrc(fromP);
    const toP = params.get("to");
    if (toP && look[toP]) setDstKey(toP);
    const amtP = params.get("amount");
    if (amtP && /^\d+(\.\d+)?$/.test(amtP)) setAmount(amtP);
    // Run once on mount; pickSrc/chains are stable enough for a one-shot prefill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const amountIn = amount ? parseUsdc(amount) : 0n;
  // Real balance of the selected coin on the FROM chain (USDC on the CCTP rail).
  const srcEvm = src.kind === "evm" ? viemChainFor(src as never) : undefined;
  const srcBal = useTokenBalanceOn(
    coin === "USDC" ? (src.usdc as `0x${string}`) : undefined,
    srcEvm,
    srcEvm?.rpcUrls?.default?.http?.[0],
    smart.address,
  );
  // EVM->Solana can't use native CCTP here (no on-Solana mint) — route via LI.FI.
  const viaLifi = !isTestnet && src.kind === "evm" && dst.kind === "solana";

  // A key selected on one network may not exist on the other (Solana, Algorand
  // mode) — snap back to safe EVM defaults when the network flips.
  useEffect(() => {
    if (!chains[srcKey]) setSrcKey("base");
    if (!chains[dstKey]) setDstKey("arc");
    if (isTestnet && mode !== "usdc") setMode("usdc");
  }, [network, chains, srcKey, dstKey, isTestnet, mode]);

  // Native CCTP corridors: refetch Circle's Fast fee when the pair/network changes.
  useEffect(() => {
    if (srcKey === dstKey || viaLifi) return;
    let live = true;
    setFeeLoading(true);
    setFastBps(null);
    fetchFee(src.domain, dst.domain, network).then((f) => {
      if (live) {
        setFastBps(f.fastBps);
        setFeeLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [srcKey, dstKey, src.domain, dst.domain, viaLifi, network]);

  // LI.FI route estimate for EVM->Solana (debounced on amount/recipient).
  useEffect(() => {
    if (!viaLifi || amountIn <= 0n || !isSolAddr(recipient.trim())) {
      setLifiQ(null);
      return;
    }
    let live = true;
    setLifiLoading(true);
    const t = setTimeout(() => {
      getLifiQuote({
        fromChain: src.chainId as number,
        toChain: LIFI_SOLANA_CHAIN,
        fromToken: src.usdc,
        toToken: SOLANA_USDC_MINT,
        fromAmount: amountIn.toString(),
        fromAddress: "0x000000000000000000000000000000000000dEaD", // estimate only
        toAddress: recipient.trim(),
      })
        .then((qr) => live && setLifiQ(qr))
        .catch(() => live && setLifiQ(null))
        .finally(() => live && setLifiLoading(false));
    }, 500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [viaLifi, amountIn, recipient, src.chainId, src.usdc]);

  const fast = speed === "fast" && fastBps != null;
  const q =
    amountIn > 0n && !viaLifi
      ? fast
        ? quoteFast(amountIn, fastBps)
        : quoteStandard(amountIn)
      : null;
  const busy = phase !== "idle" && phase !== "done" && phase !== "error";

  async function run() {
    setMintTx("");
    setBurnTx("");
    try {
      if (srcKey === dstKey) throw new Error("Pick two different chains.");
      if (amountIn <= 0n) throw new Error("Enter an amount.");

      // EVM -> Solana via LI.FI (their bridge handles the Solana leg). Mainnet only.
      if (viaLifi) {
        const to = recipient.trim();
        if (!isSolAddr(to)) throw new Error("Enter the destination Solana address.");
        // In-app (AA) when the smart wallet is ready on the source chain.
        const lifiAA = smart.ready && Boolean(smart.address) && activeEvm.chain.id === src.chainId;
        let from: `0x${string}`;
        let provider: any;
        if (lifiAA) {
          from = smart.address as `0x${string}`;
        } else {
          provider = eth();
          if (!provider) throw new Error("Connect an EVM wallet with USDC (e.g. MetaMask).");
          [from] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
        }

        setPhase("switching");
        setNote("Finding the best route…");
        const quote = await getLifiQuote({
          fromChain: src.chainId as number,
          toChain: LIFI_SOLANA_CHAIN,
          fromToken: src.usdc,
          toToken: SOLANA_USDC_MINT,
          fromAmount: amountIn.toString(),
          fromAddress: from,
          toAddress: to,
        });
        const spender = quote.transactionRequest.to;
        const lifiValue = quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n;

        let hash: `0x${string}`;
        if (lifiAA) {
          setPhase("burning");
          setNote(`Signing in-app and moving ${amount} USDC to Solana…`);
          const tx = await smart.sendCalls([
            {
              to: src.usdc as `0x${string}`,
              data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: "approve", args: [spender, amountIn] }),
            },
            { to: quote.transactionRequest.to, data: quote.transactionRequest.data, value: lifiValue },
          ]);
          if (!tx) throw new Error("The transfer didn't go through. Please try again.");
          hash = tx as `0x${string}`;
        } else {
          const chain = viemChainFor(src);
          const wallet = createWalletClient({ account: from, chain, transport: custom(provider) });
          const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
          try {
            await wallet.switchChain({ id: src.chainId as number });
          } catch (e: any) {
            if (e?.code === 4902) await wallet.addChain({ chain });
            await wallet.switchChain({ id: src.chainId as number });
          }
          const allowance = (await pub.readContract({
            address: src.usdc as `0x${string}`,
            abi: erc20ApproveAbi,
            functionName: "allowance",
            args: [from, spender],
          })) as bigint;
          if (allowance < amountIn) {
            setPhase("approving");
            setNote("Approve the transfer in your wallet…");
            const aTx = await wallet.writeContract({
              address: src.usdc as `0x${string}`,
              abi: erc20ApproveAbi,
              functionName: "approve",
              args: [spender, amountIn],
            });
            await pub.waitForTransactionReceipt({ hash: aTx, timeout: 60_000 });
          }
          setPhase("burning");
          setNote(`Moving ${amount} USDC to Solana…`);
          hash = await wallet.sendTransaction({
            to: quote.transactionRequest.to,
            data: quote.transactionRequest.data,
            value: lifiValue,
          });
          await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
        }
        setBurnTx(hash);

        setPhase("attesting");
        setNote("Moving your money to Solana…");
        const dl = Date.now() + 25 * 60_000;
        while (Date.now() < dl) {
          const s = await getLifiStatus(hash, src.chainId as number, LIFI_SOLANA_CHAIN);
          if (s.status === "DONE") {
            if (s.receivingTx) setMintTx(s.receivingTx);
            setPhase("done");
            setNote(`Done. Your USDC is on Solana.`);
            return;
          }
          if (s.status === "FAILED") throw new Error(`That route did not go through: ${s.substatus || "unknown"}`);
          await sleep(15_000);
        }
        throw new Error("This is taking longer than usual. Your money left safely and will arrive shortly.");
      }

      // Fast (finality 1000) lands in seconds and deducts up to maxFee; Standard
      // (2000) is free but settles at hard finality.
      const useFast = speed === "fast" && fastBps != null;
      const maxFee = useFast ? maxFeeFor(amountIn, fastBps as number) : 0n;
      const finality = useFast ? FINALITY.fast : FINALITY.standard;

      let bTx: string;
      if (src.kind === "solana") {
        // Solana source -> EVM/Arc destination (mint happens on the EVM side).
        if (!solanaSigner) throw new Error("Connect your Solana wallet first.");
        const to = recipient.trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
          throw new Error(`Enter the destination address on ${dst.label} (0x…).`);
        }
        setPhase("burning");
        setNote(`Sending ${amount} USDC from Solana…`);
        bTx = await burnOnSolana(solanaSigner, solanaRpc(), {
          amount: amountIn,
          destinationDomain: dst.domain,
          mintRecipient: evmRecipient32(to),
          maxFee,
          minFinalityThreshold: finality,
        });
      } else if (smart.ready && smart.address && activeEvm.chain.id === src.chainId) {
        // EVM source, in-app (AA): approve + burn as one gasless batched userOp
        // signed by the embedded smart wallet — no MetaMask. Sends to self on the
        // destination unless a recipient is given.
        const to = (recipient.trim() || smart.address) as `0x${string}`;
        if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Recipient is not a valid address.");
        setPhase("burning");
        setNote(`Signing in-app and sending ${amount} USDC from ${src.label}…`);
        const burnTxAA = await smart.sendCalls([
          {
            to: src.usdc as `0x${string}`,
            data: encodeFunctionData({
              abi: erc20ApproveAbi,
              functionName: "approve",
              args: [tokenMessengerV2(network), amountIn],
            }),
          },
          {
            to: tokenMessengerV2(network),
            data: encodeFunctionData({
              abi: tokenMessengerV2Abi,
              functionName: "depositForBurn",
              args: [amountIn, dst.domain, toBytes32(to), src.usdc as `0x${string}`, ZERO32, maxFee, finality],
            }),
          },
        ]);
        if (!burnTxAA) throw new Error("The transfer didn't go through. Please try again.");
        bTx = burnTxAA;
      } else {
        // EVM source: injected wallet approves + burns.
        const provider = eth();
        if (!provider) throw new Error("No wallet found. Connect a wallet with USDC (e.g. MetaMask).");
        const [account] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
        const to = (recipient.trim() || account) as `0x${string}`;
        if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Recipient is not a valid address.");

        const chain = viemChainFor(src);
        const wallet = createWalletClient({ account, chain, transport: custom(provider) });
        const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

        setPhase("switching");
        setNote(`Switch your wallet to ${src.label}…`);
        try {
          await wallet.switchChain({ id: src.chainId as number });
        } catch (e: any) {
          if (e?.code === 4902 || /Unrecognized|not.*added/i.test(e?.message || "")) {
            await wallet.addChain({ chain });
            await wallet.switchChain({ id: src.chainId as number });
          } else throw e;
        }

        const allowance = (await pub.readContract({
          address: src.usdc as `0x${string}`,
          abi: erc20ApproveAbi,
          functionName: "allowance",
          args: [account, tokenMessengerV2(network)],
        })) as bigint;
        if (allowance < amountIn) {
          setPhase("approving");
          setNote("Approve the transfer in your wallet…");
          const aTx = await wallet.writeContract({
            address: src.usdc as `0x${string}`,
            abi: erc20ApproveAbi,
            functionName: "approve",
            args: [tokenMessengerV2(network), amountIn],
          });
          await pub.waitForTransactionReceipt({ hash: aTx, timeout: 60_000 });
        }

        setPhase("burning");
        setNote(`Sending ${amount} USDC from ${src.label}…`);
        const evmBurn = await wallet.writeContract({
          address: tokenMessengerV2(network),
          abi: tokenMessengerV2Abi,
          functionName: "depositForBurn",
          args: [amountIn, dst.domain, toBytes32(to), src.usdc as `0x${string}`, ZERO32, maxFee, finality],
        });
        await pub.waitForTransactionReceipt({ hash: evmBurn, timeout: 60_000 });
        bTx = evmBurn;
      }
      setBurnTx(bTx);

      // Wait for Circle's attestation, then the relayer mints on the destination.
      setPhase("attesting");
      setNote(
        useFast
          ? "Confirming your transfer. This usually takes a few seconds…"
          : "Confirming your transfer. A free standard transfer can take about 15 minutes…",
      );
      const deadline = Date.now() + 25 * 60_000;
      while (Date.now() < deadline) {
        const r = await relayMint({ srcDomain: src.domain, burnTx: bTx, dstKey, network });
        if (r.ok) {
          setMintTx(r.mintTx);
          setPhase("done");
          setNote(`Done. ${amount} USDC is now on ${dst.label}.`);
          return;
        }
        if (!r.pending) throw new Error(r.error);
        await sleep(20_000);
      }
      throw new Error("This is taking longer than usual. Your money is safe and will land shortly.");
    } catch (e: any) {
      setPhase("error");
      setNote(e?.shortMessage || e?.message || "That did not go through. Please try again.");
    }
  }

  const submitDisabled =
    busy || srcKey === dstKey || amountIn <= 0n || (viaLifi && !isSolAddr(recipient.trim()));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-slate text-[15px]">
          Move your money between the chains you use. You stay in control the whole time.
        </p>
        <Segmented
          aria-label="Network"
          size="sm"
          value={network}
          onChange={(v) => !busy && setNetwork(v)}
          options={[
            { value: "testnet", label: "Test" },
            { value: "mainnet", label: "Live" },
          ]}
        />
      </div>

      <div className="mt-4">
        <div className="text-xs font-bold text-slate mb-1">Coin</div>
        <Dropdown ariaLabel="Coin to move" value={coin} onChange={setCoin} options={COIN_OPTS} />
      </div>

      {coin !== "USDC" && <HyperPanel symbol={coin} network={network} />}

      {coin === "USDC" && !isTestnet && (
        <div className="mt-4">
          <Segmented
            aria-label="Bridge mode"
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "usdc", label: "USDC" },
              { value: "algorand", label: "Algorand" },
            ]}
          />
        </div>
      )}

      {coin === "USDC" && mode === "algorand" && !isTestnet && <WormholeAlgorand />}

      {coin === "USDC" && mode === "usdc" && (
        <CctpTransferCard
          coin={coin}
          busy={busy}
          srcKey={srcKey}
          dstKey={dstKey}
          pickSrc={pickSrc}
          setDstKey={setDstKey}
          srcChains={srcChains}
          dstChains={dstChains}
          src={src}
          dst={dst}
          viaLifi={viaLifi}
          speed={speed}
          setSpeed={setSpeed}
          fastBps={fastBps}
          feeLoading={feeLoading}
          amount={amount}
          setAmount={setAmount}
          recipient={recipient}
          setRecipient={setRecipient}
          smartAddress={smart.address}
          srcBal={srcBal}
          q={q}
          lifiLoading={lifiLoading}
          lifiQ={lifiQ}
          submitDisabled={submitDisabled}
          onSubmit={run}
          note={note}
          isError={phase === "error"}
          burnTx={burnTx}
          mintTx={mintTx}
        />
      )}

      {coin === "USDC" && (
        <p className="mt-3 text-xs text-slate/70">
          {isTestnet
            ? "Test mode uses free practice coins, so you can try a move end to end before using real money."
            : "New to a route? Moving a small amount first is a smart way to check everything works."}
        </p>
      )}
    </div>
  );
}
