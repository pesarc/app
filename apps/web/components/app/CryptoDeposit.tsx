"use client";

// Minimalist web3 deposit: show the wallet's address + QR. Since the balance
// reads on-chain, anything sent here is reflected automatically — no bridge,
// no relay, no explicit "credit" step.

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "@/components/icons";
import { Card } from "@/components/app/ui";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { chainLabel } from "@pesarc/sdk/chain/chains";
import { AddressText } from "@/components/app/AddressText";

export default function CryptoDeposit() {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const address = mode === "live" && authenticated ? smart.address : undefined;
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!address) {
      setQr("");
      return;
    }
    let active = true;
    QRCode.toDataURL(address, { width: 220, margin: 1 })
      .then((d) => active && setQr(d))
      .catch(() => active && setQr(""));
    return () => {
      active = false;
    };
  }, [address]);

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!address) {
    return (
      <Card className="p-5 text-sm text-slate">Connect your wallet to get a deposit address.</Card>
    );
  }

  return (
    <Card className="p-5 text-center">
      <div className="text-[13px] font-bold text-slate uppercase tracking-widest mb-3">
        Deposit on {chainLabel()}
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- generated data-URL QR
        <img src={qr} alt="Deposit address QR" width={200} height={200} className="mx-auto rounded-xl mb-4" />
      )}
      <button
        onClick={copy}
        className="w-full flex items-center justify-between gap-2 rounded-xl bg-black/[0.03] px-3.5 py-3 hover:bg-black/[0.05] transition text-left"
      >
        <span className="font-mono text-[13px] text-ink break-all">
          <AddressText address={address} />
        </span>
        {copied ? (
          <Check className="w-4 h-4 text-sky-deep shrink-0" />
        ) : (
          <Copy className="w-4 h-4 text-slate shrink-0" />
        )}
      </button>
      <p className="text-[12.5px] text-slate mt-3">
        Send any supported stablecoin to this address. Your balance updates automatically once it
        arrives.
      </p>
    </Card>
  );
}
