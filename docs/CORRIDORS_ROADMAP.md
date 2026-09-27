# Corridors roadmap — first 5 countries (draft)

Goal: five countries where anyone can send to anyone (any-to-any), in local
currency, with local cash-out. Nigeria, Ghana and Kenya first (their stablecoins
are already deployed), then Uganda and Tanzania (mobile-money-first, strong
remittance corridors).

> Status: **draft for review**, not a commitment. Money-movement and licensing
> decisions here need your sign-off (and counsel for the regulated parts).

## The five

| # | Country | Currency | Local stable | Primary cash-out | Notes |
|---|---------|----------|--------------|------------------|-------|
| 1 | Nigeria | NGN | cNGN ✅ deployed | Bank transfer (NUBAN), mobile money | Biggest market; bank-transfer-first. Paystack/Flutterwave for payout + name resolution. |
| 2 | Ghana | GHS | cGHS ✅ deployed | MTN MoMo, bank | Mobile-money-dominant. MTN MoMo + Flutterwave. |
| 3 | Kenya | KES | cKES ✅ deployed | M-Pesa, bank | M-Pesa is the rail. Safaricom Daraja / Flutterwave. |
| 4 | Uganda | UGX | cUGX (to deploy) | MTN/Airtel MoMo | Mobile-money-first. |
| 5 | Tanzania | TZS | cTZS (to deploy) | M-Pesa/Tigo/Airtel MoMo | Mobile-money-first. |

Alternatives to consider swapping in: **South Africa (ZAR)** (largest economy,
bank-first) or **Côte d'Ivoire/Senegal (XOF)** (Francophone, Wave/Orange Money).

## On-chain addresses (Arc mainnet, chain `5042`)

Every corridor settles on **Arc mainnet** (chain id `5042`, RPC
`https://rpc.mainnet.arc.io`), where **USDC is the native gas token** (predeploy
`0x3600000000000000000000000000000000000000`). A corridor is a `USDC ↔ cXXX`
pair priced by the shared oracle and netted by the shared matcher — so the only
per-corridor address is the local stablecoin. Canonical source of truth:
`ARC_SUBMISSION.md` (deployed 2026-09-27).

**Shared across all corridors:**

| Contract | Address (Arc `5042`) |
|---|---|
| RealizedRateOracle | `0x48484e904EA964a649D0c73666bA1E91d3Ca2349` |
| IntentMatcher (P2P netting) | `0x5f7Cb34cA29d0554998882B716DC86e0B764f206` |
| PredictionMarket (hedge) | `0xe9f109b826de37A6481eAfC60985B5b36763558B` |
| USDC (native gas predeploy) | `0x3600000000000000000000000000000000000000` |

**Per corridor (the `cXXX` local stable):**

| Corridor | Currency | Chain | Local stable (`cXXX`) address | Status |
|---|---|---|---|---|
| USD → Nigeria | NGN | Arc `5042` | `0xE76E4f347667d973a1B968733bE41738f2AE202C` | ✅ live |
| USD → Ghana | GHS | Arc `5042` | `0xb3387B3cCAd4ef68e0c348735daA1C306D17C004` | ✅ live |
| USD → Kenya | KES | Arc `5042` | `0x6616D69AcbB9fe9Ef630171C069CC069a0d8464f` | ✅ live |
| USD → Uganda | UGX | Arc `5042` | (to deploy — mirror `DeployArc.s.sol`) | ⏳ not deployed |
| USD → Tanzania | TZS | Arc `5042` | (to deploy) | ⏳ not deployed |

The same contracts are also live on **Arc testnet** (chain `5042002`) at the
identical addresses (deterministic deploy). To go live, each `cXXX` address is
wired into the frontend registry as `NEXT_PUBLIC_ARC_TOKEN_<CCY>` (build-time) so
`liveQuote`/`sendCorridor` pick the pool by the recipient's currency.

## What "a corridor works" requires (per country)

1. **Local stablecoin** `cXXX` (ERC-20) on the hub chain. NGN/GHS/KES done; UGX/TZS
   to deploy (same token contract as the Arc deploy).
2. **A liquidity venue** so USDC ↔ cXXX can price and settle. Two options — pick
   ONE architecture for all corridors (see below).
3. **A realized-rate oracle entry** (XXX per USD) so quotes are honest and fixed
   before send.
4. **Cash-out rails**: a payout provider that reaches that country's banks +
   mobile money, with account-name resolution where possible.
5. **Frontend wiring**: the corridor token + pool + rails registered so
   `liveQuote`/`sendCorridor` pick the right pool by recipient currency (today
   they're hardcoded to USDC→cNGN).

## The one architecture decision (blocking)

Your stack has two settlement mechanisms; the corridors must standardise on one:

- **A) Uniswap v4 pools** (`PoolManager` + `swapRouter`): a USDC/cXXX pool per
  currency. Simple to quote/swap, but **you must seed real liquidity** in each
  pool (capital per corridor), and thin pools mean slippage.
- **B) IntentMatcher P2P netting** (already on Arc mainnet): senders and
  receivers net against each other, USDC only bridges the imbalance. Far more
  capital-efficient (the "cheaper as more people join" moat), but needs a solver
  and enough two-sided flow to net against.

Recommendation: **B (IntentMatcher) as the core**, with **A (a shallow USDC/cXXX
pool) only as the fallback** for imbalance — this matches the thesis and minimises
locked capital. Confirm this and I'll generalise the frontend accordingly.

## Deploy steps for a new corridor (you run these — mainnet, real funds)

Once the architecture is fixed, each corridor is:

```bash
# From contracts/evm, with contracts/.env holding the mainnet PRIVATE_KEY.
# 1. Deploy the local stable (skip for NGN/GHS/KES — already live).
#    (mirror the token deploy in DeployArc.s.sol for cUGX / cTZS)

# 2. Register the corridor: set the oracle rate (XXX per USD) and, for option A,
#    create + seed the USDC/cXXX pool. (A DeployCorridor.s.sol script — I can
#    draft it once we pick A vs B.)
forge script script/DeployCorridor.s.sol --rpc-url arc --broadcast --slow
```

> I did NOT write/run this script yet: it initiates real on-chain state and
> liquidity, and the deploy is gated on my side. Confirm the architecture and
> I'll draft `DeployCorridor.s.sol` + the exact commands for you to execute.

## Frontend generalisation (I can do this now, no funds)

Independent of the chain work, I can make the app corridor-agnostic:
- Move the single hardcoded USDC/cNGN pool in `chain/contracts.ts` to a
  per-currency map (`tokens.NGN/GHS/KES/…` already exist in the registry).
- Generalise `liveQuote.ts` + `sendCorridor.ts` to pick the pool/token by the
  recipient's `receiveCurrency` instead of NGN.
- Result: the moment a corridor's pool/oracle exists on-chain, the app lights it
  up — no further frontend change.

Say the word and I'll do the frontend generalisation while you line up the
liquidity/architecture decision.

## Payout providers by country (cash-out)

| Country | Bank | Mobile money | Provider options |
|---------|------|--------------|------------------|
| Nigeria | ✅ | limited | Paystack, Flutterwave |
| Ghana | ✅ | MTN MoMo | Flutterwave, MTN MoMo API |
| Kenya | ✅ | M-Pesa | Flutterwave, Safaricom Daraja |
| Uganda | ✅ | MTN/Airtel | Flutterwave |
| Tanzania | ✅ | M-Pesa/Tigo/Airtel | Flutterwave |

Flutterwave covers all five for a single integration; add M-Pesa (Daraja) and
MTN MoMo directly later for better rates where volume justifies it.
