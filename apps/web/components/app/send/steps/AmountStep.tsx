"use client";

import { ArrowRight, Check, ShieldCheck, Zap } from "@/components/icons";
import { ACCOUNT, type Recipient } from "@pesarc/sdk/account";
import { CURRENCIES, formatMoney, midMarketRate, type CurrencyCode } from "@pesarc/sdk/money";
import { PAYOUT_METHODS, type PayoutMethod, type Quote } from "@pesarc/sdk/quote";
import { useLiveBalance } from "@pesarc/sdk/chain/useLiveBalance";
import { Button } from "@/components/app/ui";
import { Dropdown } from "@/components/app/Dropdown";
import { AddressText } from "@/components/app/AddressText";
import { chainLogoUrlForLabel } from "@/lib/chainLogos";
import NetworkSwitcher from "@/components/app/NetworkSwitcher";
import BankDetails, { type BankDestination } from "../BankDetails";
import { QuoteBreakdown, formatEta } from "../QuoteBreakdown";
import { flagFor, isWalletRecipient } from "../helpers";
import { StepNav } from "../shared";

export function AmountStep({
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
  walletChainLabel,
  walletIsEvm,
  destChainKey,
  setDestChainKey,
  destChainOptions,
  sourceChainLabel,
  sendToken,
  setSendToken,
  sendTokenOptions,
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
  walletChainLabel?: string;
  walletIsEvm?: boolean;
  destChainKey?: string;
  setDestChainKey?: (k: string) => void;
  destChainOptions?: { key: string; label: string }[];
  sourceChainLabel?: string;
  sendToken?: string;
  setSendToken?: (s: string) => void;
  sendTokenOptions?: { value: string; label: string }[];
  onBack: () => void;
  onNext: () => void;
}) {
  const sendC = CURRENCIES[sendCurrency];
  const amount = parseFloat(amountStr) || 0;
  // Recipient is a raw on-chain wallet: destination (address + chain) is already
  // chosen, so there's no payout method to pick — show it, don't re-ask.
  const isWallet = isWalletRecipient(recipient);
  // Balance of the token this send moves: the picked token for a wallet send,
  // else the USD send currency. useLiveBalance resolves by symbol.
  const live = useLiveBalance(isWallet && sendToken ? sendToken : sendCurrency);
  const bal = live.available && live.amount !== undefined ? live.amount : ACCOUNT.balance;
  const balDisplay =
    isWallet && sendToken
      ? `${bal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${sendToken}`
      : formatMoney(bal, sendCurrency);
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

      {/* Network + live balance. Switch network (every EVM chain + Solana) to
          see (and spend) that chain's balance, MetaMask-style. Visible for all
          modes — the product now requires visible multi-chain here. */}
      <div className="flex items-center justify-between mb-3">
        <NetworkSwitcher />
        <span className="text-[13px] font-bold text-harbor">
          {live.loading ? (
            <span className="text-slate">Checking balance…</span>
          ) : (
            <>
              {balDisplay}
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
              {balDisplay}
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
          {recipient.receiveCurrency && recipient.receiveCurrency !== sendCurrency && (
            <div className="mt-2 text-[12.5px] font-semibold text-white/70">
              1 {sendCurrency} ={" "}
              {formatMoney(
                quote?.midRate ?? midMarketRate(sendCurrency, recipient.receiveCurrency),
                recipient.receiveCurrency,
              )}
              {quote?.live && <span className="ml-1 text-sky-tint font-bold">· live</span>}
            </div>
          )}
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
      {isWallet ? (
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate mb-2.5">
            Sending to
          </p>
          <div className="flex items-center gap-3 rounded-[18px] border border-fog bg-snow p-3.5">
            <span className="w-9 h-9 rounded-full bg-sky-tint flex items-center justify-center text-[18px]">
              {recipient.flag}
            </span>
            <div className="min-w-0">
              <div className="font-bold text-harbor text-[15px] truncate">
                {amount > 0 ? `${amount} ${sendToken ?? "USDC"} ` : ""}on {walletChainLabel ?? "chain"}
              </div>
              <AddressText
                address={recipient.handle}
                className="block text-[12.5px] font-medium text-slate font-mono truncate"
              />
            </div>
          </div>

          {/* Token to send — a same-chain wallet send can move any stablecoin you
              hold; a cross-chain send is USDC only, so the picker hides then. */}
          {walletIsEvm && setSendToken && !destChainKey && (sendTokenOptions?.length ?? 0) > 0 && (
            <div className="mt-2.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
                Token
              </label>
              <Dropdown
                value={sendToken ?? "USDC"}
                onChange={setSendToken}
                ariaLabel="Token to send"
                options={sendTokenOptions ?? []}
              />
            </div>
          )}

          {/* Destination chain. Same chain = a direct transfer; a different chain
              moves USDC straight to this address. */}
          {walletIsEvm && setDestChainKey && (destChainOptions?.length ?? 0) > 0 && (
            <div className="mt-2.5">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">
                Deliver on
              </label>
              <Dropdown
                value={destChainKey ?? ""}
                onChange={setDestChainKey}
                ariaLabel="Destination chain"
                options={[
                  {
                    value: "",
                    label: `${sourceChainLabel ?? "This chain"} (same chain)`,
                    icon: sourceChainLabel ? chainLogoUrlForLabel(sourceChainLabel) : undefined,
                  },
                  ...(destChainOptions ?? []).map((c) => ({
                    value: c.key,
                    label: c.label,
                    icon: chainLogoUrlForLabel(c.label),
                  })),
                ]}
              />
              {destChainKey ? (
                <p className="mt-1.5 text-[12px] font-medium text-slate">
                  Moves cross-chain — arrives on {walletChainLabel}.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : bankLocked ? (
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
