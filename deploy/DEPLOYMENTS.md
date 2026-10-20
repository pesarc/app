# Pesarc deployments — address source of truth

Single reference for every Pesarc address across chains. **Most of the protocol
is on testnet today**; the only Pesarc-owned address on a real mainnet is the
treasury (below). Keep this file updated whenever an address changes.

Verified on-chain 2026-10-20.

---

## 🏦 Arc mainnet (chain 5042) — LIVE

| What | Address | Notes |
|---|---|---|
| **Treasury / cash-out escrow** | `0xDE521099F3Bf2185aA90D0e186447c87B553eDBd` | Pesarc-controlled wallet; real USDC from cash-outs lands here (`NEXT_PUBLIC_RAMP_ESCROW`). EOA, not a contract. |
| Native USDC (Circle predeploy) | `0x3600000000000000000000000000000000000000` | Circle's, not ours. Gas token + ERC-20 (6 decimals). The asset the treasury holds. |
| Sender / ops wallet | `0xd4418f403F86De7DB7D1885d83A6d9A5bBf701F1` | personal MetaMask used for testing. **Not** the treasury. |

The treasury has two legs: this on-chain escrow (USDC) **+** the Bachs NGN
**float** (off-chain, held at the Bachs partner). The admin treasury view reports
both (`escrowUsdcBalances()` + `bachsBalances()`).

Explorer: https://explorer.arc.io

---

## 🧪 Testnet — Arbitrum Sepolia (chain 421614) — the live HUB

The hub pool, oracle, and settlement contracts run here (`NEXT_PUBLIC_HUB_CHAIN_ID=421614`).
Source: `luberty/contracts/deployments/frontend.421614.env`.

| Contract | Address |
|---|---|
| PoolManager | `0x48484e904EA964a649D0c73666bA1E91d3Ca2349` |
| Goldgard Hook | `0x0816F36c4C0cc61Ae80aD5e1De0720104d93C5C4` |
| SwapRouter | `0x15F12CC147484F7640dE6296c9D302802726A8dB` |
| LiquidityRouter | `0x416a7Cb5B9F29DCA866a113C1aD5318d2c0b1aE0` |
| SafetyModule | `0x5280987cAEbaADa7dE8D11a2CDDeC97157feDf10` |
| OracleAdapter | `0x6616D69AcbB9fe9Ef630171C069CC069a0d8464f` |
| StateView | `0x5f7Cb34cA29d0554998882B716DC86e0B764f206` |
| Token USD | `0x55C45Cb7C3b92a80bb548497f6Cd91aB45730621` |
| Token NGN | `0x88C6f8F6b06D0Cc1ef52Bf90deC172dd2aC41724` |
| FX Aggregator (push target) | `0xb3387B3cCAd4ef68e0c348735daA1C306D17C004` |
| Pool fee / tickSpacing | `8388608` / `60` |

---

## 🧪 Testnet — Arc Testnet (chain 5042002) — Goldgard hook stack

Source: `goldgard-hookathon/contracts/broadcast/DeployGoldgard.s.sol/5042002/run-latest.json`.

| Contract | Address |
|---|---|
| PoolManager | `0x4a7fd5855ed6820706f287b9bc152464556d800c` |
| GoldgardHook | `0xccee90ac636033934dc13f84e43d1c727ac005c4` |
| OracleAdapter | `0xb2503cbc2da5a66379167724eadaac3217e98c41` |
| SafetyModule | `0x5c0ee90755e2a202cac6b11f98eb2848acb4522b` |
| HedgeReserve | `0x562efb85c66066c670a3bd4fd9d26be90703ea67` |
| RewardDistributor | `0x3340973253caaaaab22624b15d75b1659b9704aa` |
| GoldgardCallbackReceiver | `0xd3a6c3f994816b44996ccfefdf11ca02983a753e` |
| MockAggregatorV3 | `0xf6022eb33a3ad954c5c8c4883d7c326b1596c97f` |

---

## Solana

| Program | Program ID | Cluster |
|---|---|---|
| realized_rate_oracle | `4NUdEu7crxzR1AtHhaiMLk4q1ctTvhZLREq7Pbt9KNkK` | localnet (Anchor.toml) — not mainnet-beta |

---

## Oracle feeds consumed (not ours)

- Chainlink Base-mainnet FX feeds (NGN/USD `0x74535Ecc46F5F1e1614b830b3B3cCdc08EF02482`, etc.) — see `packages/sdk/src/oracle/chainlink.ts`.

## Not yet on mainnet

No Arc-mainnet (5042) or Arbitrum-One (42161) **contract** deployment exists yet —
the hub lives on Arbitrum Sepolia. Pesarc mainnet is gated on an Arbitrum-mainnet
hub; the Arc Microgrant (RateLock) is the first thing targeting Arc mainnet.
