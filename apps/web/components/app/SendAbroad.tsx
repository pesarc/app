"use client";

// The home "Send abroad" strip. Every corridor card shows its live corridor rate
// (real oracle rate when the corridor is live, indicative otherwise). "Add a
// country" lets the user pin a corridor they want to watch; pinned corridors
// persist per-device in localStorage so they're there every time.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X } from "@/components/icons";
import { CURRENCIES, SUPPORTED_CURRENCIES, type CurrencyCode } from "@pesarc/sdk/money";
import { LiveRate } from "./LiveRate";
import { Dropdown } from "./Dropdown";

type Corridor = { from: CurrencyCode; to: CurrencyCode };

// Seeded with corridors we actually settle (USD leg + a live African rate).
const DEFAULTS: Corridor[] = [
  { from: "USD", to: "NGN" },
  { from: "USD", to: "GHS" },
  { from: "USD", to: "KES" },
];

// v2 stores the FULL list (not just extras) so any corridor — including the
// seeded ones — can be removed and stay removed.
const STORE_KEY = "pesarc.corridors.v2";
const LEGACY_KEY = "pesarc.corridors.v1";
const flagFor = (c: CurrencyCode) => CURRENCIES[c]?.flag ?? "🌍";
const keyOf = (c: Corridor) => `${c.from}-${c.to}`;
const clean = (list: unknown): Corridor[] =>
  Array.isArray(list) ? (list as Corridor[]).filter((c) => c && c.from && c.to) : [];

// First run seeds the defaults; after that the stored list is the source of
// truth (an empty list means the user cleared them all — we don't re-seed).
function loadCorridors(): Corridor[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return clean(JSON.parse(raw));
    const legacy = clean(JSON.parse(localStorage.getItem(LEGACY_KEY) || "null"));
    return [
      ...DEFAULTS,
      ...legacy.filter((c) => !DEFAULTS.some((d) => keyOf(d) === keyOf(c))),
    ];
  } catch {
    return [...DEFAULTS];
  }
}

export default function SendAbroad() {
  const [all, setAll] = useState<Corridor[]>([]);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState<CurrencyCode>("USD");
  const [to, setTo] = useState<CurrencyCode>("GHS");

  useEffect(() => setAll(loadCorridors()), []);

  const persist = (next: Corridor[]) => {
    setAll(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* private mode / blocked storage — edits just won't persist */
    }
  };

  const add = () => {
    if (from === to) return;
    const c = { from, to };
    if (all.some((x) => keyOf(x) === keyOf(c))) {
      setAdding(false);
      return;
    }
    persist([...all, c]);
    setAdding(false);
  };

  const remove = (c: Corridor) => persist(all.filter((p) => keyOf(p) !== keyOf(c)));

  const opts = SUPPORTED_CURRENCIES;

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-slate">Send abroad</h2>
        <Link href="/send" className="text-[13px] font-bold text-sky hover:text-sky-deep">
          Today&apos;s rates
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2.5 mb-8">
        {all.map((c) => (
          <div
            key={keyOf(c)}
            className="relative flex-none w-[168px] bg-snow border border-fog rounded-card p-4 shadow-card-flat"
          >
            <button
              onClick={() => remove(c)}
              aria-label={`Remove ${c.from} to ${c.to}`}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/[0.04] text-slate flex items-center justify-center hover:bg-black/[0.08]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xl">{flagFor(c.from)}</span>
              <svg width="34" height="14" viewBox="0 0 34 14" fill="none">
                <path d="M2 11 C 10 1, 24 1, 32 11" stroke="#2e96ff" strokeWidth="1.6" strokeLinecap="round" />
                <circle cx="32" cy="11" r="2.4" fill="#2e96ff" />
              </svg>
              <span className="text-xl">{flagFor(c.to)}</span>
            </div>
            <div className="text-[13px] font-semibold text-slate mb-0.5">
              {c.from} → {c.to}
            </div>
            <LiveRate from={c.from} to={c.to} />
          </div>
        ))}

        <button
          onClick={() => setAdding(true)}
          className="flex-none w-[118px] rounded-card border border-dashed border-sky-tint bg-sky-tint/25 p-4 flex flex-col items-start justify-center gap-2.5 text-sky-deep hover:bg-sky-tint/40 transition-colors"
        >
          <span className="w-[34px] h-[34px] rounded-full bg-snow flex items-center justify-center">
            <Plus className="w-[18px] h-[18px]" />
          </span>
          <span className="text-[13px] font-bold leading-tight text-left">
            Add a
            <br />
            country
          </span>
        </button>
      </div>

      {/* Pin-a-corridor modal — rendered outside the scroll strip so the token
          dropdowns aren't clipped and sit above everything. */}
      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6"
          onClick={() => setAdding(false)}
        >
          <div
            className="w-full max-w-sm rounded-card bg-snow p-5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-extrabold text-harbor mb-4">Pin a corridor</div>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">From</div>
                <CcySelect value={from} onChange={setFrom} options={opts} />
              </div>
              <span className="text-slate mt-5">→</span>
              <div className="flex-1">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate mb-1.5">To</div>
                <CcySelect value={to} onChange={setTo} options={opts} />
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={add}
                disabled={from === to}
                className="flex-1 rounded-pill bg-sky text-white text-sm font-bold py-2.5 disabled:opacity-50"
              >
                Pin corridor
              </button>
              <button
                onClick={() => setAdding(false)}
                className="rounded-pill bg-black/[0.05] text-slate text-sm font-bold px-5 py-2.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CcySelect({
  value,
  onChange,
  options,
}: {
  value: CurrencyCode;
  onChange: (c: CurrencyCode) => void;
  options: readonly CurrencyCode[];
}) {
  return (
    <Dropdown
      value={value}
      onChange={onChange}
      ariaLabel="Currency"
      className="flex-1 min-w-0"
      options={options.map((c) => ({ value: c, label: `${flagFor(c)} ${c}` }))}
    />
  );
}
