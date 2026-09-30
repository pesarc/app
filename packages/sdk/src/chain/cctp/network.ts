// One switch for "which CCTP network" so every layer (client burn, fee lookup,
// server relay) resolves the SAME contract pair, chain map and attestation host
// from a single `network` value. Mainnet uses Circle's production Iris; testnet
// uses the sandbox Iris. Keeps the two address books from ever crossing wires.
import {
  CCTP_MAINNET,
  TOKEN_MESSENGER_V2,
  MESSAGE_TRANSMITTER_V2,
  type CctpChain,
} from "./mainnet";
import {
  CCTP_TESTNET,
  TOKEN_MESSENGER_V2_TESTNET,
  MESSAGE_TRANSMITTER_V2_TESTNET,
} from "./testnet";

export type CctpNetwork = "mainnet" | "testnet";

export const isCctpNetwork = (v: unknown): v is CctpNetwork =>
  v === "mainnet" || v === "testnet";

export function cctpChains(network: CctpNetwork): Record<string, CctpChain> {
  return network === "testnet" ? CCTP_TESTNET : CCTP_MAINNET;
}

export function tokenMessengerV2(network: CctpNetwork): `0x${string}` {
  return network === "testnet" ? TOKEN_MESSENGER_V2_TESTNET : TOKEN_MESSENGER_V2;
}

export function messageTransmitterV2(network: CctpNetwork): `0x${string}` {
  return network === "testnet"
    ? MESSAGE_TRANSMITTER_V2_TESTNET
    : MESSAGE_TRANSMITTER_V2;
}

/** Circle's attestation host — production vs sandbox. */
export function irisBase(network: CctpNetwork): string {
  return network === "testnet"
    ? "https://iris-api-sandbox.circle.com"
    : "https://iris-api.circle.com";
}

export const cctpChainByDomain = (domain: number, network: CctpNetwork) =>
  Object.values(cctpChains(network)).find((c) => c.domain === domain);

export const cctpChainByKey = (key: string, network: CctpNetwork) =>
  cctpChains(network)[key];
