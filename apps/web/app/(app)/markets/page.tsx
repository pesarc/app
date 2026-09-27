import type { Metadata } from "next";
import MarketsView from "@/components/app/markets/MarketsView";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Predict Africa. Trade Yes or No on elections, football, prices and world events, settled in your own currency and backed by Pesarc's own liquidity.",
};

export default function MarketsPage() {
  return <MarketsView />;
}
