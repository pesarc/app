"use client";

// A searchable bank picker. With Paystack live, the list runs to 100+ banks and
// fintechs, so a plain dropdown is unusable — you type to filter by name (or
// sort-code) and pick. Same visual language as <Dropdown>, plus a search box
// pinned at the top of the popover. Closes on outside-click / Escape.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check, X } from "@/components/icons";

export type Bank = { name: string; code: string };

export function BankSelect({
  banks,
  value,
  onChange,
  ariaLabel = "Bank",
  placeholder = "Select bank",
}: {
  banks: Bank[];
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // Focus the search as soon as the popover opens.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(id);
    };
  }, [open]);

  // Clear the filter each time it closes, so it reopens fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = banks.find((b) => b.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
  }, [banks, query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-fog bg-snow px-3.5 py-2.5 text-sm font-semibold text-ink hover:border-slate/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors"
      >
        <span className="truncate">{selected ? selected.name : placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="animate-dropdown absolute z-30 mt-1.5 w-full rounded-xl border border-fog bg-snow shadow-pop-sm">
          <div className="sticky top-0 p-2 border-b border-fog bg-snow rounded-t-xl">
            <div className="flex items-center gap-2 rounded-lg border border-fog bg-white px-2.5 py-2">
              <Search className="w-4 h-4 text-slate shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search banks"
                aria-label="Search banks"
                className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-slate/70"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 text-slate hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div role="listbox" className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3.5 py-4 text-center text-[13px] text-slate">
                No banks match &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((b) => (
                <button
                  key={b.code}
                  role="option"
                  aria-selected={b.code === value}
                  type="button"
                  onClick={() => {
                    onChange(b.code);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                    b.code === value
                      ? "bg-sky-tint/50 text-sky-deep font-bold"
                      : "text-ink hover:bg-black/[0.04]"
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {b.code === value && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
