"use client";

// Pinned "scroll story" (mechanics ported from the nexus reference): a tall
// section whose inner panel pins to the viewport while stacked stage cards
// cross-fade and slide as you scroll through it. Scroll-scrubbed via framer-
// motion's useScroll/useTransform (no GSAP/Lenis dep). Tells Pesarc's features
// in detail, one stage at a time. Reskinned to Pesarc navy / #3AA0FF.

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { LineChart, Waves, Zap, Bot, type LucideIcon } from "@/components/icons";

const ACCENT = "#3AA0FF";

type Stage = {
  n: string;
  icon: LucideIcon;
  title: string;
  body: string;
  chips: string[];
};

const STAGES: Stage[] = [
  {
    n: "01",
    icon: LineChart,
    title: "Pick a side",
    body: "Every debate you already have, priced. Elections, football, the naira, fuel, the world. Read the odds and take Yes or No in a tap.",
    chips: ["Politics", "Sports", "Prices", "Global"],
  },
  {
    n: "02",
    icon: Waves,
    title: "Always a price",
    body: "You never wait for someone to take the other side. Pesarc seeds every market with its own on-chain liquidity, so you can enter or exit any time.",
    chips: ["Our liquidity", "Instant fills", "Fair odds"],
  },
  {
    n: "03",
    icon: Zap,
    title: "Stake gaslessly",
    body: "Back your call in naira, cedi or shilling. No dollar account, no card, no gas token to buy first. Your position settles on-chain in your own money.",
    chips: ["Local currency", "No gas token", "On-chain"],
  },
  {
    n: "04",
    icon: Bot,
    title: "Let the agent run it",
    body: "Ask, in the app or on WhatsApp, and the agent reads the odds, places your position and cashes you out to mobile money or a bank, in your own words.",
    chips: ["In-app", "WhatsApp", "Voice"],
  },
];

function StageCard({
  stage,
  index,
  total,
  progress,
}: {
  stage: Stage;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const seg = 1 / total;
  const start = index * seg;
  const end = (index + 1) * seg;
  const pad = seg * 0.28;
  const first = index === 0;
  const last = index === total - 1;

  // Opacity: fade in near `start`, hold, fade out near `end` (first is already
  // in; last stays out to the end).
  const opacity = useTransform(
    progress,
    [start, start + pad, end - pad, end],
    [first ? 1 : 0, 1, last ? 1 : 1, last ? 1 : 0],
  );
  const y = useTransform(
    progress,
    [start, start + pad, end - pad, end],
    [first ? 0 : 48, 0, 0, last ? 0 : -48],
  );

  const Icon = stage.icon;
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col justify-center rounded-2xl border border-white/12 bg-[#0a2a4d]/70 p-8 sm:p-10 backdrop-blur-md"
    >
      <span
        className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40"
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        Stage {stage.n}
      </span>
      <span
        className="mt-5 grid place-items-center w-12 h-12 rounded-xl"
        style={{ background: "rgba(58,160,255,0.15)" }}
      >
        <Icon className="w-6 h-6" style={{ color: ACCENT }} strokeWidth={1.6} />
      </span>
      <h3 className="mt-5 text-3xl sm:text-4xl font-medium tracking-tight text-white">
        {stage.title}
      </h3>
      <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
        {stage.body}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {stage.chips.map((c) => (
          <span
            key={c}
            className="rounded-full px-3 py-1.5 text-[12px] font-bold text-white/80"
            style={{ border: "1px solid rgba(58,160,255,0.3)", background: "rgba(58,160,255,0.06)" }}
          >
            {c}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

function ProgressDot({ index, total, progress }: { index: number; total: number; progress: MotionValue<number> }) {
  const seg = 1 / total;
  const active = useTransform(progress, [index * seg, (index + 0.5) * seg, (index + 1) * seg], [0.25, 1, 0.25]);
  const scale = useTransform(active, [0.25, 1], [1, 1.4]);
  return (
    <motion.span
      style={{ opacity: active, scale, background: ACCENT }}
      className="w-2 h-2 rounded-full"
    />
  );
}

export default function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    // Tall track: one viewport of scroll per stage. The inner panel pins.
    <section ref={ref} className="relative" style={{ height: `${STAGES.length * 100}vh` }}>
      <div className="sticky top-0 h-screen overflow-hidden px-6 sm:px-8 lg:px-12 flex items-center" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
          {/* Left: static narrative + progress */}
          <div>
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45"
              style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
            >
              How it works
            </span>
            <h2 className="mt-5 text-4xl sm:text-5xl lg:text-[3.4rem] font-medium leading-[1.05] tracking-tight text-white">
              Four taps from a{" "}
              <span style={{ color: ACCENT }}>hunch to a payout.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/55">
              Scroll through the whole loop: pick a side, get a fair price,
              stake in your own money, and let the agent settle it.
            </p>
            <div className="mt-8 flex items-center gap-2.5">
              {STAGES.map((_, i) => (
                <ProgressDot key={i} index={i} total={STAGES.length} progress={scrollYProgress} />
              ))}
            </div>
          </div>

          {/* Right: pinned stage cards */}
          <div className="relative h-[26rem] sm:h-[24rem]">
            {STAGES.map((s, i) => (
              <StageCard key={s.n} stage={s} index={i} total={STAGES.length} progress={scrollYProgress} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
