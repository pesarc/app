"use client";

// The globe as a FIXED backdrop: it stays in place while the page scrolls, so
// it reads faintly through every section (their translucent forest-green
// backgrounds let it show). Lime accent to match the coin-compass system.
import Globe from "./Globe";

export default function GlobeBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {/*
        The globe is interactive only in the hero: the hero content is
        pointer-transparent so drags reach the globe (rotate up/down/left/right),
        while every section below has an opaque background that blocks it, so the
        globe reads as a passive backdrop once you scroll past the hero.
      */}
      <div
        className="pointer-events-auto cursor-grab active:cursor-grabbing absolute top-0 right-[-22%] h-screen w-[85%] lg:right-[-8%] lg:w-[62%]"
        style={{
          maskImage:
            "radial-gradient(circle at 58% 34%, black 28%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 58% 34%, black 28%, transparent 72%)",
        }}
      >
        <Globe
          controls={{ signalRate: 1.1, dotSize: 1, spin: 0.08, glow: 0.9, color: "#c8f542" }}
        />
      </div>
      {/* Lime glow top-right */}
      <div
        className="absolute -top-40 right-[-10%] h-[680px] w-[680px] rounded-full"
        style={{ background: "rgba(200,245,66,0.10)", filter: "blur(130px)" }}
      />
    </div>
  );
}
