"use client";

// When the user returns to the app with a wallet address or a 10-digit account
// number on their clipboard, offer to send to it. Best-effort: clipboard reads
// are browser-gated (permission / focus), so it fails silently when blocked, and
// each value is only offered once.

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, ArrowRight } from "@/components/icons";
import { isEvmAddress, isSolanaAddress } from "./send/helpers";

function detect(text: string): { kind: "wallet" | "account"; value: string } | null {
  const t = text.trim();
  if (isEvmAddress(t) || isSolanaAddress(t)) return { kind: "wallet", value: t };
  if (/^\d{10}$/.test(t)) return { kind: "account", value: t };
  return null;
}

export default function ClipboardPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [hit, setHit] = useState<{ kind: "wallet" | "account"; value: string } | null>(null);
  const dismissed = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        if (document.visibilityState !== "visible") return;
        if (pathname?.startsWith("/send")) return; // already sending
        const text = await navigator.clipboard.readText();
        const d = detect(text);
        if (active && d && !dismissed.current.has(d.value)) setHit(d);
      } catch {
        /* clipboard blocked — ignore */
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  if (!hit) return null;
  const v = hit.value;
  const short = v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
  const dismiss = () => {
    dismissed.current.add(v);
    setHit(null);
  };
  const go = () => {
    dismiss();
    router.push(`/send?to=${encodeURIComponent(v)}${hit.kind === "account" ? "&method=bank" : ""}`);
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4 flex justify-center pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 max-w-md w-full rounded-2xl bg-harbor text-white px-4 py-3 shadow-pop">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold">
            You copied {hit.kind === "wallet" ? "a wallet address" : "an account number"}
          </div>
          <div className="text-[12px] text-white/70 font-mono truncate">{short}</div>
        </div>
        <button
          onClick={go}
          className="shrink-0 rounded-full bg-white text-harbor text-[13px] font-bold px-3.5 py-1.5 inline-flex items-center gap-1.5"
        >
          Send <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
