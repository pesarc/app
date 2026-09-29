"use client";

// Developer dashboard container: create/revoke API keys, restrict source IPs,
// read the quickstart, and fire a real test payment. Sub-views live in sibling
// files (RevealCard, AllowedIps, TestPayment, Quickstart) to keep this thin.

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Terminal } from "@/components/icons";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import { Button, Card } from "@/components/app/ui";
import type { KeyRow, CreatedKey } from "./types";
import { useCopy } from "./useCopy";
import { RevealCard } from "./RevealCard";
import { AllowedIps } from "./AllowedIps";
import { TestPayment } from "./TestPayment";
import { Quickstart } from "./Quickstart";

export default function DevelopersView() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreatedKey | null>(null);
  const [usageToday, setUsageToday] = useState<number | null>(null);
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
    authedFetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setUsageToday(d.today);
      })
      .catch(() => {});
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate" /> API keys
          </h2>
          {usageToday !== null && (
            <span className="text-xs font-medium text-slate">
              {usageToday.toLocaleString()} request{usageToday === 1 ? "" : "s"} today
            </span>
          )}
        </div>

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

      {/* Allowed IPs */}
      <AllowedIps />

      {/* Test payment */}
      <TestPayment origin={origin} secret={justCreated?.secret} />

      {/* Quickstart */}
      <Quickstart origin={origin} copy={copy} copied={copied} />
    </div>
  );
}
