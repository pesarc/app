"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Recipient } from "@pesarc/sdk/account";
import { type CurrencyCode } from "@pesarc/sdk/money";
import {
  applyLivePool,
  getQuote,
  type PayoutMethod,
  type Quote,
} from "@pesarc/sdk/quote";
import { fetchCorridorQuote, type LivePoolQuote } from "@pesarc/sdk/chain/liveQuote";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { usePrefs } from "@pesarc/sdk/prefs";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { TEST_RECIPIENT, RAMP_ESCROW } from "@pesarc/sdk/wallet/config";
import { CONTRACTS_READY } from "@pesarc/sdk/chain/contracts";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { useActiveNetwork } from "@pesarc/sdk/chain/activeNetwork";
import { type BankDestination } from "./BankDetails";
import { detectPhone, recipientFromBank, recipientFromPhone } from "./helpers";
import type { Step, SendResult } from "./types";

export function useSendState() {
  const { isAdvanced } = useUIMode();
  const { sendCurrency } = usePrefs(); // default currency — no per-send picking
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  // Solana selected → the EVM smart-wallet execution must not run; the flow
  // falls to its demo/simulated path (real execution stays on the EVM/Arc leg).
  const { isSvm } = useActiveNetwork();
  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [payout, setPayout] = useState<PayoutMethod>("bank");
  const [bankDest, setBankDest] = useState<BankDestination | null>(null);
  const [txHash, setTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [actualReceive, setActualReceive] = useState<number>();

  // Deep-link prefill. The agent's bulk-file preview (and any share link) hands a
  // recipient here as ?to=&amount=&ccy=&method=&name=&bank=. We seed the fields
  // and land on the AMOUNT step so the user still reviews the quote and confirms
  // — a prefilled link never auto-sends (read + draft only carries through).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const to = sp.get("to");
    if (!to) return;
    const method = sp.get("method");
    const ccy = (sp.get("ccy") || "").toUpperCase();
    const name = sp.get("name") || undefined;
    const amt = sp.get("amount");
    if (method === "bank") {
      const dest: BankDestination = { bankCode: sp.get("bank") || "", accountNumber: to, accountName: name };
      setBankDest(dest);
      setPayout("bank");
      setRecipient(recipientFromBank(dest));
    } else {
      const guess = detectPhone(to) ?? { pretty: to, country: "", flag: "🌍", ccy: (ccy || "NGN") as CurrencyCode };
      if (ccy) guess.ccy = ccy as CurrencyCode;
      setRecipient(recipientFromPhone(guess));
    }
    if (amt && Number(amt) > 0) setAmountStr(String(Number(amt)));
    setStep("amount");
    // Read the link once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amount = parseFloat(amountStr) || 0;

  // Live = a real on-chain gasless swap is possible right now. The swap targets
  // the cNGN hub pool, so the real execution only runs for NGN recipients today;
  // other corridors quote live off the oracle but settle via the simulated path
  // until their pool/netting execution ships (lift this gate then).
  const live =
    mode === "live" &&
    authenticated &&
    smart.ready &&
    CONTRACTS_READY &&
    !isSvm &&
    recipient?.receiveCurrency === "NGN";

  // Instant mock quote, then overlaid with live on-chain pool pricing
  // (oracle mid + exact swap simulation) when the corridor is on the hub.
  const [livePool, setLivePool] = useState<LivePoolQuote | null>(null);
  // Any USD corridor is quotable: NGN via the hub pool, the rest via the
  // realized-rate oracle (null result → the indicative mock quote stands).
  const liveQuotable = sendCurrency === "USD" && Boolean(recipient);
  const receiveCurrency = recipient?.receiveCurrency;

  useEffect(() => {
    setLivePool(null);
    if (!liveQuotable || amount <= 0 || !receiveCurrency) return;
    let stale = false;
    const t = setTimeout(() => {
      fetchCorridorQuote(amount, receiveCurrency).then((q) => {
        if (!stale) setLivePool(q);
      });
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [liveQuotable, amount, receiveCurrency]);

  const quote: Quote | null = useMemo(() => {
    if (!recipient || amount <= 0) return null;
    const mock = getQuote({
      sendAmount: amount,
      sendCurrency,
      receiveCurrency: recipient.receiveCurrency,
      payout,
    });
    return livePool ? applyLivePool(mock, livePool) : mock;
  }, [recipient, amount, payout, livePool, sendCurrency]);

  // Real gasless corridor send (USD -> NGN swap on the hub pool). The cNGN
  // then goes to the peer's wallet for in-app payouts, or to the ramp
  // partner's escrow when the recipient chose a fiat payout (bank / mobile
  // money) — the fiat leg is orchestrated off-chain from there.
  const executeReal = useCallback((): Promise<SendResult> => {
    const payoutTo =
      payout === "wallet"
        ? (TEST_RECIPIENT as `0x${string}` | "")
        : RAMP_ESCROW;
    return executeCorridorSend(smart, amount, payoutTo);
  }, [smart, amount, payout]);

  const reset = () => {
    setStep("recipient");
    setRecipient(null);
    setAmountStr("");
    setPayout("bank");
    setBankDest(null);
    setTxHash(undefined);
    setActualReceive(undefined);
  };

  return {
    isAdvanced,
    sendCurrency,
    step,
    setStep,
    recipient,
    setRecipient,
    amountStr,
    setAmountStr,
    payout,
    setPayout,
    bankDest,
    setBankDest,
    txHash,
    setTxHash,
    payoutTxHash,
    setPayoutTxHash,
    actualReceive,
    setActualReceive,
    quote,
    live,
    executeReal,
    reset,
  };
}
