"use client";

// The globe as a FIXED backdrop: it stays in place while the page scrolls, so
// it reads faintly through every section. Blue accent to match the Pesarc logo.
// Sits center-left in the hero so the agent cards (bottom-right) never cover it
// and it stays draggable.
import Globe from "./Globe";

export default function GlobeBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {/*
        Interactive in the hero: the hero content is pointer-transparent (only the
        CTAs opt back in) so drags reach the globe (rotate up/down/left/right),
        while every section below has an opaque background that blocks it, so the
        globe reads as a passive backdrop once you scroll past the hero.
      */}
      <div
        className="pointer-events-auto cursor-grab active:cursor-grabbing absolute top-[2%] left-1/2 -translate-x-1/2 h-[94vh] w-[96%] lg:left-[60%] lg:w-[70%] 2xl:w-[74%]"
        style={{
          maskImage:
            "radial-gradient(circle at 50% 44%, black 44%, transparent 82%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 44%, black 44%, transparent 82%)",
        }}
      >
        <Globe
          controls={{ signalRate: 1.1, dotSize: 1, spin: 0.08, glow: 0.9, color: "#3AA0FF" }}
        />
      </div>
      {/* Accent glow */}
      <div
        className="absolute top-[10%] left-[14%] h-[680px] w-[680px] rounded-full"
        style={{ background: "rgba(58,160,255,0.10)", filter: "blur(130px)" }}
      />
    </div>
  );
}
