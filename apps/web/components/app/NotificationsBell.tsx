"use client";

// A working notifications bell for the app top bar: taps open a small panel,
// tap outside or Escape to close. It reads recent money activity from the
// transfers API and shows it as plain-language notifications ("You sent…",
// "You received…"); when there's nothing, a friendly caught-up state. No crypto
// words — this is the Mum-Test surface.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "@/components/icons";
import { authedFetch } from "@pesarc/sdk/api/client";

type Note = { id: string; title: string; when: string; positive: boolean };

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load recent activity the first time the panel is opened.
  useEffect(() => {
    if (!open || notes !== null) return;
    let alive = true;
    authedFetch("/api/transfers")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const rows = Array.isArray(d?.transfers) ? d.transfers : [];
        setNotes(
          rows.slice(0, 6).map((r: { id: string; direction: string; counterparty: string; createdAt: string }) => ({
            id: r.id,
            title:
              r.direction === "received"
                ? `Money in from ${r.counterparty}`
                : `You sent money to ${r.counterparty}`,
            when: timeAgo(r.createdAt),
            positive: r.direction === "received",
          })),
        );
      })
      .catch(() => alive && setNotes([]));
    return () => {
      alive = false;
    };
  }, [open, notes]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const empty = notes !== null && notes.length === 0;

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-[42px] h-[42px] rounded-full bg-snow border border-fog shadow-card-flat flex items-center justify-center text-harbor hover:border-slate/50 transition-colors"
      >
        <Bell className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border border-fog bg-snow shadow-pop z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-cream">
            <span className="text-[13px] font-extrabold text-harbor">Notifications</span>
          </div>

          {notes === null ? (
            <div className="px-4 py-6 text-center text-[13px] text-slate">Loading…</div>
          ) : empty ? (
            <div className="px-4 py-7 text-center">
              <span className="inline-flex w-10 h-10 rounded-full bg-sky-tint/60 items-center justify-center text-sky-deep mb-2">
                <Check className="w-5 h-5" />
              </span>
              <p className="text-[13.5px] font-bold text-ink">You're all caught up</p>
              <p className="text-[12px] text-slate mt-0.5">New activity will show here.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-cream">
              {notes!.map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.positive ? "bg-sky" : "bg-harbor/40"}`}
                  />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink leading-snug">{n.title}</p>
                    <p className="text-[11.5px] text-slate mt-0.5">{n.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/home"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-[12.5px] font-bold text-sky hover:text-sky-deep border-t border-cream"
          >
            See all activity
          </Link>
        </div>
      )}
    </div>
  );
}
