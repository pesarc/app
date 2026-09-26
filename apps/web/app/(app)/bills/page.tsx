import type { Metadata } from "next";
import BillsFlow from "@/components/app/bills/BillsFlow";

export const metadata: Metadata = {
  title: "Bills",
  description:
    "Pay airtime, data, and electricity in a couple of taps. Gasless, settled in seconds, or ask the Pesarc agent to do it.",
};

export default function BillsPage() {
  return <BillsFlow />;
}
