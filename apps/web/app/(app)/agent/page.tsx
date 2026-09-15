import type { Metadata } from "next";
import AgentChat from "@/components/app/agent/AgentChat";

export const metadata: Metadata = {
  title: "Settlement agent",
  description:
    "Tell the StableArc agent what to send in plain language; it settles it peer-to-peer in local currency on Celo, with no US dollar in the path.",
};

export default function AgentPage() {
  return <AgentChat />;
}
