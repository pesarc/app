"use client";

import * as React from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";

// Pesarc motion language — calm, springy, confident. Short durations, soft
// spring, gentle upward reveals. Respects prefers-reduced-motion via framer.

export const spring = { type: "spring", stiffness: 380, damping: 30, mass: 0.7 } as const;
export const springSoft = { type: "spring", stiffness: 220, damping: 26 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { ...springSoft } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/** Fade + rise on mount. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ ...springSoft, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container — wrap a list; children use <StaggerItem>. */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerParent} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  pop = false,
}: {
  children: React.ReactNode;
  className?: string;
  pop?: boolean;
}) {
  return (
    <motion.div className={className} variants={pop ? popIn : fadeUp}>
      {children}
    </motion.div>
  );
}

/** Springy scale-in when scrolled into view. */
export function InViewPop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={popIn}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

/** Animated number count-up. `format` maps the live value to display text. */
export function CountUp({
  to,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: {
  to: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const mv = useMotionValue(0);
  const sv = useSpring(mv, { stiffness: 90, damping: 20, mass: 1 });
  const text = useTransform(sv, (v) => format(v));
  React.useEffect(() => {
    mv.set(to);
  }, [to, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

/** Tap-springy pressable wrapper for CTAs (keeps the flat pop-shadow, adds life). */
export function Pressable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -2 }}
      whileTap={{ y: 1, scale: 0.99 }}
      transition={spring}
    >
      {children}
    </motion.div>
  );
}
