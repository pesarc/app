"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Progress } from "./shared";
import { useSendState } from "./useSendState";
import { RecipientStep } from "./steps/RecipientStep";
import { AmountStep } from "./steps/AmountStep";
import { ConfirmStep } from "./steps/ConfirmStep";
import { SettlingStep } from "./steps/SettlingStep";
import { SuccessStep } from "./steps/SuccessStep";

export default function SendFlow() {
  const {
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
    setRecipientAddress,
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
    walletChainLabel,
  } = useSendState();

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
              setRecipientAddress(opts?.address);
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
            walletChainLabel={walletChainLabel}
            onBack={() => setStep("recipient")}
            onNext={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && recipient && quote && (
          <ConfirmStep
            recipient={recipient}
            quote={quote}
            advanced={isAdvanced}
            walletChainLabel={walletChainLabel}
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
            onCancel={() => setStep("confirm")}
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
