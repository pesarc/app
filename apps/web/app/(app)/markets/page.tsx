import type { Metadata } from "next";
import MarketsView from "@/components/app/markets/MarketsView";

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Hedge your currency or take a view on FX and macro — parimutuel markets settled in local money from StableArc's own realized rate. A hedge, not a bet.",
};

export default function MarketsPage() {
  return <MarketsView />;
}
