import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import Shift from "@/components/landing/Shift";
import NetworkHub from "@/components/landing/NetworkHub";
import Different from "@/components/landing/Different";
import { Platform, FinalCta } from "@/components/landing/Platform";
import Footer from "@/components/landing/Footer";
import GlobeBackdrop from "@/components/landing/GlobeBackdrop";

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-clip text-white [color-scheme:dark]"
      style={{
        // Deep navy from the Pesarc logo blue family.
        background: "linear-gradient(160deg,#041a33 0%,#072a4d 45%,#041a33 100%)",
        fontFamily: "var(--font-geist), var(--font-sans), sans-serif",
      }}
    >
      {/* Diagonal hatch, fixed so it feels like one surface */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg,rgba(255,255,255,0.025) 0px,rgba(255,255,255,0.025) 1px,transparent 1px,transparent 56px)",
        }}
        aria-hidden
      />
      {/* Globe backdrop, visible faintly through every section */}
      <GlobeBackdrop />

      {/* Fixed, self-hiding, translucent navbar (overlays every section) */}
      <LandingNav />

      {/*
        pointer-events-none on the wrapper so hero clicks fall through to the
        fixed globe behind it (drag/hover). Each section below opts back in so it
        stays interactive and opaque over the globe. The Hero stays pass-through;
        only its nav/CTA/cards opt in.
      */}
      <div className="relative z-10 pointer-events-none">
        <Hero />
        <div className="pointer-events-auto">
          <Shift />
          <NetworkHub />
          <Platform />
          <Different />
          <FinalCta />
          <Footer />
        </div>
      </div>
    </div>
  );
}
