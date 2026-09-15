import type { Metadata } from "next";
import InvestView from "@/components/app/invest/InvestView";

export const metadata: Metadata = {
  title: "Invest",
  description:
    "Buy stocks and ETFs across African and global markets, priced and settled in local currency.",
};

export default function InvestPage() {
  return <InvestView />;
}
