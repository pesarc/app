"use client";

// Pay a bill: airtime, data, or electricity. A calm, tap-first flow (Mum Test):
// pick what you are paying, who provides it, the amount or plan, the number,
// then pay. Money-first, gasless, no jargon.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Smartphone,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import type { BillCategory, DataPlan, MeterType, Operator } from "@pesarc/sdk/bills";
import { Button, Card, Segmented } from "@/components/app/ui";

const CATEGORIES: { id: BillCategory; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "airtime", label: "Airtime", hint: "Top up any phone", icon: Smartphone },
  { id: "data", label: "Data", hint: "Buy a data bundle", icon: Wifi },
  { id: "electricity", label: "Electricity", hint: "Pay a power bill", icon: Zap },
];

const AIRTIME_PRESETS = [100, 200, 500, 1000, 2000, 5000];

type Result = {
  reference: string;
  amount: number;
  currency: string;
  token?: string;
  units?: string;
};

function naira(n: number): string {
  return `₦${n.toLocaleString()}`;
}

export default function BillsFlow() {
  const [category, setCategory] = useState<BillCategory | null>(null);
  const [done, setDone] = useState<Result | null>(null);

  if (done && category) {
    return (
      <Done
        category={category}
        result={done}
        onAgain={() => {
          setDone(null);
          setCategory(null);
        }}
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">Pay a bill</h1>
      <p className="text-slate mb-7">
        Airtime, data, and electricity in a couple of taps. Gasless, settled in
        seconds. Or just ask the agent to do it.
      </p>

      {!category ? (
        <div className="grid gap-3">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className="text-left">
              <Card className="p-5 flex items-center gap-4 hover:border-sky/40 hover:shadow-pop-sm transition">
                <span className="w-12 h-12 rounded-2xl bg-sky-tint flex items-center justify-center text-sky shrink-0">
                  <c.icon className="w-6 h-6" strokeWidth={1.75} />
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-ink text-lg">{c.label}</div>
                  <div className="text-sm text-slate">{c.hint}</div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : (
        <PurchaseForm
          category={category}
          onBack={() => setCategory(null)}
          onDone={setDone}
        />
      )}
    </div>
  );
}

function PurchaseForm({
  category,
  onBack,
  onDone,
}: {
  category: BillCategory;
  onBack: () => void;
  onDone: (r: Result) => void;
}) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [customer, setCustomer] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [meterType, setMeterType] = useState<MeterType>("prepaid");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Load operators for the category.
  useEffect(() => {
    let ok = true;
    authedFetch(`/api/bills?category=${category}`)
      .then((r) => r.json())
      .then((d) => {
        if (ok && d.ok) setOperators(d.operators);
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [category]);

  // Load data plans when an operator is picked.
  useEffect(() => {
    if (category !== "data" || !operatorId) {
      setPlans([]);
      return;
    }
    let ok = true;
    authedFetch(`/api/bills?category=data&operatorId=${operatorId}`)
      .then((r) => r.json())
      .then((d) => {
        if (ok && d.ok) setPlans(d.plans);
      })
      .catch(() => {});
    return () => {
      ok = false;
    };
  }, [category, operatorId]);

  const amount = useMemo(() => {
    if (category === "data") return plans.find((p) => p.id === planId)?.amount ?? 0;
    return parseFloat(amountStr) || 0;
  }, [category, plans, planId, amountStr]);

  const customerLabel = category === "electricity" ? "Meter number" : "Phone number";
  const valid = Boolean(operatorId) && customer.trim().length >= 3 && amount > 0;

  const pay = useCallback(async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await authedPostJson("/api/bills", {
        category,
        operatorId,
        customer: customer.trim(),
        amount: category === "data" ? undefined : amount,
        planId: category === "data" ? planId : undefined,
        meterType: category === "electricity" ? meterType : undefined,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not complete the purchase.");
        return;
      }
      onDone(data.result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [valid, busy, category, operatorId, customer, amount, planId, meterType, onDone]);

  return (
    <div className="animate-step-in">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-ink transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> All bills
      </button>

      {/* Operator */}
      <Section label="Provider">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {operators.map((op) => {
            const active = op.id === operatorId;
            return (
              <button
                key={op.id}
                onClick={() => {
                  setOperatorId(op.id);
                  setPlanId("");
                }}
                className={`rounded-field border px-3 py-3 text-sm font-semibold transition flex items-center gap-2 ${
                  active
                    ? "border-sky bg-sky-tint/50 text-ink"
                    : "border-fog bg-snow text-ink/80 hover:border-slate/40"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: op.color }} />
                {op.name}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Customer number */}
      <Section label={customerLabel}>
        <input
          value={customer}
          onChange={(e) => setCustomer(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder={category === "electricity" ? "e.g. 04123456789" : "e.g. 08031234567"}
          className="w-full bg-snow rounded-field border border-fog px-4 py-3 text-base text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60 shadow-card-flat"
        />
      </Section>

      {/* Electricity meter type */}
      {category === "electricity" && (
        <Section label="Meter type">
          <Segmented
            options={[
              { value: "prepaid", label: "Prepaid" },
              { value: "postpaid", label: "Postpaid" },
            ]}
            value={meterType}
            onChange={setMeterType}
            aria-label="Meter type"
          />
        </Section>
      )}

      {/* Amount or plan */}
      {category === "data" ? (
        <Section label="Bundle">
          {!operatorId ? (
            <p className="text-sm text-slate">Pick a provider to see bundles.</p>
          ) : (
            <div className="grid gap-2">
              {plans.map((p) => {
                const active = p.id === planId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPlanId(p.id)}
                    className={`flex items-center justify-between rounded-field border px-4 py-3 transition ${
                      active ? "border-sky bg-sky-tint/50" : "border-fog bg-snow hover:border-slate/40"
                    }`}
                  >
                    <span className="font-semibold text-ink">{p.label}</span>
                    <span className="font-semibold text-sky numerals">{naira(p.amount)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      ) : (
        <Section label="Amount">
          <div className="grid grid-cols-3 gap-2 mb-2">
            {AIRTIME_PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => setAmountStr(String(v))}
                className={`rounded-field border py-2.5 text-sm font-semibold transition ${
                  amountStr === String(v)
                    ? "border-sky bg-sky-tint/50 text-ink"
                    : "border-fog bg-snow text-ink/80 hover:border-slate/40"
                }`}
              >
                {naira(v)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-snow rounded-field border border-fog px-4 py-3 shadow-card-flat">
            <span className="text-lg font-semibold text-ink/50">₦</span>
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              placeholder="Other amount"
              className="flex-1 bg-transparent text-base font-semibold text-ink outline-none numerals placeholder:text-slate/50"
            />
          </div>
        </Section>
      )}

      {error && <p className="text-sm text-alert font-medium mb-3">{error}</p>}

      <Button size="lg" block disabled={!valid || busy} onClick={pay}>
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Paying…
          </>
        ) : (
          <>Pay {amount > 0 ? naira(amount) : ""}</>
        )}
      </Button>
      <p className="mt-3 text-center text-xs text-slate">Gasless · settles in seconds</p>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

function Done({
  category,
  result,
  onAgain,
}: {
  category: BillCategory;
  result: Result;
  onAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyToken = () => {
    if (!result.token) return;
    navigator.clipboard.writeText(result.token.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10 text-center animate-step-in">
      <div className="mx-auto w-16 h-16 rounded-full bg-sky flex items-center justify-center mb-5 shadow-pop-sm">
        <Check className="w-8 h-8 text-white" strokeWidth={2.5} />
      </div>
      <h2 className="text-2xl font-semibold text-ink mb-1">Paid {naira(result.amount)}</h2>
      <p className="text-slate mb-6">
        {category === "airtime"
          ? "Airtime is on its way."
          : category === "data"
            ? "Your data bundle is active."
            : "Your electricity payment is complete."}
      </p>

      <Card className="p-5 text-left mb-5 space-y-0">
        <Row label="Reference">
          <span className="font-mono text-sm">{result.reference}</span>
        </Row>
        {result.units && <Row label="Credited">{result.units}</Row>}
        {result.token && (
          <Row label="Token">
            <button onClick={copyToken} className="inline-flex items-center gap-2 text-sky font-semibold">
              <span className="font-mono text-sm">{result.token}</span>
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </Row>
        )}
      </Card>

      <Button block onClick={onAgain}>
        Pay another bill
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[15px] border-b border-black/[0.06] last:border-0">
      <span className="text-slate">{label}</span>
      <span className="font-medium text-ink">{children}</span>
    </div>
  );
}
