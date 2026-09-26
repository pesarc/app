"use client";

// Developer dashboard: create and revoke API keys, read the quickstart, and fire
// a real test payment to see the OPay-style hosted checkout + redirect.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import { Button, Card, Select } from "@/components/app/ui";

type KeyRow = {
  id: string;
  label: string;
  publishable: string;
  secretPrefix: string;
  signingSecret: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};
type CreatedKey = KeyRow & { secret: string };

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    });
  }, []);
  return { copied, copy };
}

export default function DevelopersView() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedKey | null>(null);
  const { copied, copy } = useCopy();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.pesarc.xyz";

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/keys");
      const data = await res.json();
      if (data.ok) setKeys(data.keys);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    if (!label.trim() || creating) return;
    setCreating(true);
    try {
      const res = await authedPostJson("/api/keys", { label: label.trim() });
      const data = await res.json();
      if (data.ok) {
        setJustCreated(data.key);
        setLabel("");
        load();
      }
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await authedFetch(`/api/keys/${id}`, { method: "DELETE" });
    setKeys((ks) => ks.filter((k) => k.id !== id));
  };

  const active = keys.filter((k) => !k.revokedAt);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="flex items-center gap-3 mb-1.5">
        <span className="w-9 h-9 rounded-xl bg-sky-tint text-sky flex items-center justify-center shrink-0">
          <Terminal className="w-5 h-5" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Developers</h1>
      </div>
      <p className="text-slate mb-8 max-w-xl">
        Accept payments from your own app or site. Create a key, call the API to
        start a payment, and send your customer to a Pesarc checkout that brings
        them back to you when it is done.
      </p>

      {/* One-time secret reveal */}
      {justCreated && (
        <RevealCard
          created={justCreated}
          onClose={() => setJustCreated(null)}
          copy={copy}
          copied={copied}
        />
      )}

      {/* Keys */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-ink mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-slate" /> API keys
        </h2>

        <Card className="p-4 mb-4">
          <label className="block text-xs font-semibold text-slate uppercase tracking-widest mb-2">
            Create a key
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createKey()}
              placeholder="e.g. Live checkout, Staging"
              className="flex-1 bg-white rounded-field border border-fog px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60"
            />
            <Button onClick={createKey} disabled={!label.trim() || creating}>
              <Plus className="w-4 h-4" /> {creating ? "Creating…" : "Create key"}
            </Button>
          </div>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-slate">Loading keys…</Card>
        ) : active.length === 0 ? (
          <Card className="p-6 text-sm text-slate text-center">
            No keys yet. Create one to start accepting payments.
          </Card>
        ) : (
          <div className="space-y-2">
            {active.map((k) => (
              <Card key={k.id} className="p-4 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-sky-tint text-sky flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-ink truncate">{k.label}</div>
                  <div className="font-mono text-xs text-slate truncate">
                    {k.publishable} · {k.secretPrefix}…
                  </div>
                </div>
                <button
                  onClick={() => revoke(k.id)}
                  className="text-slate hover:text-alert transition p-2 rounded-lg hover:bg-alert/5 shrink-0"
                  aria-label={`Revoke ${k.label}`}
                  title="Revoke key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Test payment */}
      <TestPayment origin={origin} secret={justCreated?.secret} />

      {/* Quickstart */}
      <Quickstart origin={origin} copy={copy} copied={copied} />
    </div>
  );
}

function RevealCard({
  created,
  onClose,
  copy,
  copied,
}: {
  created: CreatedKey;
  onClose: () => void;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <Card className="p-5 mb-6 border border-sky/30 bg-sky-tint/30">
      <div className="flex items-start gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-sky shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-ink">Save your secret key now</div>
          <div className="text-sm text-slate">
            This is the only time we show it. Store it somewhere safe on your server.
          </div>
        </div>
      </div>
      <RevealRow label="Secret key" value={created.secret} id="sk" copy={copy} copied={copied} />
      <RevealRow label="Publishable id" value={created.publishable} id="pk" copy={copy} copied={copied} />
      <RevealRow label="Signing secret" value={created.signingSecret} id="wh" copy={copy} copied={copied} />
      <p className="text-xs text-slate mt-3">
        Use the <span className="font-semibold">signing secret</span> to verify the
        signature on redirects and webhooks.
      </p>
      <Button variant="secondary" className="mt-4" onClick={onClose}>
        <Check className="w-4 h-4" /> I have saved it
      </Button>
    </Card>
  );
}

function RevealRow({
  label,
  value,
  id,
  copy,
  copied,
}: {
  label: string;
  value: string;
  id: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="mb-2">
      <div className="text-[11px] font-semibold text-slate uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-fog px-3 py-2 text-xs font-mono text-ink">
          {value}
        </code>
        <button
          onClick={() => copy(value, id)}
          className="shrink-0 p-2 rounded-lg border border-fog bg-white text-slate hover:text-ink transition"
          aria-label={`Copy ${label}`}
        >
          {copied === id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function TestPayment({ origin, secret }: { origin: string; secret?: string }) {
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

function Quickstart({
  origin,
  copy,
  copied,
}: {
  origin: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  const curl = useMemo(
    () =>
      `curl ${origin}/api/v1/payments \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "NGN",
    "redirect_url": "https://your-site.com/return",
    "reference": "order_1234"
  }'`,
    [origin],
  );

  const verify = `import { createHmac } from "node:crypto";

// On your /return handler, verify the redirect signature:
function verify({ paymentId, reference, status, signature }, signingSecret) {
  const expected = createHmac("sha256", signingSecret)
    .update(\`\${paymentId}.\${reference}.\${status}\`)
    .digest("hex");
  return expected === signature; // status === "paid" => fulfil the order
}`;

  return (
    <section>
      <h2 className="text-lg font-semibold text-ink mb-3">Quickstart</h2>
      <ol className="space-y-2 mb-4 text-sm text-slate list-decimal list-inside">
        <li>Create a key above and store the secret on your server.</li>
        <li>
          Call <code className="text-ink font-mono text-xs">POST /api/v1/payments</code> to
          start a payment. You get a <code className="text-ink font-mono text-xs">checkout_url</code>.
        </li>
        <li>Redirect your customer to that URL. They pay inside Pesarc.</li>
        <li>
          We send them back to your <code className="text-ink font-mono text-xs">redirect_url</code>{" "}
          with <code className="text-ink font-mono text-xs">?paymentId&amp;reference&amp;status&amp;signature</code>.
        </li>
        <li>Verify the signature with your signing secret, then fulfil the order.</li>
      </ol>

      <CodeBlock title="Create a payment" code={curl} id="curl" copy={copy} copied={copied} />
      <CodeBlock title="Verify the redirect (Node)" code={verify} id="verify" copy={copy} copied={copied} />
    </section>
  );
}

function CodeBlock({
  title,
  code,
  id,
  copy,
  copied,
}: {
  title: string;
  code: string;
  id: string;
  copy: (t: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate uppercase tracking-widest">{title}</span>
        <button
          onClick={() => copy(code, id)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate hover:text-ink transition"
        >
          {copied === id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          Copy
        </button>
      </div>
      <pre className="rounded-card bg-harbor text-white/90 text-xs font-mono p-4 overflow-x-auto leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
