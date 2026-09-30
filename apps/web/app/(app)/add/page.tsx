"use client";

// Add money: two minimal options. Bank transfer (a payout account via BVN), and
// Crypto (deposit to your wallet address; the balance reflects it automatically).

import { useState } from "react";
import { Segmented } from "@/components/app/ui";
import FaucetCard from "@/components/app/FaucetCard";
import BankAccountPanel from "@/components/app/bank/BankAccountPanel";
import CryptoDeposit from "@/components/app/CryptoDeposit";

export default function AddMoneyPage() {
  const [method, setMethod] = useState<"bank" | "crypto">("bank");

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink mb-1.5">Add money</h1>
      <p className="text-slate mb-5">
        Top up from your bank, or deposit crypto straight to your wallet.
      </p>

      <div className="mb-5">
        <Segmented
          value={method}
          onChange={setMethod}
          options={[
            { value: "bank", label: "Bank transfer" },
            { value: "crypto", label: "Crypto" },
          ]}
          aria-label="Deposit method"
        />
      </div>

      {method === "bank" && <BankAccountPanel />}

      {method === "crypto" && (
        <div className="space-y-4">
          <FaucetCard />
          <CryptoDeposit />
        </div>
      )}
    </div>
  );
}
