import Hero from "@/components/landing/Hero";
import { Modes, Corridor, Rails, EngineCTA } from "@/components/landing/Sections";
import { Independence } from "@/components/landing/Independence";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="bg-cream text-ink [color-scheme:light]">
      <Hero />
      <Modes />
      <Corridor />
      <Rails />
      <Independence />
      <EngineCTA />
      <Waitlist />
      <Footer />
    </div>
  );
}
