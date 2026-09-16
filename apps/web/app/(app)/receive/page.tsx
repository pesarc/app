"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Share2 } from "lucide-react";
import { ACCOUNT, ALIAS } from "@pesarc/sdk/account";
import { CURRENCIES } from "@pesarc/sdk/money";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { chainLabel } from "@pesarc/sdk/chain/chains";
import { Button, Card } from "@/components/app/ui";

export default function ReceivePage() {
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const sym = CURRENCIES[ACCOUNT.currency].symbol;

  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  // Live = the QR/link is the wallet's REAL address on the hub chain, so
  // anyone can pay it directly on testnet.
  const live = mode === "live" && authenticated && Boolean(smart.address);
  const address = smart.address as string | undefined;

  // The pay link doubles as the QR payload the Scan & Pay flow parses:
  // `name` for display, `to` for the real on-chain payout, `amount` to
  // pre-fill — so paying it is a single tap. Built against the CURRENT origin
  // (localhost in dev, the real domain in prod) so the link/QR actually opens
  // the running app and routes into /pay, rather than a dead external URL.
  const link = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://pesarc.money";
    const params = new URLSearchParams();
    params.set("name", ALIAS);
    if (live && address) params.set("to", address);
    if (amount) params.set("amount", amount);
    return `${origin}/pay?${params.toString()}`;
  }, [live, address, amount]);

  // Generate a real, scannable QR for the payment target.
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
      color: { dark: "#1A191C", light: "#FFFFFF" },
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr("");
      });
    return () => {
      active = false;
    };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Pay me on Pesarc",
          text: live ? link : undefined,
          url: live ? undefined : link,
        });
      } else {
        await copy();
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
        Receive money
      </h1>
      <p className="text-slate mb-6">
        {live
          ? `Share your address or QR — payments land in your wallet on ${chainLabel()}.`
          : `Share your alias or QR. Anyone can pay you in their own currency — you receive ${ACCOUNT.currency}.`}
      </p>

      <Card className="p-6 flex flex-col items-center mb-4">
        <div className="w-56 h-56 rounded-xl bg-snow border border-black/[0.06] p-2 flex items-center justify-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Payment QR code"
              className="w-full h-full rounded-lg"
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-black/[0.04] animate-progress-pulse" />
          )}
        </div>
        <div className="mt-5 text-center">
          <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
            Your alias
          </div>
          <div className="text-2xl font-semibold text-ink">{ALIAS}</div>
          {live && address && (
            <div className="mt-2">
              <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-0.5">
                Wallet · {chainLabel()}
              </div>
              <div className="font-mono text-sm text-ink/80 break-all">
                {address}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Optional request amount — baked into the QR so payers just tap Pay */}
      <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-2">
        Request a specific amount (optional)
      </label>
      <div className="flex items-center gap-2 bg-snow rounded-field border border-fog px-4 py-3 shadow-card-flat mb-5">
        <span className="text-lg font-semibold text-ink/50">{sym}</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0"
          aria-label="Request amount"
          className="flex-1 bg-transparent text-lg font-semibold text-ink outline-none numerals placeholder:text-ink/25"
        />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" block onClick={copy}>
          {copied ? (
            <>
              <Check className="w-4 h-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" /> {live ? "Copy address" : "Copy link"}
            </>
          )}
        </Button>
        <Button block onClick={share}>
          <Share2 className="w-4 h-4" /> Share
        </Button>
      </div>
    </div>
  );
}
