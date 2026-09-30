"use client";

// A fully-styled dropdown (button + popover), typed by value — unlike a native
// <select> the option list is themed too. Closes on outside-click / Escape.

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "@/components/icons";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  /** Optional leading image (e.g. a chain logo URL) shown before the label. */
  icon?: string;
};

function OptIcon({ src }: { src?: string }) {
  if (!src) return null;
  // Shown as-is (each brand mark keeps its own shape) in a fixed box so every
  // option lines up — no circular mask that would crop square/hex logos.
  return (
    <span className="w-5 h-5 shrink-0 flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny chain logo */}
      <img src={src} alt="" className="w-full h-full" style={{ objectFit: "contain" }} />
    </span>
  );
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  placeholder = "Select",
  compact = false,
}: {
  value: T | "";
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  /** Render as a compact rounded pill (e.g. a token selector) instead of a full-width field. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${compact ? "inline-block" : ""} ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full border border-fog bg-cream px-3 py-1.5 text-[15px] font-bold text-ink hover:border-slate/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors"
            : "w-full flex items-center justify-between gap-2 rounded-xl border border-fog bg-snow px-3.5 py-2.5 text-sm font-semibold text-ink hover:border-slate/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/40 transition-colors"
        }
      >
        <span className="flex items-center gap-2 min-w-0">
          <OptIcon src={selected?.icon} />
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute z-30 mt-1.5 max-h-64 overflow-auto rounded-xl border border-fog bg-snow shadow-pop-sm py-1 ${
            compact ? "right-0 min-w-[190px]" : "w-full"
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition-colors ${
                o.value === value
                  ? "bg-sky-tint/50 text-sky-deep font-bold"
                  : "text-ink hover:bg-black/[0.04]"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <OptIcon src={o.icon} />
                <span className="truncate">{o.label}</span>
              </span>
              {o.hint && <span className="text-[11px] text-slate shrink-0">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
