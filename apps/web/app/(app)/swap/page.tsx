import type { Metadata } from "next";
import SwapFlow from "@/components/app/swap/SwapFlow";

export const metadata: Metadata = {
  title: "Swap",
  description: "Swap one of your currencies into another at the live rate, in a couple of taps.",
};

export default function SwapPage() {
  return <SwapFlow />;
}
