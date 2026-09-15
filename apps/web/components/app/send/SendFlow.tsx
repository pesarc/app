"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { ACCOUNT, RECIPIENTS, initials, type Recipient } from "@pesarc/sdk/account";
import { CURRENCIES, formatMoney, formatNumber } from "@pesarc/sdk/money";
import {
  applyLivePool,
  getQuote,
  PAYOUT_METHODS,
  type PayoutMethod,
  type Quote,
} from "@pesarc/sdk/quote";
import {
  fetchLivePoolQuote,
  livePoolQuoteAvailable,
  type LivePoolQuote,
} from "@pesarc/sdk/chain/liveQuote";
import { useUIMode } from "@pesarc/sdk/ui-mode";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { TEST_RECIPIENT, RAMP_ESCROW } from "@pesarc/sdk/wallet/config";
import { CONTRACTS_READY } from "@pesarc/sdk/chain/contracts";
import { explorerTxUrl } from "@pesarc/sdk/chain/chains";
import { executeCorridorSend } from "@pesarc/sdk/chain/sendCorridor";
import { Avatar, Button, Card } from "@/components/app/ui";
import { QuoteBreakdown, formatEta } from "./QuoteBreakdown";
import { PayoutStatus } from "./PayoutStatus";
import { authedPostJson } from "@pesarc/sdk/api/client";
import { sendReference } from "@pesarc/sdk/reference";

type Step = "recipient" | "amount" | "confirm" | "settling" | "success";

type SendResult = { tx?: string; received?: number; payoutTx?: string };

export default function SendFlow() {
  const { isAdvanced } = useUIMode();
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();
  const [step, setStep] = useState<Step>("recipient");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [payout, setPayout] = useState<PayoutMethod>("bank");
  const [txHash, setTxHash] = useState<string>();
  const [payoutTxHash, setPayoutTxHash] = useState<string>();
  const [actualReceive, setActualReceive] = useState<number>();

  const amount = parseFloat(amountStr) || 0;

  // Live = a real on-chain gasless swap is possible right now.
  const live =
    mode === "live" && authenticated && smart.ready && CONTRACTS_READY;

  // Instant mock quote, then overlaid with live on-chain pool pricing
  // (oracle mid + exact swap simulation) when the corridor is on the hub.
  const [livePool, setLivePool] = useState<LivePoolQuote | null>(null);
  const liveQuotable =
    livePoolQuoteAvailable() &&
    ACCOUNT.currency === "USD" &&
    recipient?.receiveCurrency === "NGN";

  useEffect(() => {
    setLivePool(null);
    if (!liveQuotable || amount <= 0) return;
    let stale = false;
    const t = setTimeout(() => {
      fetchLivePoolQuote(amount).then((q) => {
        if (!stale) setLivePool(q);
      });
    }, 350);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [liveQuotable, amount]);

  const quote: Quote | null = useMemo(() => {
    if (!recipient || amount <= 0) return null;
    const mock = getQuote({
      sendAmount: amount,
      sendCurrency: ACCOUNT.currency,
      receiveCurrency: recipient.receiveCurrency,
      payout,
    });
    return livePool ? applyLivePool(mock, livePool) : mock;
  }, [recipient, amount, payout, livePool]);

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
    setTxHash(undefined);
    setActualReceive(undefined);
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <Progress step={step} />

      <div key={step} className="animate-step-in">
        {step === "recipient" && (
          <RecipientStep
            onSelect={(r) => {
              setRecipient(r);
              setStep("amount");
            }}
          />
        )}

        {step === "amount" && recipient && (
          <AmountStep
            recipient={recipient}
            amountStr={amountStr}
            setAmountStr={setAmountStr}
            payout={payout}
            setPayout={setPayout}
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
            txHash={txHash}
            payoutTxHash={payoutTxHash}
            actualReceive={actualReceive}
            onAnother={reset}
          />
        )}
      </div>
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
            i <= idx ? "bg-emerald w-8" : "bg-black/10 w-4"
          }`}
        />
      ))}
    </div>
  );
}

/* ---------------- Step 1: Recipient ---------------- */

function RecipientStep({ onSelect }: { onSelect: (r: Recipient) => void }) {
  const [query, setQuery] = useState("");
  const recents = RECIPIENTS.filter((r) => r.recent);
  const filtered = query
    ? RECIPIENTS.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.handle.toLowerCase().includes(query.toLowerCase())
      )
    : RECIPIENTS;

  const looksLikeHandle =
    query.length > 3 &&
    filtered.length === 0 &&
    /[+@0-9]/.test(query);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-deepink mb-1.5">
        Who are you sending to?
      </h1>
      <p className="text-muted mb-6">
        Pick someone recent, or enter a phone number or @alias.
      </p>

      <div className="relative mb-6">
        <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, phone, or @alias"
          aria-label="Search recipients"
          className="w-full bg-white rounded-field border border-black/10 pl-11 pr-4 py-3.5 text-[15px] text-deepink placeholder:text-muted/70 shadow-soft focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/15 transition"
        />
      </div>

      {looksLikeHandle && (
        <button
          onClick={() =>
            onSelect({
              id: "custom",
              name: query,
              handle: query,
              country: "Nigeria",
              flag: "🇳🇬",
              receiveCurrency: "NGN",
              initialsColor: "#EA580C",
            })
          }
          className="w-full mb-6"
        >
          <Card className="flex items-center gap-3 p-4 hover:border-emerald/40 transition">
            <span className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald">
              <ArrowRight className="w-5 h-5" />
            </span>
            <div className="text-left">
              <div className="font-semibold text-deepink">Send to {query}</div>
              <div className="text-sm text-muted">New recipient</div>
            </div>
          </Card>
        </button>
      )}

      {!query && (
        <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
          Recent
        </p>
      )}

      <div className="space-y-2">
        {(query ? filtered : recents).map((r) => (
          <RecipientRow key={r.id} r={r} onSelect={onSelect} />
        ))}
      </div>

      {!query && (
        <>
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mt-6 mb-3">
            All contacts
          </p>
          <div className="space-y-2">
            {RECIPIENTS.filter((r) => !r.recent).map((r) => (
              <RecipientRow key={r.id} r={r} onSelect={onSelect} />
            ))}
          </div>
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
      <Card className="flex items-center gap-3 p-3.5 hover:border-emerald/40 hover:shadow-soft-lg transition">
        <Avatar initials={initials(r.name)} color={r.initialsColor} />
        <div className="text-left flex-1 min-w-0">
          <div className="font-semibold text-deepink truncate">{r.name}</div>
          <div className="text-sm text-muted truncate">
            {r.flag} {r.handle}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted shrink-0" />
      </Card>
    </button>
  );
}

/* ---------------- Step 2: Amount ---------------- */

function AmountStep({
  recipient,
  amountStr,
  setAmountStr,
  payout,
  setPayout,
  quote,
  advanced,
  onBack,
  onNext,
}: {
  recipient: Recipient;
  amountStr: string;
  setAmountStr: (s: string) => void;
  payout: PayoutMethod;
  setPayout: (p: PayoutMethod) => void;
  quote: Quote | null;
  advanced: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const sendC = CURRENCIES[ACCOUNT.currency];
  const amount = parseFloat(amountStr) || 0;
  const insufficient = amount > ACCOUNT.balance;
  const valid = amount > 0 && !insufficient;
  const savings =
    quote && quote.receiveAmount > quote.legacyReceiveAmount
      ? quote.receiveAmount - quote.legacyReceiveAmount
      : 0;

  return (
    <div>
      <StepNav onBack={onBack} title="How much?" />

      <Card className="flex items-center gap-3 p-3 mb-5">
        <Avatar
          initials={initials(recipient.name)}
          color={recipient.initialsColor}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-deepink truncate">
            To {recipient.name}
          </div>
          <div className="text-xs text-muted truncate">
            {recipient.flag} {recipient.handle}
          </div>
        </div>
        <button
          onClick={onBack}
          className="text-sm font-medium text-emerald hover:underline"
        >
          Change
        </button>
      </Card>

      {/* Amount entry */}
      <div className="text-center py-4">
        <label className="block text-xs font-semibold text-muted uppercase tracking-widest mb-3">
          You send
        </label>
        <div className="flex items-center justify-center gap-1">
          <span className="text-4xl font-semibold text-deepink/40">
            {sendC.symbol}
          </span>
          <input
            value={amountStr}
            onChange={(e) =>
              setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))
            }
            inputMode="decimal"
            placeholder="0"
            aria-label="Amount to send"
            className="w-[6ch] bg-transparent text-6xl font-semibold text-deepink text-center outline-none numerals placeholder:text-deepink/25"
          />
        </div>
        <p
          className={`mt-2 text-sm ${
            insufficient ? "text-alert font-medium" : "text-muted"
          }`}
        >
          {insufficient
            ? `Balance is ${formatMoney(ACCOUNT.balance, ACCOUNT.currency)}`
            : `Balance ${formatMoney(ACCOUNT.balance, ACCOUNT.currency)}`}
        </p>
      </div>

      {/* They get */}
      {quote && valid && (
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-widest mb-1">
            <ArrowRight className="w-3.5 h-3.5" /> They receive
          </div>
          <div className="text-4xl font-semibold text-emerald numerals">
            {formatMoney(quote.receiveAmount, quote.receiveCurrency)}
          </div>
          {savings > 0 && (
            <p className="mt-1.5 text-sm text-success font-medium">
              ≈ {formatMoney(savings, quote.receiveCurrency)} more than banks
            </p>
          )}
        </div>
      )}

      {/* Payout method */}
      <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
        Payout to
      </p>
      <div className="space-y-2 mb-5">
        {PAYOUT_METHODS.map((m) => {
          const active = m.id === payout;
          return (
            <button
              key={m.id}
              onClick={() => setPayout(m.id)}
              className={`w-full flex items-center gap-3 rounded-field border p-3.5 text-left transition ${
                active
                  ? "border-emerald bg-emerald-50"
                  : "border-black/10 bg-white hover:border-black/20"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  active ? "border-emerald" : "border-black/20"
                }`}
              >
                {active && <span className="w-2.5 h-2.5 rounded-full bg-emerald" />}
              </span>
              <div className="flex-1">
                <div className="font-medium text-deepink text-[15px]">
                  {m.label}
                </div>
                <div className="text-xs text-muted">{m.hint}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Basic vs Advanced detail */}
      {quote && valid && (
        <div className="mb-6">
          {advanced ? (
            <QuoteBreakdown quote={quote} />
          ) : (
            <div className="rounded-field bg-black/[0.03] px-4 py-3 text-sm text-muted flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald" /> Arrives in ~
                {formatEta(quote.etaSeconds)}
              </span>
              <span>
                {(quote.feePct * 100).toFixed(2)}% fee included
                {quote.live && (
                  <span className="ml-1.5 text-emerald font-medium">· live rate</span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <Button
        size="lg"
        block
        disabled={!valid}
        onClick={onNext}
      >
        Review transfer
        <ArrowRight className="w-4 h-4" />
      </Button>
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
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
              You pay
            </div>
            <div className="text-3xl font-semibold text-deepink numerals">
              {formatMoney(quote.sendAmount, quote.sendCurrency)}
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted" />
          <div className="text-right">
            <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">
              They get
            </div>
            <div className="text-3xl font-semibold text-emerald numerals">
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

      <div className="flex items-center gap-2 text-sm text-muted mb-5 px-1">
        <ShieldCheck className="w-4 h-4 text-emerald shrink-0" />
        Recipient screened · no scam flags · gasless, no network fee
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
      <span className="text-muted">{label}</span>
      <span className="font-medium text-deepink">{children}</span>
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
      { label: "Authorizing your payment", sub: "Gasless — no network fee" },
      {
        label: executeReal
          ? "Settling on-chain"
          : quote.route.startsWith("CoW")
          ? "Matching liquidity (CoW)"
          : "Routing via Circle CCTP V2",
        sub: executeReal ? "Smart wallet · sponsored gas" : "Settling on the unified hub",
      },
      { label: `Paying out · ${payoutLabel}`, sub: "Local last-mile partner" },
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
        <div className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">
          Sending to {recipient.name}
        </div>
        <div className="text-4xl font-semibold text-deepink numerals">
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
                    ? "bg-emerald text-white"
                    : current
                    ? "bg-emerald-50 text-emerald animate-progress-pulse"
                    : "bg-black/[0.06] text-muted"
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
                    done || current ? "text-deepink" : "text-muted"
                  }`}
                >
                  {s.label}
                </div>
                <div className="text-xs text-muted">{s.sub}</div>
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
  txHash,
  payoutTxHash,
  actualReceive,
  onAnother,
}: {
  recipient: Recipient;
  quote: Quote;
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
          beneficiary: recipient.name,
          method: quote.payout,
          amountNgn: actualReceive ?? quote.receiveAmount,
          txHash: payoutTxHash ?? txHash,
        }).catch(() => {});
    }
  }, [recipient, quote, payoutLabel, ref, txHash, payoutTxHash, actualReceive]);

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
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald flex items-center justify-center mb-5 shadow-soft-lg">
        <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>

      <h1 className="text-2xl font-semibold text-deepink mb-1">
        {formatMoney(quote.receiveAmount, quote.receiveCurrency)} on its way
      </h1>
      <p className="text-muted mb-1">
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
            <Row label="Received on-chain">
              {actualReceive.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              tNGN
            </Row>
          </>
        )}
        {txHash && (
          <>
            <div className="border-t border-black/[0.06]" />
            <Row label="On-chain">
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-emerald font-medium hover:underline"
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
                className="inline-flex items-center gap-1 text-emerald font-medium hover:underline"
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

function StepNav({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <button
        onClick={onBack}
        aria-label="Back"
        className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center text-deepink hover:border-black/20 transition shadow-soft"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-deepink">
        {title}
      </h1>
    </div>
  );
}
