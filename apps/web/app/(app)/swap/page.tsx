import type { Metadata } from "next";
import { Suspense } from "react";
import SwapTabs from "@/components/app/swap/SwapTabs";

export const metadata: Metadata = {
  title: "Swap",
  description: "Swap one currency into another, or move an asset across the chains you support.",
};

export default function SwapPage() {
  // SwapTabs reads ?tab= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <SwapTabs />
    </Suspense>
  );
}
