"use client";

// Admin CRUD for the three catalogs: prediction markets, stocks/ETFs, and AI
// agents. Create / read / update / delete via /api/admin/catalog. Field-driven
// forms per kind. Unchanged behaviour — extracted verbatim from the admin page
// so the page shell can host multiple sections. Auth (x-admin-secret) comes in
// from the shared admin shell via `hdr`; a 403 bubbles up through onForbidden.

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "@/components/icons";
import { Select } from "@/components/app/ui";
import type { AdminHdr } from "./useAdmin";

type Kind = "markets" | "stocks" | "agents";
type Item = { id: string; kind: Kind; data: Record<string, unknown>; updatedAt: string };
type Field = { name: string; label: string; type?: "text" | "number"; options?: string[] };

const FIELDS: Record<Kind, Field[]> = {
  markets: [
    { name: "question", label: "Question" },
    { name: "kind", label: "Kind", options: ["fx", "macro", "sports", "politics"] },
    { name: "collateral", label: "Collateral", options: ["cNGN", "cKES", "cGHS"] },
    { name: "closes", label: "Closes" },
    { name: "resolves", label: "Resolves" },
    { name: "flag", label: "Flag" },
  ],
  stocks: [
    { name: "symbol", label: "Symbol" },
    { name: "name", label: "Name" },
    { name: "type", label: "Type", options: ["stock", "etf"] },
    { name: "market", label: "Market", options: ["NGX", "JSE", "NSE", "GSE", "EGX", "US"] },
    { name: "sector", label: "Sector" },
    { name: "price", label: "Price", type: "number" },
    { name: "change", label: "24h %", type: "number" },
  ],
  agents: [
    { name: "name", label: "Name" },
    { name: "model", label: "Model" },
    { name: "capToken", label: "Cap token" },
    { name: "cap", label: "Cap", type: "number" },
    { name: "note", label: "Note" },
  ],
};

const TABS: { kind: Kind; label: string }[] = [
  { kind: "markets", label: "Markets" },
  { kind: "stocks", label: "Stocks & ETFs" },
  { kind: "agents", label: "AI Agents" },
];

function blank(kind: Kind): Record<string, string> {
  return Object.fromEntries(FIELDS[kind].map((f) => [f.name, ""]));
}

export function CatalogTab({ hdr, onForbidden }: { hdr: AdminHdr; onForbidden: () => void }) {
  const [kind, setKind] = useState<Kind>("markets");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // id or "new"
  const [form, setForm] = useState<Record<string, string>>(blank("markets"));
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (k: Kind) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/catalog?kind=${k}`, { headers: hdr() });
        if (res.status === 403) {
          onForbidden();
          setItems([]);
        } else {
          const j = await res.json();
          setItems(j.ok ? j.items : []);
        }
      } catch {
        setItems([]);
      }
      setLoading(false);
    },
    [hdr, onForbidden],
  );

  useEffect(() => {
    load(kind);
    setEditing(null);
  }, [kind, load]);

  const startNew = () => {
    setForm(blank(kind));
    setEditing("new");
  };
  const startEdit = (it: Item) => {
    setForm({ ...blank(kind), ...Object.fromEntries(Object.entries(it.data).map(([k, v]) => [k, String(v ?? "")])) });
    setEditing(it.id);
  };

  const save = async () => {
    setBusy(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of FIELDS[kind]) {
        const raw = form[f.name] ?? "";
        data[f.name] = f.type === "number" ? Number(raw) || 0 : raw;
      }
      const isNew = editing === "new";
      await fetch("/api/admin/catalog", {
        method: isNew ? "POST" : "PATCH",
        headers: hdr(true),
        body: JSON.stringify(isNew ? { kind, data } : { kind, id: editing, data }),
      });
      setEditing(null);
      await load(kind);
    } catch {
      /* ignore */
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/catalog?kind=${kind}&id=${id}`, { method: "DELETE", headers: hdr() });
    await load(kind);
  };

  return (
    <div>
      <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.kind}
            onClick={() => setKind(t.kind)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
              t.kind === kind ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate">
          {items.length} {kind}
        </h2>
        <button
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-pill bg-sky text-white text-sm font-bold px-4 py-2 shadow-pop-sm hover:-translate-y-0.5 transition-transform"
        >
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {editing && (
        <div className="rounded-card bg-snow border border-sky/40 shadow-card-flat p-4 mb-4">
          <div className="text-[13px] font-bold text-harbor mb-3">
            {editing === "new" ? "Create" : "Edit"} {kind.slice(0, -1)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS[kind].map((f) => (
              <label key={f.name} className="text-[12px] font-semibold text-slate">
                {f.label}
                {f.options ? (
                  <Select
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    className="mt-1"
                  >
                    <option value="">—</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                ) : (
                  <input
                    value={form[f.name] ?? ""}
                    inputMode={f.type === "number" ? "decimal" : undefined}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    className="mt-1 w-full rounded-field border border-fog bg-snow px-3 py-2 text-[14px] font-medium text-ink"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-pill bg-sky text-white text-sm font-bold px-4 py-2 shadow-pop-sm disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
            </button>
            <button
              onClick={() => setEditing(null)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-snow border border-fog text-harbor text-sm font-bold px-4 py-2"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 bg-snow border border-fog rounded-2xl px-4 py-3 shadow-card-flat">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-harbor truncate">
                  {String(it.data.symbol ?? it.data.name ?? it.data.question ?? it.id)}
                </div>
                <div className="text-[12px] text-slate truncate">
                  {FIELDS[kind].slice(1, 4).map((f) => it.data[f.name]).filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={() => startEdit(it)} aria-label="Edit" className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-harbor hover:bg-black/[0.05]">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => remove(it.id)} aria-label="Delete" className="w-9 h-9 rounded-full bg-cream flex items-center justify-center text-alert hover:bg-alert/10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate py-8 text-center">Nothing yet — add one.</p>}
        </div>
      )}
    </div>
  );
}
