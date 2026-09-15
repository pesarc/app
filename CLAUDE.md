# StableArc — Engineering Standards (CLAUDE.md)

StableArc is a cross-border stablecoin settlement network: one unified-liquidity
hub on **Arbitrum**, every other chain a thin **spoke** gateway. This repo (`luberty/`)
is the **private** product monorepo — app, hub/spoke contracts, Solana spoke, docs.
The open-source Goldgard hook lives separately at `jorshimayor/Goldgard`.

> Folder is named `luberty/` for historical reasons; the product brand is **StableArc**.

## Golden rules (read first)

1. **Never commit secrets.** `.env*` are gitignored. Real keys/URLs never enter git,
   logs, or tool output. Only `.env.example` (empty values) is tracked. Before any
   commit, verify no `.env` / keypair / private key is staged.
2. **Non-custodial always.** The app never holds customer fiat; funds live in the
   user's own smart wallet, settlement is on-chain. Don't add flows that take custody.
3. **Fail closed on money, open on demos.** Anything spending the operator key or
   moving funds is guarded; privileged API routes enforce auth when `OPERATOR_API_SECRET`
   is set (production MUST set it).
4. **Test before you deploy.** `forge test`, `cargo test`, and `pnpm build` must be
   green. CI runs all three on `main` and `dev`.
5. **Branch `dev` → PR → `main`.** `main` is what Vercel deploys. Never push straight
   to `main` for feature work.

## Repository map

```
app/            Next.js 15 App Router — pages + /api routes (backend)
components/     React UI (app/ = consumer, landing/ = marketing)
lib/            App logic: chain/ (viem, ABIs, corridors), api/ (guards), *.ts stores
contracts/      Foundry: hub hook, HubBridgeReceiver, SpokeGateway, SettlementNetting
solana/         Anchor: spoke-gateway (CCTP V2), prediction-market (parimutuel)
docs/           Specs, licensing/partner strategy, security audit, corridor runbooks
.github/        CI workflows (frontend, contracts, solana)
```

---

## Code organization (all languages)

- **Keep files small and single-purpose.** Soft cap **~300 lines**, hard cap
  **~500**. A file pushing past that is a smell — split it before it reaches
  1k/2k/3k. (Current outlier to chip away at: `components/app/send/SendFlow.tsx`.)
- **One concept per file, grouped in a folder.** A feature is a folder, not a
  mega-component: a thin container + a file per sub-view + a small helpers/types
  module. See `components/app/markets/` (`MarketsView` container · `MarketCard` ·
  `StakeSheet` · `display.ts`) and `solana/prediction-market/programs/*/src/`
  (`lib.rs` entry · `state` · `constants` · `error` · `events` · `utils` ·
  `instructions/<one file per instruction>`) as the reference shapes.
- **Anchor programs are multi-file:** `#[program]` in `lib.rs` delegates to a
  handler per instruction; each instruction file owns its `#[derive(Accounts)]`
  context + `handler`. Box heavy account contexts (`Box<Account<..>>`) when a
  `try_accounts` frame nears the 4KB BPF stack limit.
- **Solidity contracts stay one-file per contract** (extract reusable logic into
  `library`/`abstract` when it genuinely repeats), but keep each contract focused.
- Extract shared helpers/types rather than copy-pasting; name folders and files
  after the domain concept, not the layer (`markets/`, not `bigcomponents/`).

---

## Frontend (Next.js 15 / React 18 / TS / Tailwind)

- **Server Components by default.** Add `"use client"` only when you need state,
  effects, wallet hooks, or browser APIs. Keep client bundles lean.
- **Chain reads through `lib/chain/`.** Never inline addresses or ABIs in components —
  addresses come from `CONTRACTS` (`lib/chain/contracts.ts`, env-driven), ABIs from
  `lib/chain/abi/`. Corridor config in `lib/chain/corridors.ts`.
- **Live-vs-mock is explicit.** `mode === "live" && authenticated && smart.ready &&
  CONTRACTS_READY` gates real on-chain paths; everything degrades to a mock/simulated
  path so the demo never hard-fails. Preserve this fallback in new flows.
- **Money math**: on-chain amounts are `bigint` (wei/6-dec USDC). Convert at the edge
  with viem `parseUnits`/`formatUnits`; never use JS floats for token amounts.
  `tsconfig` targets ES2020 (bigint literals OK).
- **Type safety**: no `any` in new code; address types are `` `0x${string}` ``.
  `pnpm build` runs the typecheck — it must pass.
- **Accessibility + theming**: app is the light theme, landing the dark; every
  interactive element needs an `aria-label`; external links carry `rel="noreferrer"`.
- **Styling**: Tailwind utilities + the design tokens already in `globals.css` /
  `tailwind.config.ts` (emerald/gold/deepink). Don't introduce a component library.

## Backend (Next.js API routes / Neon Postgres)

- **Every route validates input with `zod`.** Parse the body, return 400 on failure.
  Validate addresses (`isAddress`), tx hashes (regex), amounts (bounded).
- **Auth on privileged routes.** Any route that spends the operator key or mutates
  shared on-chain state uses `requireOperator` + `rateLimit` from `lib/api/guard.ts`.
  User-facing routes (e.g. `relay`) get `rateLimit` only. Never gate on "is the
  signing key present" as if it were authorization.
- **SQL is always parameterized.** Use Neon tagged templates (`` sql`… ${x} …` ``) —
  never string-concatenate input into a query. (Verified clean in audit; keep it that way.)
- **Secrets stay server-side.** `SETTLE_OPERATOR_PK`, `OPERATOR_API_SECRET`,
  `DATABASE_URL` are read only in `runtime = "nodejs"` routes, never logged, never
  returned. Anything the browser needs is `NEXT_PUBLIC_*` and world-readable — never
  put a secret there.
- **Error responses are generic** for privileged routes (log full error server-side,
  return a short message). Don't leak RPC URLs / addresses / revert data to clients.
- **Long-running routes** (relayer polls Circle IRIS ~36s) set `maxDuration` and are
  rate-limited hard. Prefer to keep request handlers fast; move heavy/scheduled work
  to a keeper/cron.
- **DB schema**: `ensureSchema` runs `CREATE TABLE IF NOT EXISTS` today (fine for
  testnet). Before scale, move to real migrations run out of the request path.

## Smart contracts (Solidity / Foundry)

- **Toolchain**: Solidity `0.8.26`, `via_ir = true`, optimizer on. `forge fmt`,
  `forge test` (unit + fuzz + invariant) before every commit. New behavior needs a test.
- **Security defaults**: `SafeERC20` for all token moves (`forceApprove`, not `approve`);
  `ReentrancyGuard` on anything with external calls + state; `Ownable2Step` for admin;
  Checks-Effects-Interactions (mutate state before external calls). Bound loops and
  user-supplied amounts (`uint128` cap on obligations).
- **The reserve-backing invariant is sacred**: in `HubBridgeReceiver`, credits
  (`totalProcessed6`) can never exceed native USDC actually received. Any change here
  needs the fuzz invariant (`testFuzzBackingInvariant`) still green.
- **Slippage**: the relayer MUST pass a non-zero `minNgnOut` (fresh quote) to
  `processDeposit`. `sqrtPriceLimitX96 = MIN_SQRT_LIMIT` gives no protection on its own.
- **Trust boundaries**: lean on CCTP for spoke/burn account validation, but always
  **pin** the CCTP program/messenger addresses as immutable constants — never accept
  them as caller input. Same rule on Solana.
- **Testnet shortcuts are labeled**: `SwapRouterNoChecks`, open-mint test tokens, and
  operator-attested deposits are testnet-only — each is flagged in code + the audit
  and must be replaced before mainnet.

## Solana program (Anchor)

- **Toolchain**: Anchor `1.1.2`, Rust `1.89.0`, `cargo fmt --check` + `cargo test`.
  Tests run Circle's real CCTP binaries in LiteSVM (`fixtures/`) — no network needed.
  The CPI test skips gracefully if the BPF `.so` isn't built (`anchor build` first).
- **Pin every trusted account** with `#[account(address = … @ Error)]`: the CCTP
  programs, the SPL token program, and the USDC mint. The CPI `program_id` is a
  hardcoded constant. This closes arbitrary-CPI / account-substitution.
- **`mint_recipient` is always the hub bridge receiver** — funds can only land in the
  reserve-backed path, never a raw address. Validate `amount > 0` and non-zero recipient.
- **Redeploys** that grow the program need `solana program extend <id> <bytes>` first.

## Deployment

- **Hub chain**: Arbitrum Sepolia (421614) for testnet; mainnet is Arbitrum One.
  Spokes: Ethereum Sepolia (domain 0), Base Sepolia (6), Solana devnet (5). Hub CCTP
  domain 3.
- **Frontend → Vercel**, root dir `luberty/` (uses pnpm; `packageManager` pinned).
  Set env from `.env.example`: all `NEXT_PUBLIC_ARB_*` (contract addresses),
  `NEXT_PUBLIC_HUB_CHAIN_ID`, `NEXT_PUBLIC_HUB_RPC_URL`, `DATABASE_URL`, Privy/Alchemy
  keys, and **the server-only `SETTLE_OPERATOR_PK` + `OPERATOR_API_SECRET`**. The
  `.so`/`contracts/` trees are excluded via `.vercelignore`.
- **Contracts**: `forge script script/<Deploy>.s.sol --rpc-url <net> --broadcast`.
  Each deploy script prints the `NEXT_PUBLIC_*` env line to paste into `.env`. Foundry
  lives at `~/.foundry/bin` (not on PATH by default).
- **Solana**: `anchor deploy --provider.cluster devnet`. Program id is pinned in
  `declare_id!` + `Anchor.toml`.
- **After any contract redeploy**, update the address in `.env` (local) and the Vercel
  project env, and in `lib/chain/contracts.ts` / `corridors.ts` if hardcoded.
- **Never deploy to mainnet** without: green CI, an external audit, `OPERATOR_API_SECRET`
  set, oracle-based slippage, and the testnet shortcuts replaced.

## CI/CD

- Three workflows in `.github/workflows/` run on push/PR to `main` and `dev`, path-filtered:
  `frontend.yml` (pnpm lint + build), `contracts.yml` (forge build + test), `solana.yml`
  (cargo fmt + test). Keep them green.
- **Flow**: branch off `dev` → PR into `dev` (CI must pass) → merge → PR `dev` into
  `main` for release. Vercel deploys `main`.

## Commits

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), scope where useful
  (`feat(solana):`). Explain the *why* in the body for non-trivial changes.
- End commit messages with the `Co-Authored-By` trailer when pair-authored.
- Commit or push only when asked; branch first if on `main`.
