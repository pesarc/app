"use client";

// Internal admin console. Three sections behind one ADMIN_SECRET gate:
//   • Catalog      — CRUD for prediction markets, stocks/ETFs, AI agents
//   • Operations   — live payouts/transfers KPIs + provider health
//   • Architecture — non-secret reference for how the app is wired
// The passphrase is kept locally and sent as x-admin-secret on every request
// (see useAdmin); any 403 drops the whole console back to the unlock screen.

import { useState } from "react";
import { LayoutGrid, Gauge, Layers } from "@/components/icons";
import { useAdmin } from "@/components/app/admin/useAdmin";
import { CatalogTab } from "@/components/app/admin/CatalogTab";
import { OperationsTab } from "@/components/app/admin/OperationsTab";
import { ArchitectureTab } from "@/components/app/admin/ArchitectureTab";
import type { IconType } from "@/components/icons";

type Section = "catalog" | "ops" | "architecture";

const SECTIONS: { id: Section; label: string; icon: IconType }[] = [
  { id: "catalog", label: "Catalog", icon: LayoutGrid },
  { id: "ops", label: "Operations", icon: Gauge },
  { id: "architecture", label: "Architecture", icon: Layers },
];

export default function AdminPage() {
  const { hdr, authed, setAuthed, unlock } = useAdmin();
  const [section, setSection] = useState<Section>("catalog");
  const [entry, setEntry] = useState("");
  const onForbidden = () => setAuthed(false);

  if (!authed) {
    return (
      <div className="mx-auto w-full max-w-sm px-4 py-20">
        <h1 className="text-[22px] font-extrabold text-harbor tracking-tight mb-1">Admin access</h1>
        <p className="text-sm font-medium text-slate mb-4">
          This area is private. Enter your admin passphrase.
        </p>
        <input
          type="password"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock(entry)}
          placeholder="Admin passphrase"
          className="w-full rounded-field border border-fog bg-snow px-4 py-3 text-[15px] text-ink mb-3"
        />
        <button
          onClick={() => unlock(entry)}
          className="w-full rounded-pill bg-sky text-white font-bold py-3 shadow-pop-sm"
        >
          Unlock
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-6 md:py-10">
      <h1 className="text-[27px] font-extrabold text-harbor tracking-tight mb-1">Admin</h1>
      <p className="text-sm font-medium text-slate mb-5">
        Manage catalogs, watch operations, and review how the app is wired.
      </p>

      <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] p-1 mb-6">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                s.id === section ? "bg-snow text-harbor shadow-card-flat" : "text-slate hover:text-harbor"
              }`}
            >
              <Icon className="w-4 h-4" /> {s.label}
            </button>
          );
        })}
      </div>

      {section === "catalog" && <CatalogTab hdr={hdr} onForbidden={onForbidden} />}
      {section === "ops" && <OperationsTab hdr={hdr} onForbidden={onForbidden} />}
      {section === "architecture" && <ArchitectureTab hdr={hdr} onForbidden={onForbidden} />}
    </div>
  );
}
