"use client";

// Self-custody Algorand wallet, created the MetaMask way: we generate the account
// in the browser, show the 25-word recovery phrase once, make the user confirm
// they saved it, then keep ONLY the public address. The phrase is never sent to
// Pesarc and is wiped from memory the moment the wallet is confirmed — the user
// alone owns it. Consent is explicit before anything is generated.

import { useMemo, useState } from "react";
import { Card, Button } from "@/components/app/ui";
import { Copy, Check, Shield, AlertCircle, Wallet, X } from "@/components/icons";
import { usePrefs } from "@pesarc/sdk/prefs";
import { createAlgorandAccount, mnemonicMatches } from "@pesarc/sdk/algorand/wallet";
import { AddressText } from "@/components/app/AddressText";

type Step = "consent" | "reveal" | "confirm" | "done";

// Three distinct 1-based word positions to quiz on, so we know the phrase was
// actually written down (not just skipped past).
function pickPositions(): number[] {
  const set = new Set<number>();
  while (set.size < 3) set.add(1 + Math.floor(Math.random() * 25));
  return [...set].sort((a, b) => a - b);
}

export default function AlgorandWallet() {
  const { algoAddress, setAlgoAddress } = usePrefs();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("consent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Held in component memory only, never persisted or sent anywhere.
  const [mnemonic, setMnemonic] = useState("");
  const [address, setAddress] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [positions] = useState(pickPositions);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  const words = useMemo(() => (mnemonic ? mnemonic.split(/\s+/) : []), [mnemonic]);

  const reset = () => {
    setMnemonic("");
    setAddress("");
    setRevealed(false);
    setSaved(false);
    setAnswers({});
    setError("");
    setStep("consent");
  };
  const close = () => {
    reset();
    setOpen(false);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const w = await createAlgorandAccount();
      setMnemonic(w.mnemonic);
      setAddress(w.address);
      setStep("reveal");
    } catch {
      setError("Could not create the wallet. Please try again.");
    }
    setBusy(false);
  };

  const copyPhrase = async () => {
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the user can still read the words */
    }
  };

  const confirmSaved = async () => {
    setError("");
    const ok = positions.every(
      (p) => (answers[p] ?? "").trim().toLowerCase() === words[p - 1]?.toLowerCase(),
    );
    if (!ok) {
      setError("Those words don't match your phrase. Check your backup and try again.");
      return;
    }
    setBusy(true);
    // Belt-and-braces: the phrase must still recover the address before we commit.
    const valid = await mnemonicMatches(mnemonic, address);
    setBusy(false);
    if (!valid) {
      setError("Something went wrong verifying your phrase. Please start over.");
      return;
    }
    // Keep only the public address; wipe the secret from memory.
    setAlgoAddress(address);
    setMnemonic("");
    setAnswers({});
    setStep("done");
  };

  // Already has a wallet — show it, no secret in sight.
  if (algoAddress && !open) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-sky-tint/50 text-sky-deep flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-harbor">Your Algorand wallet</div>
            <div className="text-[13px] text-slate">
              <AddressText address={algoAddress} />
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate/70">
          You own this wallet. Pesarc never had and never stores your recovery phrase.
        </p>
      </Card>
    );
  }

  if (!open) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-sky-tint/50 text-sky-deep flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-harbor">Algorand wallet</div>
            <div className="text-[13px] text-slate">Create a self-custody wallet you fully own.</div>
          </div>
          <Button onClick={() => setOpen(true)}>Create</Button>
        </div>
      </Card>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6"
      onClick={step === "done" ? close : undefined}
    >
      <div
        className="w-full max-w-md rounded-card bg-snow p-5 shadow-pop max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[16px] font-extrabold text-harbor">
            {step === "consent" && "Create an Algorand wallet"}
            {step === "reveal" && "Your recovery phrase"}
            {step === "confirm" && "Confirm your phrase"}
            {step === "done" && "Wallet ready"}
          </div>
          <button onClick={close} aria-label="Close" className="text-slate hover:text-ink p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "consent" && (
          <div>
            <div className="flex gap-2.5 rounded-xl bg-sky-tint/25 p-3 mb-3">
              <Shield className="w-5 h-5 text-sky-deep shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate">
                We create this wallet on your device. You get a secret 25-word recovery phrase
                that is the only way to access it.
              </p>
            </div>
            <ul className="text-[13px] text-slate space-y-1.5 mb-4 list-disc pl-5">
              <li>Pesarc never sees or stores your recovery phrase.</li>
              <li>Anyone with the phrase controls the wallet, so keep it private.</li>
              <li>If you lose it, no one, including us, can recover the wallet.</li>
            </ul>
            <Button block onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create wallet"}
            </Button>
            <button onClick={close} className="w-full text-center text-[13px] text-slate mt-2 py-1.5">
              Cancel
            </button>
            {error && <p className="text-center text-[13px] text-alert mt-2">{error}</p>}
          </div>
        )}

        {step === "reveal" && (
          <div>
            <div className="flex gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate">
                Write these 25 words down in order and keep them somewhere safe and private. This
                is the last time they are shown.
              </p>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {words.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-lg bg-black/[0.03] px-2.5 py-1.5 text-[13px]"
                  >
                    <span className="text-slate/60 tabular-nums w-5 text-right">{i + 1}</span>
                    <span className="font-semibold text-ink">{w}</span>
                  </div>
                ))}
              </div>
              {!revealed && (
                <button
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 rounded-xl bg-snow/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1 text-sky-deep font-bold"
                >
                  <Shield className="w-6 h-6" />
                  Tap to reveal
                </button>
              )}
            </div>
            <button
              onClick={copyPhrase}
              className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-sky-deep"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy phrase"}
            </button>
            <label className="flex items-start gap-2 mt-4 text-[13px] text-slate">
              <input
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="mt-0.5"
              />
              I have written down my recovery phrase and understand Pesarc cannot recover it.
            </label>
            <Button block className="mt-3" disabled={!saved || !revealed} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </div>
        )}

        {step === "confirm" && (
          <div>
            <p className="text-[13px] text-slate mb-3">
              Enter these words from your recovery phrase to confirm you saved it.
            </p>
            <div className="space-y-2.5">
              {positions.map((p) => (
                <label key={p} className="block">
                  <span className="text-[12px] font-bold text-slate">Word #{p}</span>
                  <input
                    value={answers[p] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [p]: e.target.value }))}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mt-1 w-full rounded-xl border border-fog bg-snow px-3 py-2 text-sm font-semibold text-ink"
                  />
                </label>
              ))}
            </div>
            {error && <p className="text-[13px] text-alert mt-2">{error}</p>}
            <Button block className="mt-4" disabled={busy} onClick={confirmSaved}>
              {busy ? "Confirming…" : "Confirm and finish"}
            </Button>
            <button
              onClick={() => {
                setError("");
                setStep("reveal");
              }}
              className="w-full text-center text-[13px] text-slate mt-2 py-1.5"
            >
              Show my phrase again
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <span className="inline-flex w-14 h-14 rounded-full bg-sky-tint/60 items-center justify-center text-sky-deep mb-3">
              <Check className="w-7 h-7" />
            </span>
            <p className="text-[15px] font-bold text-harbor">Your wallet is ready</p>
            <p className="text-[13px] text-slate mt-1">You fully own it. Here is your address:</p>
            <div className="mt-2 text-[13px] break-all">
              <AddressText address={address || algoAddress || ""} />
            </div>
            <Button block className="mt-5" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
