"use client";

// "Why it holds up" — the technical / infra moats, told as a pinned SCROLL STORY
// modelled on the nexus "05 / Scroll story": a single bordered frame with a
// STATIC left rail (heading + text) and, on the right, a TALL card that slides
// through the six moats 1 → 6 as you scroll. Scroll-scrubbed via framer-motion
// (no GSAP/Lenis). Plain language (the Mum Test) with a small "how" tag so one
// read lands for a customer, an investor and a hackathon judge alike.
//
// Responsive: the pinned frame runs on large screens; phones and tablets get a
// calm vertical reveal-stack of the same cards (no scroll-jack on touch).

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionTemplate, type MotionValue } from "framer-motion";
import { MoatIllustration } from "./different/illustrations";

// True on large screens. A real mount switch (not display:none) so the pinned
// story's scroll target is always laid out — framer's useScroll can't measure an
// element inside a `hidden` ancestor.
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

const ACCENT = "#3AA0FF";
const ease = [0.22, 1, 0.36, 1] as const;
const mono = { fontFamily: "var(--font-mono, ui-monospace), monospace" } as const;
const serif = { fontFamily: "var(--font-serif, Georgia), serif" } as const;

type Moat = { n: string; art: string; title: string; body: string; how: string };

const MOATS: Moat[] = [
  {
    n: "01",
    art: "netting",
    title: "Cheaper as more people join",
    body: "Most transfers cancel each other out before money ever leaves the network, so the fee keeps dropping as we grow.",
    how: "Intent netting",
  },
  {
    n: "02",
    art: "oracle",
    title: "Honest rates, checked openly",
    body: "The amount your person receives is fixed before you press send, and anyone can verify it. No hidden spread.",
    how: "On-chain rate oracle",
  },
  {
    n: "03",
    art: "gasless",
    title: "No separate gas token, no seed phrase",
    body: "You never buy a separate coin to pay a fee or write down twelve secret words. Fees come out of the same stablecoin you hold, like a normal app.",
    how: "Fees paid in your own stablecoin",
  },
  {
    n: "04",
    art: "channels",
    title: "Works on any phone",
    body: "The same money on a smartphone, on WhatsApp, and on USSD for a basic phone. Nobody is left out.",
    how: "One core, many channels",
  },
  {
    n: "05",
    art: "corridors",
    title: "We own the local-money rails",
    body: "We run the local-currency pools ourselves, so the savings reach you instead of a middleman.",
    how: "Owned FX corridors",
  },
  {
    n: "06",
    art: "custody",
    title: "Your money, only yours",
    body: "Pesarc never holds your balance. There is nothing to freeze, nothing to lose, nothing to run off with.",
    how: "Non-custodial",
  },
];

/* ------------------------------ the left rail ------------------------------ */

function LeftRail({ progress }: { progress?: MotionValue<number> }) {
  return (
    <div>
      <span
        className="inline-block rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
        style={{ ...mono, color: ACCENT, background: "rgba(58,160,255,0.12)" }}
      >
        Why it holds up
      </span>
      <h2 className="mt-6 text-4xl sm:text-5xl lg:text-[3.4rem] tracking-tight text-white" style={{ ...serif, lineHeight: 1.05 }}>
        Simple on top.{" "}
        <span className="italic text-white/55">Serious underneath.</span>
      </h2>
      <p className="mt-6 max-w-md text-sm sm:text-base font-light text-white/60 leading-relaxed">
        Send, hold and earn in your own money, in seconds, for one clear fee you can
        actually read. No seed phrase, no separate gas token, and it works on any phone. Scroll
        through six things you get, and how each one works.
      </p>
      {progress && (
        <div className="mt-9 flex items-center gap-2.5">
          {MOATS.map((_, i) => (
            <ProgressDot key={i} index={i} total={MOATS.length} progress={progress} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressDot({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) {
  const seg = 1 / total;
  const active = useTransform(progress, [index * seg, (index + 0.5) * seg, (index + 1) * seg], [0.25, 1, 0.25]);
  const scale = useTransform(active, [0.25, 1], [1, 1.5]);
  return <motion.span style={{ opacity: active, scale, background: ACCENT }} className="h-2 w-2 rounded-full" />;
}

/* ------------------------- the tall moat card (desktop) ------------------------- */

function PinnedCard({
  m,
  index,
  total,
  progress,
}: {
  m: Moat;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const seg = 1 / total;
  const start = index * seg;
  const end = (index + 1) * seg;
  const pad = seg * 0.32;
  const first = index === 0;
  const last = index === total - 1;

  // Cross-fade + full-height slide: the card enters from below, holds, then
  // slides up and out as the next one arrives (nexus scroll-story motion).
  const opacity = useTransform(
    progress,
    [start, start + pad, end - pad, end],
    [first ? 1 : 0, 1, 1, last ? 1 : 0],
  );
  const yp = useTransform(
    progress,
    [start, start + pad, end - pad, end],
    [first ? 0 : 8, 0, 0, last ? 0 : -8],
  );
  const y = useMotionTemplate`${yp}%`;

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-5 sm:inset-6 flex flex-col rounded-2xl border border-white/10 bg-[#0a2a4d]/70 p-8 sm:p-10 backdrop-blur-md"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/40" style={mono}>
        Moat {m.n}
      </span>
      <h3 className="mt-6 text-3xl sm:text-4xl font-medium tracking-tight text-white" style={serif}>
        {m.title}
      </h3>
      <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">{m.body}</p>

      {/* The generous lower space carries the moat's illustration + the "how" tag. */}
      <div className="mt-auto flex items-end justify-between gap-6 pt-8">
        <span
          className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ ...mono, color: ACCENT, border: "1px solid rgba(58,160,255,0.3)", background: "rgba(58,160,255,0.06)" }}
        >
          {m.how}
        </span>
        <span className="h-24 w-24 shrink-0 opacity-90">
          <MoatIllustration id={m.art} />
        </span>
      </div>
    </motion.div>
  );
}

function DifferentPinned() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    // Tall track: the framed panel pins while the moats slide through it. ~0.6
    // viewport of scroll per moat keeps the cadence snappy (nexus-like).
    <div ref={ref} className="relative" style={{ height: `${MOATS.length * 62}vh` }}>
      <div className="sticky top-0 flex h-screen items-center px-4 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <div
            className="relative grid overflow-hidden rounded-3xl border border-white/10 lg:grid-cols-2"
            style={{ minHeight: "40rem", background: "rgba(5,22,41,0.55)" }}
          >
            {/* Corner accents (top-left, bottom-right), nexus-style. */}
            <span className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l border-t" style={{ borderColor: "rgba(58,160,255,0.5)" }} />
            <span className="pointer-events-none absolute right-4 bottom-4 h-6 w-6 border-b border-r" style={{ borderColor: "rgba(58,160,255,0.5)" }} />

            {/* Left: static narrative, vertically centred, hairline divider. */}
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-12 lg:border-r lg:border-white/10">
              <LeftRail progress={scrollYProgress} />
            </div>

            {/* Right: the tall card that slides through the six moats. */}
            <div className="relative min-h-[26rem] lg:min-h-0">
              {MOATS.map((m, i) => (
                <PinnedCard key={m.n} m={m} index={i} total={MOATS.length} progress={scrollYProgress} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- phone / tablet: calm reveal-stack ---------------------- */

function StackCard({ m }: { m: Moat }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/12 bg-[#0a2a4d]/70 p-7 backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40" style={mono}>
          Moat {m.n}
        </span>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(58,160,255,0.10)", border: "1px solid rgba(58,160,255,0.18)" }}>
          <MoatIllustration id={m.art} />
        </span>
      </div>
      <h3 className="mt-5 text-2xl font-medium tracking-tight text-white" style={serif}>
        {m.title}
      </h3>
      <p className="mt-3 text-sm font-light leading-relaxed text-white/60">{m.body}</p>
      <span
        className="mt-5 inline-flex w-fit items-center rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ ...mono, color: ACCENT, border: "1px solid rgba(58,160,255,0.3)", background: "rgba(58,160,255,0.06)" }}
      >
        {m.how}
      </span>
    </div>
  );
}

function DifferentStack() {
  return (
    <div className="px-6 sm:px-8 py-24">
      <div className="mx-auto max-w-2xl">
        <LeftRail />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {MOATS.map((m, i) => (
            <motion.div
              key={m.n}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease, delay: (i % 2) * 0.06 }}
            >
              <StackCard m={m} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- section --------------------------------- */

export default function Different() {
  const isDesktop = useIsDesktop();

  return (
    <section
      id="different"
      className="relative"
      style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(7,42,77,0.72)" }}
    >
      {isDesktop ? <DifferentPinned /> : <DifferentStack />}
    </section>
  );
}
