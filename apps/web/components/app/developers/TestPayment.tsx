"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "@/components/icons";
import { Button, Card, Select } from "@/components/app/ui";

export function TestPayment({ origin, secret }: { origin: string; secret?: string }) {
  const [key, setKey] = useState("");
  const [amount, setAmount] = useState("1000");
  const [currency, setCurrency] = useState("NGN");
  const [redirect, setRedirect] = useState("https://example.com/return");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ checkout_url?: string; error?: string } | null>(null);

  useEffect(() => {
    if (secret) setKey(secret);
  }, [secret]);

  const run = async () => {
    const sk = key.trim();
    if (!sk || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sk}` },
        body: JSON.stringify({
          amount: Number(amount) || 0,
          currency,
          redirect_url: redirect,
          merchant_name: "Test merchant",
          description: "Test payment",
        }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error?.message ?? "Request failed." });
      else setResult({ checkout_url: data.checkout_url });
    } catch {
      setResult({ error: "Network error." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-ink mb-3">Try a live payment</h2>
      <Card className="p-5">
        <p className="text-sm text-slate mb-4">
          Create a real payment session with a secret key and open the checkout your
          customers would see.
        </p>
        <div className="space-y-3">
          <Field label="Secret key">
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk_live_…"
              className="w-full bg-white rounded-field border border-fog px-3 py-2.5 text-sm font-mono text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                className="w-full bg-white rounded-field border border-fog px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-sky/60"
              />
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["NGN", "USD", "KES", "GHS", "ZAR"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Redirect URL">
            <input
              value={redirect}
              onChange={(e) => setRedirect(e.target.value)}
              placeholder="https://your-site.com/return"
              className="w-full bg-white rounded-field border border-fog px-3 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60"
            />
          </Field>
        </div>
        <Button block className="mt-4" onClick={run} disabled={!key.trim() || busy}>
          {busy ? "Creating…" : "Create test payment"}
        </Button>

        {result?.error && (
          <p className="mt-3 text-sm text-alert font-medium">{result.error}</p>
        )}
        {result?.checkout_url && (
          <div className="mt-4 rounded-field bg-sky-tint/40 border border-sky/20 p-3">
            <div className="text-[11px] font-semibold text-slate uppercase tracking-widest mb-1">
              Checkout URL
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-xs font-mono text-ink">
                {result.checkout_url}
              </code>
              <a href={result.checkout_url} target="_blank" rel="noreferrer">
                <Button size="md">
                  Open <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
