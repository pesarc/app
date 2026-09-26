"use client";

// A small fixed ribbon shown on non-production environments so nobody confuses
// staging/dev with the real thing. Nothing renders in production.

import { APP_ENV, showEnvBadge } from "@pesarc/sdk/env";

export default function EnvBadge() {
  if (!showEnvBadge) return null;
  const label = APP_ENV === "staging" ? "STAGING" : "DEV";
  const bg = APP_ENV === "staging" ? "#b45309" : "#0254a5";
  return (
    <div
      aria-hidden
      className="fixed bottom-2 left-2 z-[100] pointer-events-none select-none rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-md"
      style={{ background: bg }}
    >
      {label}
    </div>
  );
}
