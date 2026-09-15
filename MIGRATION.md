# Migration map — current repos → the StableArc org

Target: two repos under the `stablearc` GitHub org.

- **`stablearc/contracts`** (public) — all Solidity + Anchor, one place.
- **`stablearc/app`** (private) — this monorepo.

## Where each existing thing goes

### → `stablearc/contracts`
| From | To |
|---|---|
| `stablearc-agent/contracts` (IntentMatcher, RealizedRateOracle, PredictionMarket, TestStable, Deploy) | `contracts/evm/` |
| `luberty/contracts` (hub hook, HubBridgeReceiver, SpokeGateway, SettlementNetting) | `contracts/evm/` |
| `Goldgard/solana` (realized-rate-oracle) | `contracts/svm/` |
| `luberty/solana/prediction-market` | `contracts/svm/` |
| `luberty/solana/spoke-gateway` | `contracts/svm/` |
| all `Deploy*.s.sol` + broadcast/idl artifacts | `contracts/deploy/` |

Kills the cross-repo `../../../../../` `.so` path hack — both SVM programs sit
in one Anchor workspace, so the prediction-market ↔ oracle CPI test is local.

### → `stablearc/app`
| From | To |
|---|---|
| `luberty/app/**` (Next.js pages + `/api`) | `apps/web/` (routes) + `apps/api/` (backend) |
| `luberty/components/**` | `apps/web/components` + shared bits → `packages/ui` |
| `luberty/lib/**` (chain, solver, oracle, llm, matching, money) | `packages/sdk/` |
| `luberty/lib/chain/abi/**` + Anchor IDLs | `packages/abi/` (generated) |
| `luberty/lib/celo`, `lib/solver`, `app/api/cron` (keepers) | `apps/worker/` |
| `stablearc-agent` TS core (matching.ts, llm, adapters, agent) | `packages/sdk/` |
| `stablearc-agent/adapters/telegram` | `apps/worker/` (or `apps/api`) |
| brand tokens (tailwind emerald/gold) | `packages/ui` |

### Stays / retires
- `Goldgard` repo keeps the open-source Goldgard hook + `svm-fixtures` (its
  own thing); only `Goldgard/solana` (the oracle) moves to `contracts/svm`.
- `luberty` and `stablearc-agent` become archived once fully migrated.

## Order of operations
1. Create the `stablearc` org (manual).
2. Push these two scaffolds as the new repos.
3. Move contracts first (self-contained, testable in isolation).
4. Lift `luberty` into `apps/web` + `packages/sdk`; wire `@pesarc/abi`.
5. Split keepers into `apps/worker`; stand up `apps/mobile` from the web routes.
6. Point Vercel at `apps/web`; archive the old repos.
