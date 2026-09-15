# Multi-chain architecture

Pesarc's core primitives — the **prediction / hedge market**, the **P2P
local-currency liquidity** (IntentMatcher + RealizedRateOracle), and the
**bounded agent authority** (AgentSessionKeys) — are VM-portable. They deploy on
**any EVM chain** (Uniswap-style) and are being built to run natively on
**Solana** too, so the same product has a first-class home on both VMs.

## EVM: deploy on any chain

The Solidity suite is chain-agnostic (no chain-specific opcodes or addresses
baked in). To bring up a new EVM chain:

1. **Deploy the suite** with Foundry against that chain's RPC:
   ```bash
   # from contracts/evm
   forge script script/DeployPredictionMarket.s.sol --rpc-url <chain_rpc> --broadcast
   forge script script/Deploy.s.sol               --rpc-url <chain_rpc> --broadcast  # IntentMatcher + RealizedRateOracle
   forge script script/DeployAgentSessionKeys.s.sol --rpc-url <chain_rpc> --broadcast
   ```
2. **Register the chain in the app** — `packages/sdk/src/chain/registry.ts`:
   add the chain's `viem` definition and a literal `RAW` env block. (Env must be
   read as static `process.env.NEXT_PUBLIC_*` literals so Next inlines them into
   the client bundle — never `process.env[computed]`.)
3. **Set its addresses** in env under the chain's prefix:
   ```
   NEXT_PUBLIC_<PREFIX>_PREDICTION_MARKET=0x…
   NEXT_PUBLIC_<PREFIX>_REALIZED_ORACLE=0x…
   NEXT_PUBLIC_<PREFIX>_INTENT_MATCHER=0x…
   NEXT_PUBLIC_<PREFIX>_AGENT_SESSION_KEYS=0x…
   NEXT_PUBLIC_<PREFIX>_AGENT_KEY=0x…
   NEXT_PUBLIC_<PREFIX>_TOKEN_{NGN,KES,GHS,USD}=0x…
   ```
4. **(optional)** `NEXT_PUBLIC_ACTIVE_CHAIN=<key>` to make it the default the app
   reads. Otherwise the first configured chain wins.

Chains already in the catalog: `celo-sepolia`, `celo`, `base-sepolia`, `base`,
`arbitrum-sepolia`, `arbitrum`, `optimism`, `optimism-sepolia`, `polygon`,
`sepolia`, `ethereum`. The app reads the **active chain** via
`activeChain()` — `markets.live`, `agent-budget`, and the Markets header all go
through it, so adding a chain is config-only.

> Testnet-only today. No mainnet deploys or real funds until the contracts are
> audited (see CLAUDE.md).

## Solana + EVM: one product, two homes

The SVM programs live in the `contracts/svm` Anchor workspace:
`prediction-market`, `realized-rate-oracle`, `spoke-gateway`. The plan to make
Solana a first-class home (in progress):

- **VM-neutral SDK core.** `@pesarc/sdk` exposes the market + P2P surface behind
  one venue-neutral entry point (`markets.venue.ts`: `fetchLiveMarkets()` +
  `activeVenue()`), so the UI is identical whether the active home is an EVM
  chain (`viem`, via `chain/registry`) or Solana (`@solana/web3.js`, via
  `svm/`). Select the venue with `NEXT_PUBLIC_ACTIVE_CHAIN` (`solana*` → SVM).
- **Solana adapter (done).** `svm/config.ts` (web3.js-free, env-driven) +
  `svm/markets.live.ts` read the `prediction_market` program's Market accounts
  by `getProgramAccounts` and decode them at fixed offsets (Anchor 8-byte
  discriminator + borsh layout) into the same `LiveMarket` shape the EVM path
  returns. Loaded lazily so `@solana/web3.js` never weighs down the EVM bundle.
  Offsets are derived from `contracts/svm/target/idl/prediction_market.json`;
  re-derive if the `Market` struct changes.
- **Prediction markets.** Parimutuel pools + oracle-CPI resolution already exist
  on both VMs (EVM `PredictionMarket.sol`; SVM `prediction-market` +
  `realized-rate-oracle`, closed-loop via CPI). Next: a shared market-id scheme
  and a unified `fetchLiveMarkets()` that fans out per venue.
- **P2P liquidity.** IntentMatcher (EVM) and the SVM equivalent match local-
  currency intents directly (no dollar in the path). RealizedRateOracle on each
  VM discovers the rate from settled flow.
- **Selection.** A venue registry (EVM chains + Solana clusters) drives a single
  chooser; `NEXT_PUBLIC_ACTIVE_CHAIN` generalizes to a venue key.

### Roadmap

- [x] EVM chain registry (any-chain, config-only) driving markets + agent reads
- [x] LLM via OpenRouter (OpenAI-compatible) for the settlement agent
- [x] Venue-neutral market read (`markets.venue`: `fetchLiveMarkets`/`activeVenue`)
- [x] SVM adapter for prediction-market reads (mirror `markets.live`, lazy-loaded)
- [x] Programs deployed to Solana devnet: prediction_market
      `2aMC2CKjqwxmLrS6dv98c6pVYEKogRXxEuz3NZpzv8CZ`, realized_rate_oracle
      `4NUdEu7crxzR1AtHhaiMLk4q1ctTvhZLREq7Pbt9KNkK` (env set; markets not yet seeded)
- [ ] SVM oracle (realized-rate) reads + SVM write path (stake/claim)
- [ ] Multi-venue `fetchLiveMarkets()` that fans out and merges across homes
- [ ] Cross-venue P2P intent matching (EVM ↔ SVM via spoke-gateway / CCTP)
- [ ] Liquidity-provision UX for P2P pools on both VMs
