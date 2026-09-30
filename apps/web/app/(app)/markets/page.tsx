import type { Metadata } from "next";
import { Suspense } from "react";
import MarketsView from "@/components/app/markets/MarketsView";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Predict Africa. Trade Yes or No on elections, football, prices and world events, settled in your own currency and backed by Pesarc's own liquidity.",
};

export default function MarketsPage() {
  // MarketsView reads ?stake=/&side= via useSearchParams, which needs Suspense.
  return (
    <Suspense fallback={null}>
      <MarketsView />
    </Suspense>
  );
}
