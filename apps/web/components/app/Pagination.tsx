"use client";

// Reusable client-side pagination — a hook that slices a list into pages and a
// compact, responsive control (Prev · windowed page numbers · Next). Used by
// Invest, Markets and Earn so long, admin-growable lists stay scannable.

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Slice `items` into pages of `pageSize`. Pass a `resetKey` (e.g. the active
 * filter/search) — the page snaps back to 1 whenever it changes, and the page
 * is always clamped into range as the list shrinks.
 */
export function usePaged<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;

  return {
    page: current,
    setPage,
    pageCount,
    total: items.length,
    items: items.slice(start, start + pageSize),
  };
}

/** Page numbers with ellipsis, keeping the current page in a window. */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pageCount - 1, page + 1);
  if (lo > 2) out.push("…");
  for (let i = lo; i <= hi; i++) out.push(i);
  if (hi < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className = "",
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const go = (p: number) => onChange(Math.max(1, Math.min(pageCount, p)));

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1.5 pt-5 ${className}`}
    >
      <button
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-snow border border-fog text-harbor disabled:opacity-40 hover:border-slate/50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pageWindow(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-slate text-sm select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-9 h-9 px-2.5 rounded-full text-[13.5px] font-bold transition-colors ${
              p === page
                ? "bg-harbor text-white"
                : "bg-snow border border-fog text-slate hover:text-harbor"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => go(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-snow border border-fog text-harbor disabled:opacity-40 hover:border-slate/50 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
