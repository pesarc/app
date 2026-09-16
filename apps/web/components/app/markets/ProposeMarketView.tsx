"use client";

// Propose a prediction market — binary (Yes/No) or multiple-choice — and seed
// it with an initial bond. Community-proposed markets are store-backed and show
// on the board flagged "Community"; the private admin can curate them. Funding
// records the seed bond (demo pattern) — a production deployment posts it
// on-chain when the market is promoted.

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, X, Check, Loader2, Users, ExternalLink } from "lucide-react";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";

type Kind = "fx" | "macro" | "sports" | "politics";
type Collateral = "cNGN" | "cKES" | "cGHS";

const KINDS: { value: Kind; label: string }[] = [
  { value: "fx", label: "FX" },
  { value: "macro", label: "Macro" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
];

const COLLATERALS: { value: Collateral; flag: string }[] = [
  { value: "cNGN", flag: "🇳🇬" },
  { value: "cKES", flag: "🇰🇪" },
  { value: "cGHS", flag: "🇬🇭" },
];

export default function ProposeMarketView() {
  const { alias, address } = useWallet();
  const { chainKey } = useActiveEvmChain();

  const [type, setType] = useState<"binary" | "multi">("binary");
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState<string[]>(["", ""]);
  const [kind, setKind] = useState<Kind>("fx");
  const [collateral, setCollateral] = useState<Collateral>("cNGN");
  const [flag, setFlag] = useState("");
  const [closes, setCloses] = useState("");
  const [resolves, setResolves] = useState("");
  const [bond, setBond] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [txUrl, setTxUrl] = useState<string | null>(null);

  const cleanOutcomes = outcomes.map((o) => o.trim()).filter(Boolean);
  const validMulti =
    type === "binary" ||
    (cleanOutcomes.length >= 2 &&
      new Set(cleanOutcomes.map((o) => o.toLowerCase())).size === cleanOutcomes.length);
  const valid = question.trim().length >= 8 && validMulti;

  const setOutcome = (i: number, v: string) =>
    setOutcomes((prev) => prev.map((o, j) => (j === i ? v : o)));
  const addOutcome = () => setOutcomes((prev) => (prev.length >= 8 ? prev : [...prev, ""]));
  const removeOutcome = (i: number) =>
    setOutcomes((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/markets/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          type,
          outcomes: type === "multi" ? cleanOutcomes : undefined,
          kind,
          collateral,
          flag: flag.trim() || undefined,
          closes: closes.trim() || undefined,
          resolves: resolves.trim() || undefined,
          bond: Number(bond) || 0,
          bondCoin: collateral,
          proposer: alias || address || "community",
          chainKey,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Could not submit — try again.");
      } else {
        setTxUrl(j.onChain?.txUrl ?? null);
        setDone(true);
      }
    } catch {
      setError("Could not reach the network — try again.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-16 text-center">
        <span className="inline-flex w-14 h-14 rounded-full bg-sky-tint/60 items-center justify-center text-sky-deep mb-4">
          <Check className="w-7 h-7" />
        </span>
        <h1 className="text-[22px] font-extrabold text-harbor tracking-tight mb-1.5">
          Market proposed
        </h1>
        <p className="text-sm font-medium text-slate mb-4 max-w-xs mx-auto">
          {txUrl
            ? "It's live on the board — and created on-chain. You can propose another or take a position."
            : "It's live on the board with a Community badge. You can propose another or take a position."}
        </p>
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill bg-sky-tint/50 text-sky-deep text-[13px] font-bold px-4 py-2 mb-6 hover:bg-sky-tint transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> View creation tx on-chain
          </a>
        )}
        <div className="flex flex-col gap-2.5">
          <Link
            href="/markets"
            className="w-full rounded-pill bg-sky text-white font-bold py-3 shadow-pop-sm"
          >
            View on Markets
          </Link>
          <button
            onClick={() => {
              setDone(false);
              setTxUrl(null);
              setQuestion("");
              setOutcomes(["", ""]);
              setBond("");
            }}
            className="w-full rounded-pill bg-snow border border-fog text-harbor font-bold py-3"
          >
            Propose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 sm:px-6 py-6 md:py-10">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate hover:text-harbor mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Markets
      </Link>

      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-[27px] font-extrabold text-harbor tracking-tight">Propose a market</h1>
      </div>
      <p className="text-sm font-medium text-slate mb-6 leading-relaxed">
        Create a prediction market — Yes/No or multiple-choice — and seed it with a bond. Settled
        in local currency, no dollar in the path.
      </p>

      {/* Type */}
      <Field label="Type">
        <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1">
          {(["binary", "multi"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                t === type ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
              }`}
            >
              {t === "binary" ? "Yes / No" : "Multiple choice"}
            </button>
          ))}
        </div>
      </Field>

      {/* Question */}
      <Field label="Question">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder={
            type === "binary"
              ? "e.g. Will USD/NGN close above ₦1,700 on Mar 31?"
              : "e.g. Who wins the 2027 Nigerian presidential election?"
          }
          className="w-full rounded-field border border-fog bg-snow px-4 py-3 text-[15px] text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky resize-none"
        />
      </Field>

      {/* Outcomes (multi only) */}
      {type === "multi" && (
        <Field label="Outcomes (2–8)">
          <div className="space-y-2">
            {outcomes.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={o}
                  onChange={(e) => setOutcome(i, e.target.value)}
                  placeholder={`Outcome ${i + 1}`}
                  className="flex-1 rounded-field border border-fog bg-snow px-4 py-2.5 text-[15px] text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky"
                />
                <button
                  onClick={() => removeOutcome(i)}
                  disabled={outcomes.length <= 2}
                  aria-label="Remove outcome"
                  className="w-9 h-9 shrink-0 rounded-full bg-snow border border-fog flex items-center justify-center text-slate hover:text-alert disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {outcomes.length < 8 && (
              <button
                onClick={addOutcome}
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-deep hover:underline"
              >
                <Plus className="w-4 h-4" /> Add outcome
              </button>
            )}
          </div>
        </Field>
      )}

      {/* Category */}
      <Field label="Category">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Pill key={k.value} active={k.value === kind} onClick={() => setKind(k.value)}>
              {k.label}
            </Pill>
          ))}
        </div>
      </Field>

      {/* Collateral */}
      <Field label="Settlement currency">
        <div className="flex flex-wrap gap-2">
          {COLLATERALS.map((c) => (
            <Pill
              key={c.value}
              active={c.value === collateral}
              onClick={() => setCollateral(c.value)}
            >
              {c.flag} {c.value}
            </Pill>
          ))}
        </div>
      </Field>

      {/* Dates + flag */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Closes">
          <input
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
            placeholder="e.g. Mar 28"
            className="w-full rounded-field border border-fog bg-snow px-4 py-2.5 text-[15px] text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky"
          />
        </Field>
        <Field label="Resolves">
          <input
            value={resolves}
            onChange={(e) => setResolves(e.target.value)}
            placeholder="e.g. Mar 31"
            className="w-full rounded-field border border-fog bg-snow px-4 py-2.5 text-[15px] text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky"
          />
        </Field>
      </div>

      <Field label="Icon (emoji, optional)">
        <input
          value={flag}
          onChange={(e) => setFlag(e.target.value.slice(0, 4))}
          placeholder="🌍"
          className="w-24 rounded-field border border-fog bg-snow px-4 py-2.5 text-[18px] text-ink focus:outline-none focus:border-sky"
        />
      </Field>

      {/* Bond */}
      <Field label={`Seed bond (${collateral})`}>
        <div className="flex items-center rounded-field border border-fog bg-snow px-4">
          <span className="text-slate text-sm mr-2">{collateral}</span>
          <input
            value={bond}
            onChange={(e) => setBond(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0"
            className="flex-1 bg-transparent py-2.5 text-[15px] text-ink numerals focus:outline-none"
          />
        </div>
        <p className="text-[12px] text-slate mt-2 leading-snug">
          Seeds the market&apos;s pools so odds start balanced. Demo — a production deployment posts
          this bond on-chain when the market is promoted.
        </p>
      </Field>

      {error && (
        <div className="rounded-2xl bg-alert/10 text-alert text-[13px] font-semibold px-4 py-3 mb-3">
          {error}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={submit}
        disabled={!valid || busy}
        className="w-full flex items-center justify-center gap-2 rounded-btn bg-sky text-white py-4 text-base font-extrabold shadow-pop hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:translate-y-0"
      >
        {busy ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" /> Proposing…
          </>
        ) : (
          <>
            <Users className="w-5 h-5" /> Propose market
          </>
        )}
      </motion.button>
      {!valid && question.trim().length > 0 && (
        <p className="text-center text-[12px] text-slate mt-2">
          {question.trim().length < 8
            ? "Make the question a little longer."
            : "Add at least two distinct outcomes."}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold uppercase tracking-widest text-slate mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors ${
        active ? "bg-harbor text-white" : "bg-snow border border-fog text-slate hover:text-harbor"
      }`}
    >
      {children}
    </button>
  );
}
