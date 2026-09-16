import type { Metadata } from "next";
import ProposeMarketView from "@/components/app/markets/ProposeMarketView";

export const metadata: Metadata = {
  title: "Propose a market",
  description:
    "Propose a prediction market — binary (Yes/No) or multiple-choice — and seed it with an initial bond. Settled in local currency.",
};

export default function ProposeMarketPage() {
  return <ProposeMarketView />;
}
