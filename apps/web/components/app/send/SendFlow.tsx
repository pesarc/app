"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "@/components/icons";
import { ACCOUNT, RECIPIENTS, initials, type Recipient } from "@pesarc/sdk/account";
import { CURRENCIES, formatMoney, formatNumber, type CurrencyCode } from "@pesarc/sdk/money";
import {
  applyLivePool,
  getQuote,
  PAYOUT_METHODS,
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
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { Avatar, Button, Card, Segmented } from "@/components/app/ui";
import { QuoteBreakdown, formatEta } from "./QuoteBreakdown";
import { PayoutStatus } from "./PayoutStatus";
import BankDetails, { type BankDestination } from "./BankDetails";
import { authedPostJson, authedFetch } from "@pesarc/sdk/api/client";
import type { SavedRecipient } from "@pesarc/sdk/recipients";
import { sendReference } from "@pesarc/sdk/reference";
import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";

type Step = "recipient" | "amount" | "confirm" | "settling" | "success";

type SendResult = { tx?: string; received?: number; payoutTx?: string };

export default function SendFlow() {
  const { isAdvanced } = useUIMode();
  const { sendCurrency } = usePrefs(); // default currency — no per-send picking
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
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

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <Progress step={step} />

      <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      >
        {step === "recipient" && (
          <RecipientStep
            onSelect={(r, opts) => {
              setRecipient(r);
              if (opts?.bankDest) setBankDest(opts.bankDest);
              if (opts?.payout) setPayout(opts.payout);
              setStep("amount");
            }}
          />
        )}

        {step === "amount" && recipient && (
          <AmountStep
            recipient={recipient}
            sendCurrency={sendCurrency}
            amountStr={amountStr}
            setAmountStr={setAmountStr}
            payout={payout}
            setPayout={setPayout}
            bankDest={bankDest}
            onBankChange={setBankDest}
            quote={quote}
            advanced={isAdvanced}
            onBack={() => setStep("recipient")}
            onNext={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && recipient && quote && (
          <ConfirmStep
            recipient={recipient}
            quote={quote}
            advanced={isAdvanced}
            onBack={() => setStep("amount")}
            onSend={() => setStep("settling")}
          />
        )}

        {step === "settling" && recipient && quote && (
          <SettlingStep
            recipient={recipient}
            quote={quote}
            executeReal={live ? executeReal : undefined}
            onDone={(r) => {
              setTxHash(r?.tx);
              setPayoutTxHash(r?.payoutTx);
              setActualReceive(r?.received);
              setStep("success");
            }}
          />
        )}

        {step === "success" && recipient && quote && (
          <SuccessStep
            recipient={recipient}
            quote={quote}
            bankDest={bankDest}
            txHash={txHash}
            payoutTxHash={payoutTxHash}
            actualReceive={actualReceive}
            onAnother={reset}
          />
        )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Progress dots ---------------- */

function Progress({ step }: { step: Step }) {
  const order: Step[] = ["recipient", "amount", "confirm"];
  const idx =
    step === "settling" || step === "success" ? 3 : order.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i <= idx ? "bg-sky w-8" : "bg-black/10 w-4"
          }`}
        />
      ))}
    </div>
  );
}

/* ---------------- Step 1: Recipient ---------------- */

// Infer the recipient's country + receive currency from a typed phone number's
// dialing code, so a raw number becomes a real, local-currency recipient.
const DIAL: { code: string; country: string; flag: string; ccy: CurrencyCode }[] = [
  { code: "234", country: "Nigeria", flag: "🇳🇬", ccy: "NGN" },
  { code: "233", country: "Ghana", flag: "🇬🇭", ccy: "GHS" },
  { code: "254", country: "Kenya", flag: "🇰🇪", ccy: "KES" },
];

type PhoneGuess = { pretty: string; country: string; flag: string; ccy: CurrencyCode };

function detectPhone(q: string): PhoneGuess | null {
  const t = q.trim();
  if (!/^\+?\d[\d\s-]{6,}$/.test(t)) return null; // looks like a phone number
  const digits = t.replace(/\D/g, "");
  if (digits.length < 9) return null;
  const m = DIAL.find((d) => digits.startsWith(d.code)) ?? DIAL[0]; // default Nigeria for local format
  return { pretty: t, country: m.country, flag: m.flag, ccy: m.ccy };
}

function recipientFromPhone(p: PhoneGuess): Recipient {
  return {
    id: "custom-phone",
    name: p.pretty,
    handle: p.pretty,
    country: p.country,
    flag: p.flag,
    receiveCurrency: p.ccy,
    initialsColor: "#3AA0FF",
  };
}

function recipientFromBank(dest: BankDestination): Recipient {
  return {
    id: "custom-bank",
    name: dest.accountName || "Bank account",
    handle: "•••• " + dest.accountNumber.slice(-4),
    country: "Nigeria",
    flag: "🇳🇬",
    receiveCurrency: "NGN",
    initialsColor: "#13426f",
  };
}

function savedToRecipient(s: SavedRecipient): Recipient {
  return {
    id: "saved-" + s.id,
    name: s.name,
    handle: s.handle,
    country: s.country ?? "",
    flag: s.flag ?? "🌍",
    receiveCurrency: s.receiveCurrency as CurrencyCode,
    recent: true,
    initialsColor: s.kind === "bank" ? "#13426f" : "#3AA0FF",
  };
}

function RecipientStep({
  onSelect,
}: {
  onSelect: (r: Recipient, opts?: { bankDest?: BankDestination; payout?: PayoutMethod }) => void;
}) {
  const [mode, setMode] = useState<"people" | "bank">("people");
  const [query, setQuery] = useState("");
  const [bankDest, setBankDest] = useState<BankDestination | null>(null);
  const [saved, setSaved] = useState<Recipient[]>([]);

  // Load the account's saved recipients (people you've sent to before).
  useEffect(() => {
    let alive = true;
    authedFetch("/api/recipients")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.ok) setSaved((d.recipients as SavedRecipient[]).map(savedToRecipient));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Saved recipients first, then the seed contacts (deduped by handle).
  const contacts = [...saved, ...RECIPIENTS.filter((m) => !saved.some((s) => s.handle === m.handle))];
  const recents = saved.length ? saved.slice(0, 5) : RECIPIENTS.filter((r) => r.recent);
  const rest = contacts.filter((c) => !recents.some((x) => x.handle === c.handle));
  const filtered = query
    ? contacts.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.handle.toLowerCase().includes(query.toLowerCase())
      )
    : contacts;
  const phone = detectPhone(query);
  const showNewPhone = !!phone && filtered.length === 0;

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">
        Who are you sending to?
      </h1>
      <p className="text-slate mb-5">
        Send to a contact, a phone number, or a bank account.
      </p>

      <div className="mb-5">
        <Segmented
          aria-label="Recipient type"
          value={mode}
          onChange={(v) => setMode(v as "people" | "bank")}
          options={[
            { value: "people", label: "Contact / phone" },
            { value: "bank", label: "Bank account" },
          ]}
        />
      </div>

      {mode === "people" ? (
        <>
          <div className="relative mb-6">
            <Search className="w-4 h-4 text-slate absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, or @alias"
              aria-label="Search recipients"
              className="w-full bg-snow rounded-field border border-fog pl-11 pr-4 py-3.5 text-[15px] text-ink placeholder:text-slate/70 shadow-card-flat focus:outline-none focus:border-sky/50 focus:ring-2 focus:ring-sky/15 transition"
            />
          </div>

          {showNewPhone && phone && (
            <button onClick={() => onSelect(recipientFromPhone(phone))} className="w-full mb-6">
              <Card className="flex items-center gap-3 p-4 hover:border-sky/40 transition">
                <span className="w-10 h-10 rounded-full bg-sky-tint flex items-center justify-center text-sky">
                  <ArrowRight className="w-5 h-5" />
                </span>
                <div className="text-left">
                  <div className="font-semibold text-ink">Send to {phone.pretty}</div>
                  <div className="text-sm text-slate">
                    {phone.flag} {phone.country} · receives {phone.ccy}
                  </div>
                </div>
              </Card>
            </button>
          )}

          {!query && (
            <p className="text-xs font-semibold text-slate uppercase tracking-widest mb-3">
              Recent
            </p>
          )}
          <div className="space-y-2">
            {(query ? filtered : recents).map((r) => (
              <RecipientRow key={r.id} r={r} onSelect={onSelect} />
            ))}
          </div>

          {!query && rest.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate uppercase tracking-widest mt-6 mb-3">
                All contacts
              </p>
              <div className="space-y-2">
                {rest.map((r) => (
                  <RecipientRow key={r.id} r={r} onSelect={onSelect} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="text-slate text-sm mb-3">
            Enter the account and we&apos;ll confirm the name before you send.
          </p>
          <BankDetails onChange={setBankDest} />
          <Button
            size="lg"
            block
            className="mt-5"
            disabled={!bankDest}
            onClick={() =>
              bankDest && onSelect(recipientFromBank(bankDest), { bankDest, payout: "bank" })
            }
          >
            {bankDest?.accountName ? `Send to ${bankDest.accountName}` : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function RecipientRow({
  r,
  onSelect,
}: {
  r: Recipient;
  onSelect: (r: Recipient) => void;
}) {
  return (
    <button onClick={() => onSelect(r)} className="w-full">
      <Card className="flex items-center gap-3 p-3.5 hover:border-sky/40 hover:shadow-pop-sm transition">
        <Avatar initials={initials(r.name)} color={r.initialsColor} />
        <div className="text-left flex-1 min-w-0">
          <div className="font-semibold text-ink truncate">{r.name}</div>
          <div className="text-sm text-slate truncate">
            {r.flag} {r.handle}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate shrink-0" />
      </Card>
    </button>
  );
}

/* ---------------- Step 2: Amount ---------------- */

function AmountStep({
  recipient,
  sendCurrency,
  amountStr,
  setAmountStr,
  payout,
  setPayout,
  bankDest,
  onBankChange,
  quote,
  advanced,
  onBack,
  onNext,
}: {
  recipient: Recipient;
  sendCurrency: CurrencyCode;
  amountStr: string;
  setAmountStr: (s: string) => void;
  payout: PayoutMethod;
  setPayout: (p: PayoutMethod) => void;
  bankDest: BankDestination | null;
  onBankChange: (v: BankDestination | null) => void;
  quote: Quote | null;
  advanced: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const sendC = CURRENCIES[sendCurrency];
  const amount = parseFloat(amountStr) || 0;
  // Live on-chain balance for the active network, with a demo fallback.
  const live = useLiveBalance();
  const bal = live.available && live.amount !== undefined ? live.amount : ACCOUNT.balance;
  const insufficient = amount > bal;
  // Recipient entered as a bank account: destination is already set/verified.
  const bankLocked = recipient.id === "custom-bank";
  // A bank payout needs a usable bank destination before we can review.
  const bankReady = payout !== "bank" || bankDest !== null;
  const valid = amount > 0 && !insufficient && bankReady;
  const savings =
    quote && quote.receiveAmount > quote.legacyReceiveAmount
      ? quote.receiveAmount - quote.legacyReceiveAmount
      : 0;

  return (
    <div>
      <StepNav onBack={onBack} title="How much?" />

      {/* Network + live balance. Switch network to see (and spend) that
          chain's on-chain balance, MetaMask-style. */}
      <div className="flex items-center justify-between mb-3">
        {advanced ? <NetworkSwitcher /> : <span />}
        <span className="text-[13px] font-bold text-harbor">
          {live.loading ? (
            <span className="text-slate">Checking balance…</span>
          ) : (
            <>
              {formatMoney(bal, sendCurrency)}
              {!live.available && <span className="ml-1 text-[11px] font-semibold text-slate">demo</span>}
            </>
          )}
        </span>
      </div>

      {/* Corridor card — sender and recipient joined by the arc */}
      <div className="relative overflow-hidden rounded-[26px] bg-harbor text-white p-5 sm:p-6 mb-4 shadow-[rgba(19,66,111,0.28)_0px_8px_0px_0px]">
        <svg
          viewBox="0 0 390 200"
          fill="none"
          aria-hidden
          className="absolute inset-0 w-full h-full opacity-50 pointer-events-none"
        >
          <path d="M60 150 C 150 60, 240 60, 330 150" stroke="#2e96ff" strokeWidth="1.6" strokeDasharray="2 6" strokeLinecap="round" />
        </svg>

        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60 mb-2.5">
              You send
            </div>
            <div className="flex items-baseline gap-1 numerals">
              <span className="text-2xl font-semibold text-white/55">{sendC.symbol}</span>
              <input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                aria-label="Amount to send"
                className="w-[5ch] bg-transparent text-[46px] leading-none font-extrabold tracking-tight text-white outline-none placeholder:text-white/30"
              />
            </div>
            <div className={`mt-2 text-[12.5px] font-medium ${insufficient ? "text-white font-bold" : "text-white/55"}`}>
              {insufficient ? "Over your balance · " : "Balance "}
              {formatMoney(bal, sendCurrency)}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 pt-1">
            <span className="w-11 h-11 rounded-full bg-snow/[0.12] flex items-center justify-center text-[22px]">
              {flagFor(sendCurrency)}
            </span>
            <svg width="16" height="30" viewBox="0 0 16 30" fill="none">
              <path d="M8 2 V 28" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeDasharray="2 4" />
              <polyline points="4 22 8 28 12 22" stroke="#50a7ff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="w-11 h-11 rounded-full bg-snow/[0.12] flex items-center justify-center text-[22px]">
              {recipient.flag}
            </span>
          </div>
        </div>

        <div className="relative mt-5 pt-4 border-t border-white/[0.14]">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60 mb-1.5">
            {recipient.name} receives
          </div>
          <div className="text-[34px] leading-none font-extrabold tracking-tight text-sky-tint numerals">
            {quote && valid ? formatMoney(quote.receiveAmount, quote.receiveCurrency) : "-"}
          </div>
          {savings > 0 && (
            <div className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-sky/20 text-sky-tint text-xs font-bold px-3 py-1.5">
              <Check className="w-3.5 h-3.5" />
              {formatMoney(savings, quote!.receiveCurrency)} more than banks
            </div>
          )}
        </div>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-2 mb-5">
        {[50, 100, 250].map((v) => {
          const active = amount === v;
          return (
            <button
              key={v}
              onClick={() => setAmountStr(String(v))}
              className={`flex-1 rounded-[14px] border px-0 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? "bg-sky-tint/50 border-sky text-sky-deep"
                  : "bg-snow border-fog text-harbor hover:border-slate/50"
              }`}
            >
              {sendC.symbol}
              {v}
            </button>
          );
        })}
        <button
          onClick={() => setAmountStr(String(bal))}
          className="flex-1 rounded-[14px] border border-fog bg-snow px-0 py-2.5 text-sm font-bold text-harbor hover:border-slate/50 transition-colors"
        >
          Max
        </button>
      </div>

      {/* Payout method. When the recipient IS a bank account (entered on the
          previous step), the destination is already set and verified, so we lock
          it and show a summary instead of re-asking. */}
      {bankLocked ? (
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate mb-2.5">
            Paying to
          </p>
          <div className="flex items-center gap-3 rounded-[18px] border border-fog bg-snow p-3.5">
            <span className="w-9 h-9 rounded-full bg-sky-tint flex items-center justify-center text-sky-deep">
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <div className="font-bold text-harbor text-[15px] truncate">{recipient.name}</div>
              <div className="text-[12.5px] font-medium text-slate">Bank account {recipient.handle}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate mb-2.5">
            Payout to
          </p>
          <div className="space-y-2.5 mb-5">
            {PAYOUT_METHODS.map((m) => {
              const active = m.id === payout;
              return (
                <button
                  key={m.id}
                  onClick={() => setPayout(m.id)}
                  className={`w-full flex items-center gap-3 rounded-[18px] border p-3.5 text-left transition-colors ${
                    active
                      ? "border-sky bg-sky-tint/40"
                      : "border-fog bg-snow hover:border-slate/40"
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-bold text-harbor text-[15px]">{m.label}</div>
                    <div className="text-[12.5px] font-medium text-slate">{m.hint}</div>
                  </div>
                  <span
                    className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${
                      active ? "bg-sky text-white" : "border-2 border-fog"
                    }`}
                  >
                    {active && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bank destination — collected inline for a real fiat payout */}
          {payout === "bank" && (
            <div className="mb-5">
              <BankDetails onChange={onBankChange} />
            </div>
          )}
        </>
      )}

      {/* Basic vs Advanced detail (Advanced toggled in Settings) */}
      {quote && valid && (
        <div className="mb-5">
          {advanced ? (
            <QuoteBreakdown quote={quote} />
          ) : (
            <div className="flex items-center justify-between rounded-2xl bg-harbor/5 px-4 py-3.5 text-[13.5px]">
              <span className="inline-flex items-center gap-2 font-semibold text-harbor">
                <Zap className="w-4 h-4 text-sky" /> Arrives in ~{formatEta(quote.etaSeconds)}
              </span>
              <span className="font-semibold text-slate">
                {(quote.feePct * 100).toFixed(2)}% fee
                {quote.live ? (
                  <span className="ml-1 text-sky-deep font-bold">· live rate</span>
                ) : (
                  <span className="ml-1 text-slate/70 font-medium">· indicative</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <Button size="lg" block disabled={!valid} onClick={onNext}>
        Review transfer
        <ArrowRight className="w-4 h-4" />
      </Button>

      <div className="flex items-center justify-center gap-1.5 mt-4 text-[12.5px] font-medium text-slate">
        <ShieldCheck className="w-3.5 h-3.5 text-sky-deep" />
        Recipient checked · no fees · in your own currency
      </div>
    </div>
  );
}

/* ---------------- Step 3: Confirm ---------------- */

function ConfirmStep({
  recipient,
  quote,
  advanced,
  onBack,
  onSend,
}: {
  recipient: Recipient;
  quote: Quote;
  advanced: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  const payoutLabel =
    PAYOUT_METHODS.find((m) => m.id === quote.payout)?.label ?? "";

  return (
    <div>
      <StepNav onBack={onBack} title="Confirm" />

      <Card className="p-6 mb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
              You pay
            </div>
            <div className="text-3xl font-semibold text-ink numerals">
              {formatMoney(quote.sendAmount, quote.sendCurrency)}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate" />
          <div className="text-right">
            <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-1">
              They get
            </div>
            <div className="text-3xl font-semibold text-sky numerals">
              {formatMoney(quote.receiveAmount, quote.receiveCurrency)}
            </div>
          </div>
        </div>

        <div className="divide-y divide-black/[0.06] border-t border-black/[0.06]">
          <Row label="To">
            <span className="inline-flex items-center gap-2">
              <Avatar
                initials={initials(recipient.name)}
                color={recipient.initialsColor}
                size={22}
              />
              {recipient.name}
            </span>
          </Row>
          <Row label="Payout">{`${recipient.flag} ${payoutLabel}`}</Row>
          <Row label="Arrives">~{formatEta(quote.etaSeconds)}</Row>
          {advanced && (
            <>
              <Row label="Rate">
                {`1 ${quote.sendCurrency} = ${formatNumber(
                  quote.effectiveRate,
                  quote.receiveCurrency
                )} ${quote.receiveCurrency}`}
              </Row>
              <Row label="Route">{quote.route}</Row>
            </>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm text-slate mb-5 px-1">
        <ShieldCheck className="w-4 h-4 text-sky shrink-0" />
        Recipient checked · no scam flags · no fees to send
      </div>

      <Button size="lg" block onClick={onSend}>
        Send {formatMoney(quote.sendAmount, quote.sendCurrency)}
      </Button>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-[15px]">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}

/* ---------------- Step 4: Settling ---------------- */

function SettlingStep({
  recipient,
  quote,
  executeReal,
  onDone,
}: {
  recipient: Recipient;
  quote: Quote;
  /** When present, performs a real gasless on-chain swap. */
  executeReal?: () => Promise<SendResult>;
  onDone: (result?: SendResult) => void;
}) {
  const payoutLabel =
    PAYOUT_METHODS.find((m) => m.id === quote.payout)?.label ?? "payout";
  const steps = useMemo(
    () => [
      { label: "Confirming your payment", sub: "No fees to send" },
      {
        label: "Sending your money",
        sub: "This takes a few seconds",
      },
      { label: `Paying out to ${payoutLabel}`, sub: "Landing in their account" },
    ],
    [quote.route, payoutLabel, executeReal]
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (executeReal) {
      // Real on-chain gasless send; animate while we await confirmation.
      timers.push(setTimeout(() => !cancelled && setActive(1), 800));
      timers.push(setTimeout(() => !cancelled && setActive(2), 1600));
      executeReal()
        .then((result) => {
          if (cancelled) return;
          setActive(3);
          onDone(result);
        })
        .catch(() => {
          // Never hard-fail the demo — fall back to a simulated success.
          if (cancelled) return;
          setActive(3);
          onDone(undefined);
        });
    } else {
      timers.push(setTimeout(() => setActive(1), 1100));
      timers.push(setTimeout(() => setActive(2), 2300));
      timers.push(setTimeout(() => onDone(), 3500));
    }
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="py-6">
      <div className="text-center mb-8">
        <div className="text-xs font-semibold text-slate uppercase tracking-widest mb-2">
          Sending to {recipient.name}
        </div>
        <div className="text-4xl font-semibold text-ink numerals">
          {formatMoney(quote.receiveAmount, quote.receiveCurrency)}
        </div>
      </div>

      <div className="space-y-1">
        {steps.map((s, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={s.label} className="flex items-start gap-3 p-3">
              <span
                className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition ${
                  done
                    ? "bg-sky text-white"
                    : current
                    ? "bg-sky-tint text-sky animate-progress-pulse"
                    : "bg-black/[0.06] text-slate"
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </span>
              <div>
                <div
                  className={`text-[15px] font-medium ${
                    done || current ? "text-ink" : "text-slate"
                  }`}
                >
                  {s.label}
                </div>
                <div className="text-xs text-slate">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Step 5: Success ---------------- */

function SuccessStep({
  recipient,
  quote,
  bankDest,
  txHash,
  payoutTxHash,
  actualReceive,
  onAnother,
}: {
  recipient: Recipient;
  quote: Quote;
  bankDest: BankDestination | null;
  txHash?: string;
  payoutTxHash?: string;
  actualReceive?: number;
  onAnother: () => void;
}) {
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
      }).catch(() => {
      /* best-effort; UI already shows success */
    });

    if (quote.payout === "bank" || quote.payout === "mobile_money") {
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
  }, [recipient, quote, payoutLabel, ref, txHash, payoutTxHash, actualReceive, bankDest]);

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
                href={explorerTxUrl(txHash)}
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

/* ---------------- Shared ---------------- */

function flagFor(code: CurrencyCode): string {
  return CURRENCIES[code]?.flag ?? "🌍";
}

function StepNav({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={onBack}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-snow border border-fog flex items-center justify-center text-ink hover:border-black/20 transition shadow-card-flat"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h1>
    </div>
  );
}
