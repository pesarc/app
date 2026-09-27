import type { Metadata } from "next";
import AgentChat from "@/components/app/agent/AgentChat";

export const metadata: Metadata = {
  title: "Pesarc agent",
  description:
    "Just ask. Tell the Pesarc agent what you need in plain language — send money, pay a bill, top up airtime — and it settles in your own currency in seconds.",
};

export default function AgentPage() {
  return <AgentChat />;
}
