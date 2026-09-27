"use client";

// Line illustrations for the "Why it holds up" scroll story. One compact,
// on-brand SVG per moat: thin rounded strokes in the Pesarc accent over navy,
// with a slow ambient motion so the active card feels alive (not scroll-tied,
// so it reads the same on a phone stack as in the pinned desktop story).

import { motion } from "framer-motion";

const ACCENT = "#3AA0FF";
const FAINT = "rgba(58,160,255,0.28)";

const wrap = "w-full h-full";
const common = {
  fill: "none",
  stroke: ACCENT,
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// A dashed line that endlessly "flows" along its path.
function Flow({ d, dur = 2.6, delay = 0 }: { d: string; dur?: number; delay?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={ACCENT}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeDasharray="4 7"
      initial={{ strokeDashoffset: 0 }}
      animate={{ strokeDashoffset: -44 }}
      transition={{ repeat: Infinity, ease: "linear", duration: dur, delay }}
    />
  );
}

/** Intent netting: two opposing flows meet at a node and cancel. */
function Netting() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <circle cx="60" cy="60" r="10" {...common} />
      <circle cx="60" cy="60" r="3.2" fill={ACCENT} stroke="none" />
      <Flow d="M8 34 C34 34 44 60 50 60" />
      <Flow d="M112 34 C86 34 76 60 70 60" delay={0.5} />
      <Flow d="M8 86 C34 86 44 60 50 60" delay={1} />
      <Flow d="M112 86 C86 86 76 60 70 60" delay={1.5} />
      <path d="M14 34h-0M106 86h0" {...common} />
      <circle cx="10" cy="34" r="2.4" fill={FAINT} stroke="none" />
      <circle cx="110" cy="34" r="2.4" fill={FAINT} stroke="none" />
      <circle cx="10" cy="86" r="2.4" fill={FAINT} stroke="none" />
      <circle cx="110" cy="86" r="2.4" fill={FAINT} stroke="none" />
    </svg>
  );
}

/** On-chain rate oracle: a locked, verifiable price. */
function Oracle() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <rect x="30" y="40" width="60" height="40" rx="8" {...common} />
      <path d="M42 60h26" {...common} />
      <motion.path
        d="M72 60l6 6l10 -12"
        {...common}
        strokeWidth={2}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.6, repeatType: "reverse" }}
      />
      <path d="M52 40v-6a8 8 0 0116 0v6" {...common} />
      <circle cx="60" cy="98" r="2.6" fill={ACCENT} stroke="none" />
      <path d="M60 80v10" {...common} strokeDasharray="3 5" />
    </svg>
  );
}

/** Gasless smart accounts: a tap that just works, no fuel, no key. */
function Gasless() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <rect x="42" y="24" width="36" height="64" rx="9" {...common} />
      <path d="M54 24h12" {...common} />
      <motion.path
        d="M62 42l-8 14h8l-4 12l12 -18h-8z"
        fill={ACCENT}
        stroke={ACCENT}
        strokeWidth={1.2}
        strokeLinejoin="round"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="60"
        cy="98"
        r="12"
        {...common}
        strokeDasharray="2 5"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "60px 98px" }}
      />
    </svg>
  );
}

/** One core, many channels: a hub reaching smartphone, feature phone, chat. */
function Channels() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <circle cx="60" cy="60" r="9" {...common} />
      <circle cx="60" cy="60" r="3" fill={ACCENT} stroke="none" />
      <Flow d="M60 51 C60 34 30 32 22 26" dur={2.2} />
      <Flow d="M69 60 C92 60 96 40 100 30" dur={2.4} delay={0.4} />
      <Flow d="M60 69 C60 92 34 94 24 98" dur={2.6} delay={0.8} />
      <rect x="12" y="14" width="14" height="20" rx="3" {...common} />
      <rect x="94" y="18" width="16" height="16" rx="4" {...common} />
      <path d="M18 88a10 10 0 1120 0l-2 8l-8 -4h-0a10 10 0 01-10 -4z" {...common} />
    </svg>
  );
}

/** Owned FX corridors: our own local-money pools, joined. */
function Corridors() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <ellipse cx="30" cy="44" rx="16" ry="6" {...common} />
      <ellipse cx="90" cy="44" rx="16" ry="6" {...common} />
      <ellipse cx="60" cy="86" rx="16" ry="6" {...common} />
      <Flow d="M42 47 C56 54 60 66 60 80" dur={2.4} />
      <Flow d="M78 47 C64 54 60 66 60 80" dur={2.4} delay={0.6} />
      <text x="30" y="47" fontSize="8" fill={ACCENT} textAnchor="middle" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>₦</text>
      <text x="90" y="47" fontSize="8" fill={ACCENT} textAnchor="middle" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>₵</text>
      <text x="60" y="89" fontSize="7" fill={ACCENT} textAnchor="middle" style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}>KSh</text>
    </svg>
  );
}

/** Non-custodial: the balance sits in a wallet only the holder can open. */
function SelfCustody() {
  return (
    <svg viewBox="0 0 120 120" className={wrap} aria-hidden>
      <rect x="26" y="42" width="68" height="44" rx="10" {...common} />
      <path d="M26 56h68" {...common} />
      <circle cx="80" cy="66" r="4" {...common} />
      <motion.g
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <rect x="52" y="20" width="16" height="16" rx="5" {...common} />
        <path d="M56 20v-3a4 4 0 018 0v3" {...common} />
        <path d="M60 42v-6" {...common} strokeDasharray="3 4" />
      </motion.g>
    </svg>
  );
}

const MAP: Record<string, () => React.ReactElement> = {
  netting: Netting,
  oracle: Oracle,
  gasless: Gasless,
  channels: Channels,
  corridors: Corridors,
  custody: SelfCustody,
};

export type MoatArt = keyof typeof MAP;

export function MoatIllustration({ id }: { id: string }) {
  const Comp = MAP[id] ?? Netting;
  return <Comp />;
}
