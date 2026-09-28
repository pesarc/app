"use client";

// Unified network selection: the EVM chains from the registry PLUS Solana, as
// ONE list the money flows (Send / Swap / Receive / Pay) switch between.
//
// This is a thin wrapper over the existing per-venue state:
//   - EVM selection delegates to useActiveEvmChain()/setChainKey (unchanged).
//   - Selecting Solana writes the "solana" key into the SAME active-chain-key
//     store, which flips markets.venue's svmSelected()/activeVenue() to the SVM
//     venue and lets the flows fall to their demo/simulated path.
//
// It is chain SELECTION only — it never touches the EVM execution path
// (sendCorridor / executeCorridorSend), the contracts, or corridor settlement.

import { useActiveEvmChain } from "./activeChain";
import { allChains, getActiveChainKey } from "./registry";
import { svmConfig } from "../svm/config";

/** The active-chain-key value that selects the Solana (SVM) venue. */
export const SOLANA_NETWORK_KEY = "solana";

export type NetworkKind = "evm" | "svm";

export type NetworkOption = {
  key: string;
  label: string;
  kind: NetworkKind;
  testnet: boolean;
};

/** True when a stored active-chain key selects the Solana (SVM) venue. */
export function isSvmKey(key: string | null | undefined): boolean {
  const k = (key || "").toLowerCase();
  return k.startsWith("solana") || k.startsWith("svm");
}

export type ActiveNetwork = {
  /** Every selectable network: all EVM chains + Solana. */
  networks: NetworkOption[];
  /** The network currently selected. */
  active: NetworkOption;
  activeKey: string;
  /** True when Solana is the active network (EVM execution must not run). */
  isSvm: boolean;
  /** Select a network by key (EVM chain key or SOLANA_NETWORK_KEY). */
  setNetwork: (key: string) => void;
};

export function useActiveNetwork(): ActiveNetwork {
  const { chain, setChainKey } = useActiveEvmChain();

  const svm = svmConfig();
  const solana: NetworkOption = {
    key: SOLANA_NETWORK_KEY,
    label: svm.label,
    kind: "svm",
    testnet: svm.cluster !== "mainnet-beta",
  };

  const networks: NetworkOption[] = [
    ...allChains().map((c) => ({
      key: c.key,
      label: c.label,
      kind: "evm" as const,
      testnet: c.testnet,
    })),
    solana,
    // TODO: a non-EVM/non-SVM home (e.g. Algorand) would push its NetworkOption
    // here and route through its own adapter/venue; not implemented yet.
  ];

  // The registry override is the source of truth for which venue is live. When
  // it holds a Solana key, activeChain() falls back to an EVM chain for reads,
  // so we detect SVM from the raw stored key rather than from chain.key. The
  // read is reactive because setChainKey re-renders this hook's consumer.
  const rawKey = getActiveChainKey();
  const isSvm = isSvmKey(rawKey);
  const activeKey = isSvm ? SOLANA_NETWORK_KEY : chain.key;
  const active = networks.find((n) => n.key === activeKey) ?? networks[0];

  // Both EVM and SVM keys go through the same setter: it persists the choice,
  // syncs the registry override synchronously, and re-renders the tree.
  const setNetwork = (key: string) => setChainKey(key);

  return { networks, active, activeKey, isSvm, setNetwork };
}
