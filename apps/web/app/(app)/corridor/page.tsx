import type { Metadata } from "next";
import CorridorFlow from "@/components/app/corridor/CorridorFlow";

export const metadata: Metadata = {
  title: "Local corridor",
  description:
    "Send naira to cedis to shillings — matched peer-to-peer against real flow going the other way, settled in local currency with no dollar in the path.",
};

export default function CorridorPage() {
  return <CorridorFlow />;
}
