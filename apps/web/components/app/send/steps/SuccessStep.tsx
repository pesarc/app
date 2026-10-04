"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Share2, Sparkles } from "@/components/icons";
import { type Recipient } from "@pesarc/sdk/account";
import { CURRENCIES, formatMoney } from "@pesarc/sdk/money";
import { PAYOUT_METHODS, type Quote } from "@pesarc/sdk/quote";
import { Button, Card } from "@/components/app/ui";
import { authedPostJson } from "@pesarc/sdk/api/client";
import { sendReference } from "@pesarc/sdk/reference";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { chainByKey, explorerTxUrl as explorerTxUrlOn } from "@pesarc/sdk/chain/registry";
import { PayoutStatus } from "../PayoutStatus";
import { type BankDestination } from "../BankDetails";
import { formatEta } from "../QuoteBreakdown";
import { Row } from "../shared";

export function SuccessStep({
  recipient,
  quote,
  bankDest,
  txHash,
  chainKey,
  token,
  payoutTxHash,
  actualReceive,
  onAnother,
}: {
  recipient: Recipient;
  quote: Quote;
  bankDest: BankDestination | null;
  txHash?: string;
  /** App chain key the tx settled on (for the explorer link + record). */
  chainKey?: string;
  /** Token symbol that moved (e.g. "USDC"). */
  token?: string;
  payoutTxHash?: string;
  actualReceive?: number;
  onAnother: () => void;
}) {
  // Explorer for the chain the tx actually settled on (Arc, Base, …), not the
  // hub. Solana uses its own explorer; the hub helper is the last resort.
  const chainCfg = chainKey ? chainByKey(chainKey) : undefined;
  const txUrl = txHash
    ? chainCfg
      ? explorerTxUrlOn(chainCfg, txHash)
      : chainKey === "solana"
        ? `https://explorer.solana.com/tx/${txHash}?cluster=devnet`
        : explorerTxUrl(txHash)
    : undefined;
  const [copied, setCopied] = useState(false);
  const refRef = useRef(
    sendReference()
  );
  const ref = refRef.current;
  const payoutLabel =
    PAYOUT_METHODS.find((m) => m.id === quote.payout)?.label ?? "";

  // Persist the completed transfer once, and kick off the fiat payout when
  // the recipient chose a bank / mobile-money payout (best-effort).
  const posted = useRef(false);
  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    authedPostJson("/api/transfers", {
        direction: "sent",
        counterparty: recipient.name,
        counterpartyHandle: recipient.handle,
        sendAmount: quote.sendAmount,
        sendCurrency: quote.sendCurrency,
        receiveAmount: quote.receiveAmount,
        receiveCurrency: quote.receiveCurrency,
        payout: payoutLabel,
        reference: ref,
        flag: recipient.flag,
        txHash,
        chainKey,
        token,
      }).catch(() => {
      /* best-effort; UI already shows success */
    });

    // Only initiate the fiat payout when a real on-chain leg settled (a tx hash).
    // Without it there is nothing backing the payout, so never ask the partner to
    // disburse — this also stops a simulated "success" from firing a real payout.
    if ((quote.payout === "bank" || quote.payout === "mobile_money") && (payoutTxHash || txHash)) {
      authedPostJson("/api/payouts", {
          reference: ref,
          beneficiary: bankDest?.accountName || recipient.name,
          method: quote.payout,
          amountNgn: actualReceive ?? quote.receiveAmount,
          txHash: payoutTxHash ?? txHash,
          accountName: bankDest?.accountName,
          accountNumber: bankDest?.accountNumber,
          bankCode: bankDest?.bankCode,
        }).catch(() => {});
    }

    // Remember this recipient so they reappear next time (best-effort).
    const kind =
      recipient.id === "custom-bank" ? "bank" : recipient.id === "custom-phone" ? "phone" : "contact";
    authedPostJson("/api/recipients", {
      name: recipient.name,
      handle: recipient.handle,
      kind,
      receiveCurrency: recipient.receiveCurrency,
      flag: recipient.flag,
      country: recipient.country || undefined,
      bankCode: bankDest?.bankCode,
      accountLast4: bankDest?.accountNumber?.slice(-4),
    }).catch(() => {});
  }, [recipient, quote, payoutLabel, ref, txHash, chainKey, token, payoutTxHash, actualReceive, bankDest]);

  const share = async () => {
    const text = `I sent ${formatMoney(
      quote.receiveAmount,
      quote.receiveCurrency
    )} to ${recipient.name} with Pesarc · ref ${ref}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pesarc receipt", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user dismissed */
    }
  };

  return (
    <div className="py-4 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-sky flex items-center justify-center mb-5 shadow-pop-sm">
        <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>

      <h1 className="text-2xl font-semibold text-ink mb-1">
        {formatMoney(quote.receiveAmount, quote.receiveCurrency)} on its way
      </h1>
      <p className="text-slate mb-1">
        to {recipient.name} · {recipient.flag} {payoutLabel}
      </p>
      <p className="inline-flex items-center gap-1.5 text-sm text-success font-medium mb-7">
        <Sparkles className="w-4 h-4" /> They&apos;ve been notified
      </p>

      {(quote.payout === "bank" || quote.payout === "mobile_money") && (
        <div className="mb-4 text-left">
          <PayoutStatus reference={ref} method={quote.payout} />
        </div>
      )}

      <Card className="p-5 text-left mb-5">
        <Row label="You paid">
          {formatMoney(quote.sendAmount, quote.sendCurrency)}
        </Row>
        <div className="border-t border-black/[0.06]" />
        <Row label="Arrives">~{formatEta(quote.etaSeconds)}</Row>
        <div className="border-t border-black/[0.06]" />
        <Row label="Reference">
          <span className="font-mono text-sm">{ref}</span>
        </Row>
        {actualReceive !== undefined && (
          <>
            <div className="border-t border-black/[0.06]" />
            <Row label="They received">
              {CURRENCIES[quote.receiveCurrency]?.symbol ?? ""}
              {actualReceive.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}
            </Row>
          </>
        )}
        {txHash && (
          <>
            <div className="border-t border-black/[0.06]" />
            <Row label="Proof">
              <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
              >
                View tx <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Row>
          </>
        )}
        {payoutTxHash && (
          <>
            <div className="border-t border-black/[0.06]" />
            <Row label="Paid out">
              <a
                href={explorerTxUrl(payoutTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky font-medium hover:underline"
              >
                Recipient tx <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Row>
          </>
        )}
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" block onClick={share}>
          <Share2 className="w-4 h-4" />
          {copied ? "Copied" : "Share receipt"}
        </Button>
        <Button block onClick={onAnother}>
          Send another
        </Button>
      </div>
    </div>
  );
}
