"use client";

// The /swap surface has two jobs: swap one currency into another (same rails you
// hold), and move an asset across the chains you support. One segmented control
// switches between them so it's all "swap" to the user.
import { useState } from "react";
import { Segmented } from "@/components/app/ui";
import SwapFlow from "./SwapFlow";
import CrossChainBridge from "@/components/app/CrossChainBridge";

export default function SwapTabs() {
  const [tab, setTab] = useState<"currencies" | "crosschain">("currencies");

  return (
    <div>
      <div className="mx-auto w-full max-w-md px-4 sm:px-6 pt-6 flex justify-center">
        <Segmented
          aria-label="Swap mode"
          value={tab}
          onChange={setTab}
          options={[
            { value: "currencies", label: "Currencies" },
            { value: "crosschain", label: "Cross-chain" },
          ]}
        />
      </div>

      {tab === "currencies" ? (
        <SwapFlow />
      ) : (
        <div className="mx-auto w-full max-w-md px-4 sm:px-6 py-6">
          <h1 className="text-[27px] font-extrabold tracking-tight text-harbor mb-4">
            Cross-chain
          </h1>
          <CrossChainBridge />
        </div>
      )}
    </div>
  );
}
