// Canonical registry of REAL stablecoins across every chain we support, with
// testnet AND mainnet addresses. USD (USDC, USDT, PYUSD), EUR (EURC), and Global
// South (cNGN, more to come). This is the source of truth to wire the app's token
// set + balances + swaps to; it is NOT yet the app's live token map (that
// migration is deliberate, especially on mainnet — verify every address on the
// chain's official explorer before any mainnet use).
//
// Sources (fetched, authoritative):
// - USDC / EURC: Circle — developers.circle.com/stablecoins/{usdc,eurc}-contract-addresses
// - USDT: Tether via chain explorers (Arbitrum/Polygon are the USDT0 LayerZero form)
// - PYUSD: Paxos/PayPal (github.com/paxosglobal/pyusd-contract, arbiscan, solscan)
// - cNGN: official repo github.com/wrappedcbdc/stablecoin-cngn
//
// `testnet` addresses: USDC/EURC (Circle) and cNGN have official testnet tokens;
// USDT and PYUSD have NO official testnet issuance, so their `testnet` is omitted.

import type { CurrencyCode } from "../money";

export type StablecoinRegion = "usd" | "eur" | "africa";

export type StablecoinMeta = {
  symbol: string;
  name: string;
  fiat: CurrencyCode;
  region: StablecoinRegion;
  issuer: string;
};

/** Per canonical chain: the mainnet and/or testnet token address. */
export type ChainAddresses = { mainnet?: string; testnet?: string; note?: string };

export type StablecoinEntry = {
  meta: StablecoinMeta;
  /** chainKey -> addresses. chainKey matches the EVM registry where one exists. */
  chains: Record<string, ChainAddresses>;
};

export const STABLECOIN_REGISTRY: Record<string, StablecoinEntry> = {
  USDC: {
    meta: { symbol: "USDC", name: "USD Coin", fiat: "USD", region: "usd", issuer: "Circle" },
    chains: {
      ethereum: {
        mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        testnet: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia
      },
      base: {
        mainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        testnet: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
      },
      arbitrum: {
        mainnet: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        testnet: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia
      },
      optimism: {
        mainnet: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        testnet: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7", // OP Sepolia
      },
      polygon: {
        mainnet: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
        testnet: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // Amoy
      },
      celo: {
        mainnet: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
        testnet: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", // Celo Sepolia
      },
      solana: {
        mainnet: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        testnet: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Devnet
      },
    },
  },

  USDT: {
    meta: { symbol: "USDT", name: "Tether USD", fiat: "USD", region: "usd", issuer: "Tether" },
    chains: {
      ethereum: { mainnet: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
      optimism: { mainnet: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" },
      polygon: { mainnet: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
      arbitrum: {
        mainnet: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        note: "USDT0 (LayerZero OFT form on Arbitrum)",
      },
    },
  },

  PYUSD: {
    meta: { symbol: "PYUSD", name: "PayPal USD", fiat: "USD", region: "usd", issuer: "Paxos / PayPal" },
    chains: {
      ethereum: { mainnet: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8" },
      arbitrum: { mainnet: "0x46850aD61C2B7d64d08c9C754F45254596696984" },
      solana: { mainnet: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo" },
    },
  },

  EURC: {
    meta: { symbol: "EURC", name: "Euro Coin", fiat: "EUR", region: "eur", issuer: "Circle" },
    chains: {
      ethereum: {
        mainnet: "0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c",
        testnet: "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4", // Sepolia
      },
      base: {
        mainnet: "0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42",
        testnet: "0x808456652fdb597867f38412077A9182bf77359F", // Base Sepolia
      },
      avalanche: {
        mainnet: "0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD",
        testnet: "0x5E44db7996c682E92a960b65AC713a54AD815c6B", // Fuji
      },
      solana: {
        mainnet: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
        testnet: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", // Devnet (same mint)
      },
    },
  },

  cNGN: {
    meta: { symbol: "cNGN", name: "Compliant Naira", fiat: "NGN", region: "africa", issuer: "Convexity / WrappedCBDC" },
    chains: {
      ethereum: {
        mainnet: "0x17CDB2a01e7a34CbB3DD4b83260B05d0274C8dab",
        testnet: "0x0b2b22cCfd95B1Ff2De52F192749986385B1a6b6",
      },
      base: {
        mainnet: "0x46C85152bFe9f96829aA94755D9f915F9B10EF5F",
        testnet: "0xe2387F04d3858e7Cb64Ef5Ed6617f9B2fcEEAfa2",
      },
      polygon: {
        mainnet: "0x52828daa48C1a9A06F37500882b42daf0bE04C3B",
        testnet: "0x995Ba562E513a22122C499622b193C91b32E2A28",
      },
      bnb: {
        mainnet: "0xa8AEA66B361a8d53e8865c62D142167Af28Af058",
        testnet: "0x8a078b182bA9649c03982c2a80CDcc81cdc99dA8",
      },
      celo: {
        mainnet: "0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f",
        testnet: "0xa188439ccCEe9A6aa0E842f9c17C1b00C7B4dd4D",
      },
      arc: {
        testnet: "0x3afDf1831D1FFe96093533aF81120A903DAf0bE0", // official cNGN Arc testnet
      },
      assetchain: {
        mainnet: "0x7923C0f6FA3d1BA6EAFCAedAaD93e737Fd22FC4F",
        testnet: "0x1Aa7635b7ac3E59D2a654052F95feA6e1CeeB00F",
      },
      lisk: {
        mainnet: "0xC7aB2C35Ea37236e644C24A4E4a1911c082887c0",
        testnet: "0x9a9c18A371d98200FE910f62c45875f1abb68d20",
      },
      solana: {
        mainnet: "3jiqwBQVRC5zRwHyqvnkQurebJ5RNxg3F5fXMwaxgkv8",
        testnet: "HfJWS8vJHvxKn5xW3uLXkTmEy4jny3G45QnS1Eab5sg",
      },
      stellar: {
        mainnet: "GD6G2NT7CQHPIYHA52KZHWB6ONNWTSGZOOLTRLRASENM2VWSF6CHYFRX",
        testnet: "GAE7E56N3XIC6JGJI54SD3VN4EDY3OZVFA7CLHXAMMTHLU4LIFYJMFSI",
        note: "Bantu / Stellar (not EVM)",
      },
    },
  },
};

/** All stablecoins that have an address on `chainKey` for `network`. */
export function stablecoinsOnChain(
  chainKey: string,
  network: "mainnet" | "testnet",
): { symbol: string; meta: StablecoinMeta; address: string; note?: string }[] {
  const out: { symbol: string; meta: StablecoinMeta; address: string; note?: string }[] = [];
  for (const [symbol, entry] of Object.entries(STABLECOIN_REGISTRY)) {
    const addr = entry.chains[chainKey]?.[network];
    if (addr) out.push({ symbol, meta: entry.meta, address: addr, note: entry.chains[chainKey]?.note });
  }
  return out;
}

/** One stablecoin's address on a chain/network, or undefined. */
export function stablecoinAddress(
  symbol: string,
  chainKey: string,
  network: "mainnet" | "testnet",
): string | undefined {
  return STABLECOIN_REGISTRY[symbol]?.chains[chainKey]?.[network];
}

/** Map an app EVM chain key (e.g. "arbitrum-sepolia") to a registry chain key. */
export function registryChainKey(appChainKey: string): string {
  if (appChainKey === "sepolia") return "ethereum"; // app's Ethereum Sepolia
  return appChainKey.replace(/-(sepolia|testnet|amoy)$/, "");
}

/** Real EVM stablecoins for an app chain, by its key + testnet flag. */
export function realStablecoinsForAppChain(
  appChainKey: string,
  testnet: boolean,
): { symbol: string; fiat: CurrencyCode; address: `0x${string}`; note?: string }[] {
  const network = testnet ? "testnet" : "mainnet";
  return stablecoinsOnChain(registryChainKey(appChainKey), network)
    .filter((s) => s.address.startsWith("0x")) // EVM only (skip Solana / Stellar)
    .map((s) => ({
      symbol: s.symbol,
      fiat: s.meta.fiat,
      address: s.address as `0x${string}`,
      note: s.note,
    }));
}
