"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toViemAccount, useWallets } from "@privy-io/react-auth";
import {
  createSmartWalletClient,
  alchemyWalletTransport,
} from "@alchemy/wallet-apis";
import { encodeFunctionData, type LocalAccount } from "viem";
import { HUB_CHAIN } from "@pesarc/sdk/chain/chains";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { erc20Abi } from "@pesarc/abi";
import { isSmartWalletConfigured } from "./config";
import { getGasSponsor } from "./gasSponsor";

export type Call = {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
};

export type SmartWallet = {
  ready: boolean;
  address?: `0x${string}`;
  error?: string;
  /** Gasless ERC-20 transfer. Returns the settled tx hash. */
  sendErc20: (
    token: `0x${string}`,
    to: `0x${string}`,
    amount: bigint
  ) => Promise<string | undefined>;
  /** Gasless batched calls (e.g. approve + swap in one user op). */
  sendCalls: (calls: Call[]) => Promise<string | undefined>;
};

const noop: SmartWallet = {
  ready: false,
  sendErc20: async () => {
    throw new Error("Smart wallet not available");
  },
  sendCalls: async () => {
    throw new Error("Smart wallet not available");
  },
};

const SmartWalletContext = createContext<SmartWallet | null>(null);

/**
 * Live smart wallet (Alchemy "Privy signer" pattern). MUST render inside a
 * PrivyProvider — it calls Privy hooks. Privy embedded wallet -> viem
 * LocalAccount -> Alchemy SmartWalletClient with Gas Manager sponsorship
 * (EIP-7702, no separate deploy).
 */
export function LiveSmartWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { wallets } = useWallets();
  const [signer, setSigner] = useState<LocalAccount>();
  const [error, setError] = useState<string>();

  const embedded = useMemo(
    () => wallets?.find((w) => w.walletClientType === "privy") ?? wallets?.[0],
    [wallets]
  );

  useEffect(() => {
    if (!isSmartWalletConfigured || !embedded || signer) return;
    let active = true;
    toViemAccount({ wallet: embedded })
      .then((a) => active && setSigner(a as LocalAccount))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [embedded, signer]);

  // The smart wallet follows the in-session active EVM chain so staking targets
  // whichever chain the user has selected.
  const { chain: activeEvm } = useActiveEvmChain();

  const client = useMemo(() => {
    if (!signer) return null;
    // The gas sponsor is resolved per chain by the seam (gasSponsor.ts).
    const sponsor = getGasSponsor(activeEvm.key);
    if (sponsor.kind === "alchemy") {
      try {
        return createSmartWalletClient({
          signer,
          transport: alchemyWalletTransport({ apiKey: sponsor.apiKey }),
          chain: activeEvm.chain,
          paymaster: { policyId: sponsor.policyId },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    }
    if (sponsor.kind === "erc7677") {
      // Arc / Circle / in-house path: a standard ERC-4337 client pointed at the
      // bundler + the ERC-7677 paymaster service. Deliberately not constructed
      // here until it can be integration-tested on Arc (money path, fail-closed
      // rule). Circle (fast) or the in-house paymaster (survivable) both drop in
      // here — see docs/GAS_SPONSORSHIP.md for the exact client wiring.
      if (typeof console !== "undefined") {
        console.warn(
          `[smart-wallet] ERC-7677 sponsor (${sponsor.provider}) resolved for ${activeEvm.key} but the AA client is not wired yet — see docs/GAS_SPONSORSHIP.md`,
        );
      }
      return null;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, activeEvm.chain.id, activeEvm.key]);

  const sendCalls = useCallback(
    async (calls: Call[]) => {
      if (!client) throw new Error("Smart wallet not ready");
      const { id } = await client.sendCalls({
        calls: calls.map((c) => ({
          to: c.to,
          value: c.value ?? BigInt(0),
          data: c.data,
        })),
      });
      const result = await client.waitForCallsStatus({ id });
      return result.receipts?.[0]?.transactionHash as string | undefined;
    },
    [client]
  );

  const sendErc20 = useCallback(
    async (token: `0x${string}`, to: `0x${string}`, amount: bigint) => {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, amount],
      });
      return sendCalls([{ to: token, data }]);
    },
    [sendCalls]
  );

  const value = useMemo<SmartWallet>(
    () => ({
      ready: Boolean(client),
      address: signer?.address as `0x${string}` | undefined,
      error,
      sendErc20,
      sendCalls,
    }),
    [client, signer, error, sendErc20, sendCalls]
  );

  return (
    <SmartWalletContext.Provider value={value}>
      {children}
    </SmartWalletContext.Provider>
  );
}

/** Mock provider for when Privy/Alchemy aren't configured. */
export function MockSmartWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SmartWalletContext.Provider value={noop}>
      {children}
    </SmartWalletContext.Provider>
  );
}

export function useSmartWallet(): SmartWallet {
  return useContext(SmartWalletContext) ?? noop;
}
