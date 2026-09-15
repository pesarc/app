import type { Metadata } from "next";
import EarnFlow from "@/components/app/earn/EarnFlow";

export const metadata: Metadata = {
  title: "Earn",
  description:
    "Provide liquidity to a corridor and earn swap fees with bounded, insured risk. One unified position across chains — withdraw anytime.",
};

export default function EarnPage() {
  return <EarnFlow />;
}
