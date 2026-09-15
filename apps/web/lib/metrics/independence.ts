// Independence metrics (docs/LOCAL_CURRENCY_SETTLEMENT.md §6).
//
//   dollar_touched = value that actually crossed USD/USDC ÷ total settled
//   dollar_priced  = value priced off a USD-referenced feed ÷ total settled
//
// Both are computed from on-chain events — nothing self-reported. The second
// outlives the first: you can settle without a dollar and still *price* off
// one, which is the dependency §5 is about.
//
// Methodology, stated plainly so the number is auditable:
//  • Local settlements (IntentMatcher) touch no USD — no pool, no bridge.
//  • CCTP corridor deposits (HubBridgeReceiver) cross real USDC.
//  • Volume counts payments *delivered*: each leg of a match/ring is one
//    person's payment, so a 2-party match is two payments and a 3-ring is three.
//  • Everything is valued in USD-equivalent purely as an **accounting
//    numeraire** — pricing a number in USD while moving zero dollars is the
//    §2.3 distinction, not a contradiction.
//  • A settled pair counts as self-priced once the RealizedRateOracle carries
//    its rate; until then that corridor is still bootstrapped off a
//    USD-referenced cross-rate and counts as dollar-priced.

import { formatUnits, parseAbiItem } from "viem";
import { getLogsClient } from "@/lib/chain/chains";
import { CONTRACTS } from "@/lib/chain/contracts";
import { intentMatcherAbi, realizedRateOracleAbi } from "@/lib/chain/abi/intentMatcher";
import { fetchUsdRate } from "@/lib/oracle/fx";
import { currencyByAddress, localCurrencies } from "@/lib/chain/localCorridors";
import { HUB_BRIDGE_RECEIVER } from "@/lib/chain/corridors";

export type Independence = {
  /** USD-equivalent value settled with no dollar in the path. */
  localValueUsd: number;
  /** USD-equivalent value that crossed USDC (CCTP corridors). */
  usdValueUsd: number;
  totalValueUsd: number;
  /** 0–1. Lower is more independent. */
  dollarTouched: number;
  /** 0–1. Lower is more independent. Outlives dollarTouched. */
  dollarPriced: number;
  /** Payments settled with zero USD. */
  localSettlements: number;
  /** Corridor pairs now priced from our own realized flow. */
  selfPricedPairs: string[];
  /** Corridor pairs still bootstrapped off a USD-referenced rate. */
  usdPricedPairs: string[];
  asOf: string;
};

const MATCHED = parseAbiItem(
  "event IntentsMatched(uint256 indexed idA, uint256 indexed idB, address tokenA, address tokenB, uint128 fillA, uint128 fillB, uint256 rate1e18)",
);
const RING = parseAbiItem("event RingMatched(uint256[] ids, uint128[] fills)");
const DEPOSIT = parseAbiItem(
  "event DepositProcessed(uint32 indexed sourceDomain, address indexed recipient, uint256 usdcAmount6, uint256 usdOut18, uint256 ngnOut18, bytes32 reference_)",
);

/** USD per 1 unit of a local currency, from the live FX keeper source. */
async function usdValueOf(code: string): Promise<number> {
  if (code === "USD") return 1;
  const fx = await fetchUsdRate(code); // units of `code` per USD
  return fx.rate > 0 ? 1 / fx.rate : 0;
}

export async function computeIndependence(): Promise<Independence> {
  const client = getLogsClient();
  // Scan from the matcher's deploy block: from the hub's block this is a
  // ~3.7M-block range, which providers reject outright.
  const fromBlock = CONTRACTS.matcherDeployBlock || CONTRACTS.deployBlock;
  const asOf = new Date().toISOString();

  // USD-equivalent value of each local currency (accounting only).
  const currencies = localCurrencies();
  const unitUsd = new Map<string, number>();
  await Promise.all(
    currencies.map(async (c) => unitUsd.set(c.code, await usdValueOf(c.code))),
  );

  let localValueUsd = 0;
  let localSettlements = 0;
  const pairsSeen = new Set<string>();

  const valueOf = (token: string, raw: bigint): number => {
    const c = currencyByAddress(token);
    if (!c) return 0;
    return Number(formatUnits(raw, 18)) * (unitUsd.get(c.code) ?? 0);
  };

  if (CONTRACTS.intentMatcher) {
    const matcher = CONTRACTS.intentMatcher as `0x${string}`;

    // 2-party matches: each side delivered one payment.
    const matched = await client.getLogs({ address: matcher, event: MATCHED, fromBlock });
    for (const log of matched) {
      const a = log.args as {
        tokenA: string;
        tokenB: string;
        fillA: bigint;
        fillB: bigint;
      };
      localValueUsd += valueOf(a.tokenA, a.fillA) + valueOf(a.tokenB, a.fillB);
      localSettlements += 2;
      const ca = currencyByAddress(a.tokenA)?.code;
      const cb = currencyByAddress(a.tokenB)?.code;
      if (ca && cb) pairsSeen.add([ca, cb].sort().join("/"));
    }

    // Rings: fills are per-intent, so look up each intent's tokenIn.
    const rings = await client.getLogs({ address: matcher, event: RING, fromBlock });
    for (const log of rings) {
      const { ids, fills } = log.args as { ids: readonly bigint[]; fills: readonly bigint[] };
      const rows = await Promise.all(
        ids.map(
          (id) =>
            client.readContract({
              address: matcher,
              abi: intentMatcherAbi,
              functionName: "intents",
              args: [id],
            }) as Promise<readonly [string, string, string, string, bigint, bigint, bigint, bigint, boolean]>,
        ),
      );
      rows.forEach((r, i) => {
        localValueUsd += valueOf(r[2], fills[i]);
        localSettlements += 1;
        const cin = currencyByAddress(r[2])?.code;
        const cout = currencyByAddress(r[3])?.code;
        if (cin && cout) pairsSeen.add([cin, cout].sort().join("/"));
      });
    }
  }

  // CCTP corridor deposits — these crossed real USDC.
  let usdValueUsd = 0;
  if (HUB_BRIDGE_RECEIVER) {
    // Deposits predate the matcher — scan from the bridge's own deploy block
    // or dollar-touched volume gets under-reported.
    const deposits = await client.getLogs({
      address: HUB_BRIDGE_RECEIVER,
      event: DEPOSIT,
      fromBlock: CONTRACTS.bridgeDeployBlock || CONTRACTS.deployBlock,
    });
    for (const log of deposits) {
      const { usdcAmount6 } = log.args as { usdcAmount6: bigint };
      usdValueUsd += Number(formatUnits(usdcAmount6, 6));
    }
  }

  // Which corridors now price themselves off our own realized flow?
  const selfPricedPairs: string[] = [];
  const usdPricedPairs: string[] = [];
  if (CONTRACTS.realizedRateOracle) {
    const oracle = CONTRACTS.realizedRateOracle as `0x${string}`;
    for (const pair of pairsSeen) {
      const [x, y] = pair.split("/");
      const cx = currencies.find((c) => c.code === x);
      const cy = currencies.find((c) => c.code === y);
      if (!cx || !cy) continue;
      const has = await client
        .readContract({
          address: oracle,
          abi: realizedRateOracleAbi,
          functionName: "hasData",
          args: [cx.address, cy.address],
        })
        .catch(() => false);
      (has ? selfPricedPairs : usdPricedPairs).push(pair);
    }
  }

  const totalValueUsd = localValueUsd + usdValueUsd;
  // Local volume on a corridor with no realized rate yet was bootstrapped off
  // a USD-referenced cross-rate — zero dollars moved, but a dollar priced it.
  const localUsdPricedShare =
    pairsSeen.size === 0 ? 0 : usdPricedPairs.length / pairsSeen.size;
  const dollarPricedValue = usdValueUsd + localValueUsd * localUsdPricedShare;

  return {
    localValueUsd,
    usdValueUsd,
    totalValueUsd,
    dollarTouched: totalValueUsd === 0 ? 0 : usdValueUsd / totalValueUsd,
    dollarPriced: totalValueUsd === 0 ? 0 : dollarPricedValue / totalValueUsd,
    localSettlements,
    selfPricedPairs,
    usdPricedPairs,
    asOf,
  };
}
