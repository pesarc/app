"use client";

// The landing navbar. Fixed to the top, but it gets out of the way: it slides up
// and hides as you scroll down, comes back the moment you scroll up, and turns a
// translucent, blurred navy once you leave the top so it never blocks content.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LayoutGrid, Globe2, Sparkles, type LucideIcon } from "@/components/icons";
import { NavPill, AccentButton } from "./ui";
import { site } from "@pesarc/sdk/site";
import { LogoMark } from "@/components/app/Logo";

const NAV_ICON: Record<string, LucideIcon> = {
  Product: LayoutGrid,
  Networks: Globe2,
  Beta: Sparkles,
};

export default function LandingNav() {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 16);
        // Hide when scrolling down past the hero; show again on any scroll up.
        if (y > 140 && y > lastY.current + 4) setHidden(true);
        else if (y < lastY.current - 4 || y < 140) setHidden(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-transform duration-300 will-change-transform ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div
        className={`transition-colors duration-300 ${scrolled ? "backdrop-blur-md border-b border-white/10" : "border-b border-transparent"}`}
        style={scrolled ? { background: "rgba(4,26,51,0.62)" } : undefined}
      >
        <div className="mx-auto max-w-[1400px] flex items-center justify-between px-6 md:px-12 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={34} className="rounded-xl" />
            <span className="text-xl font-medium tracking-tight text-white">{site.name}</span>
          </Link>

          <nav className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              {site.nav.map((item) => (
                <NavPill
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={NAV_ICON[item.label] ?? LayoutGrid}
                />
              ))}
            </div>
            <AccentButton href={`${site.appUrl}/home`} size="sm" icon={ArrowUpRight} className="uppercase tracking-wide">
              Open app
            </AccentButton>
          </nav>
        </div>
      </div>
    </header>
  );
}
