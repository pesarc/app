"use client";

// Per-account API IP allowlist. Opt-in: while empty, the API accepts any IP;
// add an entry and only listed IPs/CIDRs may use the account's keys.

import { useCallback, useEffect, useState } from "react";
import { Globe, Plus, Trash2 } from "@/components/icons";
import { authedFetch, authedPostJson } from "@pesarc/sdk/api/client";
import { Button, Card } from "@/components/app/ui";

type IpRow = { id: string; cidr: string; label: string; createdAt: string };

export function AllowedIps() {
  const [ips, setIps] = useState<IpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/keys/allowlist");
      const data = await res.json();
      if (data.ok) setIps(data.ips);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!cidr.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      const res = await authedPostJson("/api/keys/allowlist", {
        cidr: cidr.trim(),
        label: label.trim() || undefined,
      });
      const data = await res.json();
      if (data.ok) {
        setCidr("");
        setLabel("");
        load();
      } else {
        setError(data.error ?? "Could not add that address.");
      }
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    await authedFetch(`/api/keys/allowlist/${id}`, { method: "DELETE" });
    setIps((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-ink mb-1 flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate" /> Allowed IPs
      </h2>
      <p className="text-sm text-slate mb-3 max-w-xl">
        Restrict which source IPs may use your API keys. While this list is empty,
        requests are allowed from any IP. Add an entry to lock the API down to only
        those addresses. Accepts a single IP or an IPv4 range, e.g.{" "}
        <code className="text-ink font-mono text-xs">203.0.113.7</code> or{" "}
        <code className="text-ink font-mono text-xs">203.0.113.0/24</code>.
      </p>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="203.0.113.0/24"
            className="flex-1 bg-white rounded-field border border-fog px-4 py-2.5 text-sm font-mono text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Label (optional)"
            className="sm:w-44 bg-white rounded-field border border-fog px-4 py-2.5 text-sm text-ink placeholder:text-slate/60 focus:outline-none focus:border-sky/60"
          />
          <Button onClick={add} disabled={!cidr.trim() || adding}>
            <Plus className="w-4 h-4" /> {adding ? "Adding…" : "Allow IP"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-alert font-medium">{error}</p>}
      </Card>

      {loading ? (
        <Card className="p-6 text-sm text-slate">Loading…</Card>
      ) : ips.length === 0 ? (
        <Card className="p-6 text-sm text-slate text-center">
          No IP restrictions. Your API accepts requests from any IP.
        </Card>
      ) : (
        <div className="space-y-2">
          {ips.map((r) => (
            <Card key={r.id} className="p-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-sky-tint text-sky flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-mono font-semibold text-ink truncate">{r.cidr}</div>
                {r.label && <div className="text-xs text-slate truncate">{r.label}</div>}
              </div>
              <button
                onClick={() => remove(r.id)}
                className="text-slate hover:text-alert transition p-2 rounded-lg hover:bg-alert/5 shrink-0"
                aria-label={`Remove ${r.cidr}`}
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
