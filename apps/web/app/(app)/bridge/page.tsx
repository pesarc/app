"use client";

// Production CCTP V2 bridge (Phase 1, EVM ↔ EVM incl. Arc). Non-custodial: the
// user's injected wallet approves + burns USDC on the source; the server relayer
// mints it on the destination (gasless for the user — see /api/bridge/relay).
// USDC-only. Solana + the aggregator layer (non-CCTP chains like Algorand) land
// in later phases.
import { useMemo, useState } from "react";
import { createWalletClient, createPublicClient, custom, http } from "viem";
import { Button, Card } from "@/components/app/ui";
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
  formatUsdc,
  viemChainFor,
  evmBridgeChains,
  relayMint,
} from "@pesarc/sdk/chain/cctp/bridge";

type Phase = "idle" | "switching" | "approving" | "burning" | "attesting" | "done" | "error";
const ZERO32 = ("0x" + "0".repeat(64)) as `0x${string}`;

function eth(): any {
  return typeof window !== "undefined" ? (window as any).ethereum : undefined;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BridgePage() {
  const chains = useMemo(() => evmBridgeChains(), []);
  const [srcKey, setSrcKey] = useState("base");
  const [dstKey, setDstKey] = useState("arc");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");
  const [burnTx, setBurnTx] = useState<`0x${string}` | "">("");
  const [mintTx, setMintTx] = useState<`0x${string}` | "">("");

  const src = CCTP_MAINNET[srcKey];
  const dst = CCTP_MAINNET[dstKey];
  const amountIn = amount ? parseUsdc(amount) : 0n;
  const q = amountIn > 0n ? quoteStandard(amountIn) : null;
  const busy = phase !== "idle" && phase !== "done" && phase !== "error";

  async function run() {
    setMintTx("");
    setBurnTx("");
    try {
      if (srcKey === dstKey) throw new Error("Pick two different chains.");
      if (amountIn <= 0n) throw new Error("Enter an amount.");
      const provider = eth();
      if (!provider) throw new Error("No wallet found. Connect a wallet with USDC (e.g. MetaMask).");

      const [account] = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
      const to = (recipient.trim() || account) as `0x${string}`;
      if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("Recipient is not a valid address.");

      const chain = viemChainFor(src);
      const wallet = createWalletClient({ account, chain, transport: custom(provider) });
      const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

      // Make sure the wallet is on the source chain.
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

      // Approve USDC to the TokenMessenger if needed.
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

      // Burn on the source (Standard transfer: free, hard finality).
      setPhase("burning");
      setNote(`Burning ${amount} USDC on ${src.label}…`);
      const bTx = await wallet.writeContract({
        address: TOKEN_MESSENGER_V2,
        abi: tokenMessengerV2Abi,
        functionName: "depositForBurn",
        args: [amountIn, dst.domain, toBytes32(to), src.usdc as `0x${string}`, ZERO32, 0n, FINALITY.standard],
      });
      await pub.waitForTransactionReceipt({ hash: bTx, timeout: 60_000 });
      setBurnTx(bTx);

      // Wait for Circle's attestation, then the relayer mints on the destination.
      setPhase("attesting");
      setNote("Waiting for Circle attestation, then minting on the destination (can take ~15 min for a free Standard transfer)…");
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
      <h1 className="text-xl font-extrabold tracking-tight">Bridge USDC</h1>
      <p className="mt-1 text-sm text-black/60">
        Native USDC across chains over Circle CCTP. Non-custodial — you burn, the
        network mints on the other side.
      </p>

      <Card className="mt-4 flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-black/60">
            From
            <select
              className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-sm font-semibold text-black"
              value={srcKey}
              onChange={(e) => setSrcKey(e.target.value)}
              disabled={busy}
            >
              {chains.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-black/60">
            To
            <select
              className="mt-1 w-full rounded-lg border border-black/10 bg-white p-2 text-sm font-semibold text-black"
              value={dstKey}
              onChange={(e) => setDstKey(e.target.value)}
              disabled={busy}
            >
              {chains.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

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
          Recipient on {dst.label} <span className="font-normal">(optional — defaults to your address)</span>
          <input
            placeholder="0x…"
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
            <Row k="Bridge fee" v={q.feeUsdc === 0n ? "Free (Standard)" : `${formatUsdc(q.feeUsdc)} USDC`} />
            <Row k="ETA" v={q.etaLabel} />
          </div>
        )}

        <Button onClick={run} disabled={busy || srcKey === dstKey || amountIn <= 0n}>
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

      <p className="mt-3 text-xs text-black/40">
        Phase 1 covers EVM chains and Arc over CCTP. Solana and non-CCTP chains
        (e.g. Algorand, via an aggregator) come next.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-black/50">{k}</span>
      <span className="font-semibold text-black">{v}</span>
    </div>
  );
}
