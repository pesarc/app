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
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  type LocalAccount,
  type WalletClient,
} from "viem";
import { HUB_CHAIN } from "@pesarc/sdk/chain/chains";
import { useActiveEvmChain } from "@pesarc/sdk/chain/activeChain";
import { erc20Abi } from "@pesarc/abi";
import { isSmartWalletConfigured } from "./config";
import { getGasSponsor } from "./gasSponsor";
import { buildErc7677Client, type Erc7677SmartClient } from "./erc7677Client";

export type Call = {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
};

/** EOA-direct send path for a connected external wallet (no smart account). */
type EoaClient = { address: `0x${string}`; wc: WalletClient };

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
  /** Grant a scoped session key (Alchemy path only). Returns the on-chain grant
   *  context to hand to the server. Undefined when the wallet can't grant. */
  grantSession?: (params: {
    key: { publicKey: `0x${string}`; type: "secp256k1" };
    permissions: unknown;
    expirySec: number;
  }) => Promise<{ context: `0x${string}` }>;
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

  // A connected EXTERNAL wallet (MetaMask etc.) — not the Privy embedded one.
  // On Arc we let it sign + pay its own gas (USDC is Arc's gas token) directly
  // from its EOA, instead of deriving a separate SimpleAccount it never funded —
  // so "what you fund is what the app spends". Embedded wallets keep the gasless
  // smart-account path below.
  const external = useMemo(
    () => wallets?.find((w) => w.walletClientType !== "privy" && w.address),
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

  const sponsor = getGasSponsor(activeEvm.key, activeEvm.chain.id);

  // EOA-direct path for a connected EXTERNAL wallet (MetaMask etc.) on EVERY
  // chain. An external wallet is a self-custodial EOA: it just signs and sends
  // its own transactions, paying gas from its own balance (USDC on Arc, ETH on
  // Arbitrum/Base Sepolia). It must NEVER be pushed through a smart-account
  // abstraction — the Alchemy path needs an EIP-7702 authorization that external
  // wallets cannot sign ("EIP-7702 authorization signing is not supported by
  // external wallets"), which is exactly what broke sends on the Alchemy-
  // sponsored testnets (Arbitrum/Base Sepolia). Keeping it EOA-direct everywhere
  // also gives the wallet ONE stable identity (its real address) across networks.
  // The EMBEDDED (Privy) wallet keeps the fully sponsored gasless path below.
  // Built in an effect because it needs the wallet's EIP-1193 provider.
  const useEoaDirect = Boolean(external);
  const [eoaClient, setEoaClient] = useState<EoaClient | null>(null);
  useEffect(() => {
    setEoaClient(null);
    if (!useEoaDirect || !external) return;
    let active = true;
    (async () => {
      const provider = await external.getEthereumProvider();
      const addr = external.address as `0x${string}`;
      const wc = createWalletClient({
        account: addr,
        chain: activeEvm.chain,
        transport: custom(provider as never),
      });
      // The chain switch happens at SEND time (in sendCalls), not here — the app
      // follows the wallet's chain (sync effect below), so on send the wallet is
      // already on the target chain and no popup is needed.
      if (active) setEoaClient({ address: addr, wc });
    })().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external, activeEvm.chain.id, activeEvm.key, useEoaDirect]);

  // The USER chooses the chain + token to send from (the in-app network/token
  // pickers are the source of truth). We deliberately do NOT force the app to
  // follow the wallet's current chain — that made every manual pick snap back to
  // whatever MetaMask was on. Instead the wallet is switched to the chosen chain
  // at SEND time (see sendCalls), right before it signs.

  // Alchemy path (testnets): the client is built synchronously.
  const alchemyClient = useMemo(() => {
    if (!signer || sponsor.kind !== "alchemy") return null;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, activeEvm.chain.id, activeEvm.key]);

  // ERC-7677 path (Arc / Circle / in-house): the smart account is derived from
  // the owner + factory, so the client is built asynchronously in an effect.
  // Only activates when a bundler URL is configured — never runs untested.
  const [erc7677Client, setErc7677Client] = useState<Erc7677SmartClient | null>(null);
  useEffect(() => {
    setErc7677Client(null);
    // Needs a bundler. A paymaster is optional: when absent (user-pays-gas mode),
    // the smart account pays its own gas in the chain's gas token (USDC on Arc).
    // Skipped entirely when the EOA-direct path is in use (external wallet on Arc).
    if (useEoaDirect || !signer || sponsor.kind !== "erc7677" || !sponsor.bundlerUrl) {
      return;
    }
    let active = true;
    buildErc7677Client({
      signer,
      chain: activeEvm.chain,
      bundlerUrl: sponsor.bundlerUrl,
      paymasterUrl: sponsor.paymasterUrl,
      paymasterContext: sponsor.context,
    })
      .then((c) => active && setErc7677Client(c))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signer, activeEvm.chain.id, activeEvm.key]);

  const client = alchemyClient ?? erc7677Client;

  const sendCalls = useCallback(
    async (calls: Call[]) => {
      // EOA-direct (external wallet, any chain): send each call as its own tx from
      // the user's own address; they sign in the wallet and pay gas from it (USDC
      // on Arc, ETH on Arbitrum/Base Sepolia). Make the wallet switch to the
      // target chain FIRST, before it signs, so the tx lands on the right network.
      if (eoaClient) {
        try {
          await eoaClient.wc.switchChain({ id: activeEvm.chain.id });
        } catch {
          throw new Error(
            `Switch your wallet to ${activeEvm.label} to send on this network.`,
          );
        }
        let hash: string | undefined;
        for (const c of calls) {
          hash = await eoaClient.wc.sendTransaction({
            account: eoaClient.address,
            to: c.to,
            data: c.data,
            value: c.value ?? BigInt(0),
            chain: activeEvm.chain,
          });
        }
        return hash;
      }
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
    [eoaClient, client, activeEvm.chain, activeEvm.label]
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

  // Session-key grant runs only on the Alchemy path (it's an Alchemy wallet-apis
  // feature). Scopes/caps are decided server-side; this just signs the grant.
  const grantSession = useCallback(
    async (params: { key: { publicKey: `0x${string}`; type: "secp256k1" }; permissions: unknown; expirySec: number }) => {
      if (!alchemyClient || !signer?.address) throw new Error("Session keys need the Alchemy wallet path.");
      const res = await alchemyClient.grantPermissions({
        account: signer.address as `0x${string}`,
        expirySec: params.expirySec,
        key: params.key,
        permissions: params.permissions,
      } as never);
      return { context: res.context as `0x${string}` };
    },
    [alchemyClient, signer]
  );

  // The address the user actually holds funds at and sends from. On the Alchemy
  // path (EIP-7702) the smart account IS the signer's EOA. On the ERC-7677 path
  // (Arc) it's a counterfactual SimpleAccount with a DIFFERENT address, so we must
  // report that one — otherwise balances, activity and "where to deposit" all read
  // the empty EOA instead of the real account.
  // EOA-direct reports the user's own address; otherwise the smart account.
  const smartAddress = (eoaClient?.address ?? erc7677Client?.address ?? signer?.address) as
    | `0x${string}`
    | undefined;

  const value = useMemo<SmartWallet>(
    () => ({
      ready: Boolean(client || eoaClient),
      address: smartAddress,
      error,
      sendErc20,
      sendCalls,
      grantSession: alchemyClient ? grantSession : undefined,
    }),
    [client, eoaClient, smartAddress, error, sendErc20, sendCalls, alchemyClient, grantSession]
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
