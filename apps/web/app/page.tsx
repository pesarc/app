import Hero from "@/components/landing/Hero";
import { Features, NetworksBanks } from "@/components/landing/Sections";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";
import GlobeBackdrop from "@/components/landing/GlobeBackdrop";

export default function Home() {
  return (
    <div
      className="relative min-h-screen overflow-x-hidden text-white [color-scheme:dark]"
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

      <div className="relative z-10">
        <Hero />
        <Features />
        <NetworksBanks />
        <Waitlist />
        <Footer />
      </div>
    </div>
  );
}
