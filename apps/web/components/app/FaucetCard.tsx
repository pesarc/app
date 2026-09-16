"use client";

// Testnet faucet card — mints test stablecoins (+ a gas drip) to the user's
// wallet so they can try the app. Shown on the Add-money screen.

import { useState } from "react";
import { Check, Droplets, ExternalLink, Loader2 } from "lucide-react";
import { Card } from "@/components/app/ui";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";

type Result = {
  ok: boolean;
  error?: string;
  minted?: { code: string; amount: string; tx: string }[];
  gasDripTx?: string;
};

export default function FaucetCard() {
  const { address: eoa } = useWallet();
  const smart = useSmartWallet();
  const address = smart.address ?? eoa;

  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  const drip = async () => {
    if (!address) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setRes(await r.json());
    } catch {
      setRes({ ok: false, error: "Couldn't reach the faucet — try again." });
    }
    setBusy(false);
  };

  return (
    <Card className="p-5 mb-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-sky-tint/60 flex items-center justify-center text-sky-deep shrink-0">
          <Droplets className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold text-harbor">Get test funds</div>
          <p className="text-[13px] font-medium text-slate leading-snug mt-0.5">
            Testnet only — mints cNGN, cGHS &amp; cKES to your wallet on Arbitrum Sepolia so you
            can try sending and staking.
          </p>

          {res?.ok ? (
            <div className="mt-3 rounded-2xl bg-sky-tint/40 px-4 py-3">
              <div className="inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-deep">
                <Check className="w-4 h-4" /> Funded — 500,000 of each stablecoin
              </div>
              {res.minted?.[0]?.tx && (
                <a
                  href={`https://sepolia.arbiscan.io/tx/${res.minted[0].tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-sky-deep hover:underline"
                >
                  View on-chain <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : res && !res.ok ? (
            <p className="mt-2 text-[12.5px] font-semibold text-alert">{res.error}</p>
          ) : null}

          <button
            onClick={drip}
            disabled={busy || !address}
            className="mt-3 inline-flex items-center gap-2 rounded-pill bg-sky text-white text-sm font-bold px-4 py-2.5 shadow-pop-sm hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
            {busy ? "Sending…" : !address ? "Sign in first" : "Get test funds"}
          </button>
        </div>
      </div>
    </Card>
  );
}
