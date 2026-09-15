"use client";

// Add money: deposit native USDC from a spoke chain (CCTP V2 corridor) and
// have it credited on the hub — as tUSD, or auto-converted to cNGN. The
// relayer route takes a burn tx from either corridor to delivered funds.

import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Landmark,
  Loader2,
} from "lucide-react";
import { Button, Card } from "@/components/app/ui";
import { CORRIDORS, SOLANA_CORRIDOR } from "@pesarc/sdk/chain/corridors";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";

type RelayResult = {
  ok: boolean;
  error?: string;
  corridor?: string;
  recipient?: string;
  amountUsdc?: number;
  converted?: boolean;
  processTx?: string;
};

export default function AddMoneyPage() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  // EVM corridors + the Solana devnet corridor, one unified picker.
  const corridors = [
    ...Object.values(CORRIDORS).map((c) => ({
      id: c.chain.id,
      label: c.label,
      domain: c.domain,
      gateway: c.gateway as string,
      usdc: c.usdc as string,
      hint: "Any EVM wallet works",
    })),
    {
      id: SOLANA_CORRIDOR.chainId,
      label: SOLANA_CORRIDOR.label,
      domain: SOLANA_CORRIDOR.domain,
      gateway: SOLANA_CORRIDOR.gateway,
      usdc: SOLANA_CORRIDOR.usdc,
      hint: "Anchor program · paste tx signature",
    },
  ];

  const [chainId, setChainId] = useState(corridors[0].id);
  const [txHash, setTxHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RelayResult | null>(null);
  const [copied, setCopied] = useState("");

  const corridor = corridors.find((c) => c.id === chainId)!;
  const hubAddress =
    mode === "live" && authenticated && smart.address ? smart.address : null;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* ignore */
    }
  };

  const relay = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/cctp/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId, txHash: txHash.trim() }),
      });
      setResult((await res.json()) as RelayResult);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Failed." });
    }
    setBusy(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
        Add money
      </h1>
      <p className="text-slate mb-6">
        Deposit native USDC from another chain — it arrives on the hub over
        Circle CCTP V2 in under a minute.
      </p>

      {/* Corridor picker */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {corridors.map((c) => (
          <button
            key={c.id}
            onClick={() => setChainId(c.id)}
            className={`rounded-field border px-3.5 py-3 text-sm font-medium text-left transition ${
              c.id === chainId
                ? "border-sky bg-sky-tint text-ink"
                : "border-fog bg-snow text-slate hover:border-black/20"
            }`}
          >
            {c.label}
            <span className="block text-[11px] font-normal opacity-70">
              CCTP domain {c.domain}
            </span>
          </button>
        ))}
      </div>

      {/* Instructions */}
      <Card className="p-5 mb-4 space-y-3 text-sm">
        <div className="flex items-center gap-2 mb-1">
          <Landmark className="w-4 h-4 text-sky" />
          <span className="font-semibold text-ink">
            Deposit from {corridor.label}
          </span>
        </div>
        <Step n={1}>
          Approve, then call <code className="text-xs">sendToHub</code> on the
          gateway with your hub address{hubAddress ? "" : " (sign in to see it)"}
          — any wallet works.
        </Step>
        <AddrRow
          label="Gateway"
          value={corridor.gateway}
          copied={copied}
          onCopy={copy}
        />
        <AddrRow label="USDC" value={corridor.usdc} copied={copied} onCopy={copy} />
        {hubAddress && (
          <AddrRow
            label="Your hub address"
            value={hubAddress}
            copied={copied}
            onCopy={copy}
          />
        )}
        <Step n={2}>
          Paste the transaction hash below — we fetch Circle&apos;s attestation,
          finalize the mint on the hub, and credit you (auto-converting to cNGN
          when the deposit asked for it).
        </Step>
      </Card>

      {/* Relay */}
      <div className="flex gap-2 mb-4">
        <input
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x… burn transaction hash"
          aria-label="Burn transaction hash"
          className="flex-1 bg-snow rounded-field border border-fog px-4 py-3 text-sm font-mono text-ink placeholder:text-slate/60 shadow-card-flat focus:outline-none focus:border-sky/50"
        />
        <Button
          onClick={relay}
          disabled={busy || !/^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{64,90})$/.test(txHash.trim())}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          Relay
        </Button>
      </div>

      {result && (
        <Card
          className={`p-4 text-sm ${result.ok ? "" : "border-alert/40"}`}
        >
          {result.ok ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <Check className="w-4 h-4 text-sky" />
                {result.amountUsdc} USDC arrived from {result.corridor}
              </div>
              <div className="text-slate">
                {result.converted
                  ? "Auto-converted to cNGN and delivered."
                  : "Credited as hub tUSD."}{" "}
                {result.processTx && (
                  <a
                    href={explorerTxUrl(result.processTx)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
                  >
                    View delivery <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <span className="text-alert">{result.error}</span>
          )}
        </Card>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="w-5 h-5 rounded-full bg-sky-tint text-sky text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {n}
      </span>
      <p className="text-slate">{children}</p>
    </div>
  );
}

function AddrRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <button
      onClick={() => onCopy(label, value)}
      className="w-full flex items-center justify-between gap-2 rounded-field bg-black/[0.03] px-3 py-2 hover:bg-black/[0.05] transition text-left"
    >
      <span className="text-[11px] font-semibold text-slate uppercase tracking-widest shrink-0">
        {label}
      </span>
      <span className="font-mono text-xs text-ink truncate">{value}</span>
      {copied === label ? (
        <Check className="w-3.5 h-3.5 text-sky shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-slate shrink-0" />
      )}
    </button>
  );
}
