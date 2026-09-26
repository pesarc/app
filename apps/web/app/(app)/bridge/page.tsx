"use client";

// Production CCTP V2 bridge (Phase 1, EVM ↔ EVM incl. Arc). Non-custodial: the
// user's injected wallet approves + burns USDC on the source; the server relayer
// mints it on the destination (gasless for the user — see /api/bridge/relay).
// USDC-only. Solana + the aggregator layer (non-CCTP chains like Algorand) land
// in later phases.
import { useEffect, useMemo, useState } from "react";
import { createWalletClient, createPublicClient, custom, http } from "viem";
import { Button, Card, Select, Segmented } from "@/components/app/ui";
import WormholeAlgorand from "@/components/app/bridge/WormholeAlgorand";
import {
  CCTP_MAINNET,
  TOKEN_MESSENGER_V2,
} from "@pesarc/sdk/chain/cctp/mainnet";
import { tokenMessengerV2Abi, erc20ApproveAbi } from "@pesarc/sdk/chain/cctp/abi";
import {
  FINALITY,
  toBytes32,
  parseUsdc,
  quoteStandard,
  quoteFast,
  maxFeeFor,
  fetchFee,
  formatUsdc,
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

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const isSolAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

type Phase = "idle" | "switching" | "approving" | "burning" | "attesting" | "done" | "error";
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;

function eth(): any {
  return typeof window !== "undefined" ? (window as any).ethereum : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BridgePage() {
  const evmChains = useMemo(() => evmBridgeChains(), []);
  // Source can be any CCTP chain (incl. Solana); destination is EVM/Arc for now
  // (minting on Solana is a later phase).
  const srcChains = useMemo(() => [...evmChains, CCTP_MAINNET.solana], [evmChains]);
  // Destination can be EVM/Arc (native CCTP) or Solana (routed via LI.FI).
  const dstChains = useMemo(() => [...evmChains, CCTP_MAINNET.solana], [evmChains]);
  const solanaSigner = useSolanaSigner();
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

  const src = CCTP_MAINNET[srcKey];
  const dst = CCTP_MAINNET[dstKey];
  const amountIn = amount ? parseUsdc(amount) : 0n;
  // EVM→Solana can't use native CCTP here (no on-Solana mint) — route via LI.FI.
  const viaLifi = src.kind === "evm" && dst.kind === "solana";

  // Native CCTP corridors: refetch Circle's Fast fee when the pair changes.
  useEffect(() => {
    if (srcKey === dstKey || viaLifi) return;
    let live = true;
    setFeeLoading(true);
    setFastBps(null);
    fetchFee(src.domain, dst.domain).then((f) => {
      if (live) {
        setFastBps(f.fastBps);
        setFeeLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [srcKey, dstKey, src.domain, dst.domain, viaLifi]);

  // LI.FI route estimate for EVM→Solana (debounced on amount/recipient).
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

      // EVM → Solana via LI.FI (their bridge handles the Solana leg).
      if (viaLifi) {
        const provider = eth();
        if (!provider) throw new Error("Connect an EVM wallet with USDC (e.g. MetaMask).");
        const to = recipient.trim();
        if (!isSolAddr(to)) throw new Error("Enter the destination Solana address.");
        const [account] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];

        setPhase("switching");
        setNote("Finding the best route via LI.FI…");
        const quote = await getLifiQuote({
          fromChain: src.chainId as number,
          toChain: LIFI_SOLANA_CHAIN,
          fromToken: src.usdc,
          toToken: SOLANA_USDC_MINT,
          fromAmount: amountIn.toString(),
          fromAddress: account,
          toAddress: to,
        });

        const chain = viemChainFor(src);
        const wallet = createWalletClient({ account, chain, transport: custom(provider) });
        const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
        try {
          await wallet.switchChain({ id: src.chainId as number });
        } catch (e: any) {
          if (e?.code === 4902) await wallet.addChain({ chain });
          await wallet.switchChain({ id: src.chainId as number });
        }

        // Approve USDC to the LI.FI router if needed.
        const spender = quote.transactionRequest.to;
        const allowance = (await pub.readContract({
          address: src.usdc as `0x${string}`,
          abi: erc20ApproveAbi,
          functionName: "allowance",
          args: [account, spender],
        })) as bigint;
        if (allowance < amountIn) {
          setPhase("approving");
          setNote("Approve USDC…");
          const aTx = await wallet.writeContract({
            address: src.usdc as `0x${string}`,
            abi: erc20ApproveAbi,
            functionName: "approve",
            args: [spender, amountIn],
          });
          await pub.waitForTransactionReceipt({ hash: aTx, timeout: 60_000 });
        }

        setPhase("burning");
        setNote(`Bridging ${amount} USDC to Solana via ${quote.tool}…`);
        const hash = await wallet.sendTransaction({
          to: quote.transactionRequest.to,
          data: quote.transactionRequest.data,
          value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : 0n,
        });
        await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
        setBurnTx(hash);

        setPhase("attesting");
        setNote("Bridging via LI.FI — delivering to Solana…");
        const dl = Date.now() + 25 * 60_000;
        while (Date.now() < dl) {
          const s = await getLifiStatus(hash, src.chainId as number, LIFI_SOLANA_CHAIN);
          if (s.status === "DONE") {
            if (s.receivingTx) setMintTx(s.receivingTx);
            setPhase("done");
            setNote(`Delivered USDC to Solana via ${quote.tool}.`);
            return;
          }
          if (s.status === "FAILED") throw new Error(`Route failed: ${s.substatus || "unknown"}`);
          await sleep(15_000);
        }
        throw new Error("Timed out; the source tx is confirmed — check LI.FI status later.");
      }

      // Fast (finality 1000) lands in seconds and deducts up to maxFee; Standard
      // (2000) is free but settles at hard finality.
      const useFast = speed === "fast" && fastBps != null;
      const maxFee = useFast ? maxFeeFor(amountIn, fastBps as number) : 0n;
      const finality = useFast ? FINALITY.fast : FINALITY.standard;

      let bTx: string;
      if (src.kind === "solana") {
        // Solana source → EVM/Arc destination (mint happens on the EVM side).
        if (!solanaSigner) throw new Error("Connect your Solana wallet to bridge from Solana.");
        const to = recipient.trim();
        if (!/^0x[0-9a-fA-F]{40}$/.test(to)) {
          throw new Error(`Enter the destination address on ${dst.label} (0x…).`);
        }
        setPhase("burning");
        setNote(`Burning ${amount} USDC on Solana…`);
        bTx = await burnOnSolana(solanaSigner, solanaRpc(), {
          amount: amountIn,
          destinationDomain: dst.domain,
          mintRecipient: evmRecipient32(to),
          maxFee,
          minFinalityThreshold: finality,
        });
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
          args: [account, TOKEN_MESSENGER_V2],
        })) as bigint;
        if (allowance < amountIn) {
          setPhase("approving");
          setNote("Approve USDC…");
          const aTx = await wallet.writeContract({
            address: src.usdc as `0x${string}`,
            abi: erc20ApproveAbi,
            functionName: "approve",
            args: [TOKEN_MESSENGER_V2, amountIn],
          });
          await pub.waitForTransactionReceipt({ hash: aTx, timeout: 60_000 });
        }

        setPhase("burning");
        setNote(`Burning ${amount} USDC on ${src.label}…`);
        const evmBurn = await wallet.writeContract({
          address: TOKEN_MESSENGER_V2,
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
          ? "Waiting for Circle's fast attestation, then minting on the destination (seconds)…"
          : "Waiting for Circle attestation, then minting on the destination (can take ~15 min for a free Standard transfer)…",
      );
      const deadline = Date.now() + 25 * 60_000;
      while (Date.now() < deadline) {
        const r = await relayMint({ srcDomain: src.domain, burnTx: bTx, dstKey });
        if (r.ok) {
          setMintTx(r.mintTx);
          setPhase("done");
          setNote(`Delivered ${amount} USDC on ${dst.label}.`);
          return;
        }
        if (!r.pending) throw new Error(r.error);
        await sleep(20_000);
      }
      throw new Error("Timed out waiting for attestation. Your burn is safe — finalize it later with the same burn tx.");
    } catch (e: any) {
      setPhase("error");
      setNote(e?.shortMessage || e?.message || "Bridge failed.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6">
      <h1 className="text-xl font-extrabold tracking-tight">Bridge</h1>
      <p className="mt-1 text-sm text-black/60">
        Move USDC across chains over Circle CCTP + LI.FI, or bridge Algorand
        assets via Wormhole. Non-custodial.
      </p>

      <div className="mt-4">
        <Segmented
          aria-label="Bridge mode"
          value={mode}
          onChange={(v) => setMode(v)}
          options={[
            { value: "usdc", label: "USDC (CCTP/LI.FI)" },
            { value: "algorand", label: "Algorand (Wormhole)" },
          ]}
        />
      </div>

      {mode === "algorand" && <WormholeAlgorand />}

      {mode === "usdc" && (
      <Card className="mt-4 flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-black/60">
            From
            <Select
              className="mt-1"
              value={srcKey}
              onChange={(e) => setSrcKey(e.target.value)}
              disabled={busy}
            >
              {srcChains.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-bold text-black/60">
            To
            <Select
              className="mt-1"
              value={dstKey}
              onChange={(e) => setDstKey(e.target.value)}
              disabled={busy}
            >
              {dstChains.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </label>
        </div>

        {!viaLifi && (
        <div>
          <span className="text-xs font-bold text-black/60">Speed</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSpeed("fast")}
              disabled={busy || fastBps == null}
              className={`rounded-lg border p-2 text-left text-xs transition ${
                speed === "fast" && fastBps != null
                  ? "border-blue-500 bg-blue-50"
                  : "border-black/10 bg-white"
              } disabled:opacity-50`}
            >
              <div className="font-bold text-black">Fast</div>
              <div className="text-black/50">
                {feeLoading ? "checking fee…" : fastBps == null ? "unavailable" : "~seconds · small fee"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSpeed("standard")}
              disabled={busy}
              className={`rounded-lg border p-2 text-left text-xs transition ${
                speed === "standard" || fastBps == null
                  ? "border-blue-500 bg-blue-50"
                  : "border-black/10 bg-white"
              }`}
            >
              <div className="font-bold text-black">Standard</div>
              <div className="text-black/50">~13–19 min · free</div>
            </button>
          </div>
        </div>
        )}

        <label className="text-xs font-bold text-black/60">
          Amount (USDC)
          <input
            inputMode="decimal"
            placeholder="0.00"
            className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-lg font-bold text-black"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            disabled={busy}
          />
        </label>

        <label className="text-xs font-bold text-black/60">
          Recipient on {dst.label}{" "}
          <span className="font-normal">
            {dst.kind === "solana"
              ? "(required — Solana address)"
              : src.kind === "solana"
                ? "(required — destination address)"
                : "(optional — defaults to your address)"}
          </span>
          <input
            placeholder={dst.kind === "solana" ? "Solana address…" : "0x…"}
            className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-sm font-mono text-black"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value.trim())}
            disabled={busy}
          />
        </label>

        {q && (
          <div className="rounded-lg bg-black/[0.03] p-3 text-sm">
            <Row k="You send" v={`${formatUsdc(q.amountIn)} USDC on ${src.label}`} />
            <Row k="They receive" v={`${formatUsdc(q.amountOut)} USDC on ${dst.label}`} />
            <Row k="Bridge fee" v={feeLabel(q.feeUsdc)} />
            <Row k="ETA" v={q.etaLabel} />
          </div>
        )}

        {viaLifi && (
          <div className="rounded-lg bg-black/[0.03] p-3 text-sm">
            {lifiLoading && <p className="text-black/50">Finding the best route…</p>}
            {!lifiLoading && lifiQ && (
              <>
                <Row k="You send" v={`${amount || "0"} USDC on ${src.label}`} />
                <Row k="They receive" v={`${(Number(lifiQ.toAmount) / 1e6).toFixed(2)} USDC on Solana`} />
                <Row k="Fees (bridge + gas)" v={`~$${(lifiQ.feeUSD + lifiQ.gasUSD).toFixed(2)}`} />
                <Row k="ETA" v={`~${Math.max(1, Math.round(lifiQ.durationSec / 60))} min`} />
                <Row k="Route" v={`via ${lifiQ.tool} (LI.FI)`} />
              </>
            )}
            {!lifiLoading && !lifiQ && (
              <p className="text-black/50">Enter a Solana recipient to see the route.</p>
            )}
          </div>
        )}

        <Button
          onClick={run}
          disabled={busy || srcKey === dstKey || amountIn <= 0n || (viaLifi && !isSolAddr(recipient.trim()))}
        >
          {busy ? "Bridging…" : `Bridge to ${dst.label}`}
        </Button>

        {note && (
          <p className={`text-sm ${phase === "error" ? "text-red-600" : "text-black/70"}`}>{note}</p>
        )}
        {burnTx && (
          <a className="text-xs font-semibold text-blue-600 underline" href={src.explorerTx(burnTx)} target="_blank" rel="noreferrer">
            Burn tx on {src.label} ↗
          </a>
        )}
        {mintTx && (
          <a className="text-xs font-semibold text-blue-600 underline" href={dst.explorerTx(mintTx)} target="_blank" rel="noreferrer">
            Mint tx on {dst.label} ↗
          </a>
        )}
      </Card>
      )}

      {mode === "usdc" && (
        <p className="mt-3 text-xs text-black/40">
          EVM ↔ EVM/Arc and Solana → EVM use native Circle CCTP; EVM → Solana
          routes via LI.FI. Algorand uses Wormhole (switch above). Test a small
          amount on any new corridor first.
        </p>
      )}
    </div>
  );
}

function feeLabel(v: bigint): string {
  if (v === 0n) return "Free (Standard)";
  const usd = Number(v) / 1_000_000;
  if (usd < 0.01) return `~$${usd.toFixed(4)} (fast)`;
  return `${usd.toFixed(2)} USDC`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-black/50">{k}</span>
      <span className="font-semibold text-black">{v}</span>
    </div>
  );
}
