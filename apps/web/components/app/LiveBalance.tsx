"use client";

import { formatUnits } from "viem";
import { useWallet } from "@pesarc/sdk/wallet/WalletProvider";
import { useSmartWallet } from "@pesarc/sdk/wallet/smartWallet";
import { CONTRACTS } from "@pesarc/sdk/chain/contracts";
import { useErc20Balance } from "@pesarc/sdk/chain/useErc20Balance";

/**
 * Shows the live on-chain balances of the smart wallet in live mode
 * (test-USD headline + a cNGN subline once any has been received);
 * falls back to the simulated balance string otherwise.
 */
export function LiveBalance({ fallback }: { fallback: string }) {
  const { mode, authenticated } = useWallet();
  const smart = useSmartWallet();

  const live =
    mode === "live" &&
    authenticated &&
    Boolean(smart.address) &&
    Boolean(CONTRACTS.tokenUsd);

  const { data, loading } = useErc20Balance(
    live ? (CONTRACTS.tokenUsd as `0x${string}`) : undefined,
    live ? smart.address : undefined
  );
  const { data: ngn } = useErc20Balance(
    live && CONTRACTS.tokenNgn
      ? (CONTRACTS.tokenNgn as `0x${string}`)
      : undefined,
    live ? smart.address : undefined
  );

  if (!live) return <>{fallback}</>;
  if (!data) return <span className="opacity-70">{loading ? "…" : fallback}</span>;

  const human = Number(formatUnits(data.balance, data.decimals));
  const ngnHuman = ngn ? Number(formatUnits(ngn.balance, ngn.decimals)) : 0;
  return (
    <>
      {human.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
      <span className="text-[0.6em] align-middle opacity-80">{data.symbol}</span>
      {ngnHuman > 0 && (
        <div className="text-base font-medium text-white/85 mt-1 numerals">
          + ₦{ngnHuman.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
          <span className="text-xs opacity-80">{ngn?.symbol}</span>
        </div>
      )}
    </>
  );
}
