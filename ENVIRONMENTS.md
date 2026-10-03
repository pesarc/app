# Environments & deployment runbook

How local dev and production are configured, where each env var lives, and how to
flip between **testnet** (for testing, with free faucet funds) and **mainnet**
(real users, real money). Read this before touching env or deploying.

## TL;DR — what runs where

| | **Local dev** | **Production (droplet)** |
|---|---|---|
| Source of `NEXT_PUBLIC_*` | `apps/web/.env.local` (overrides) + root `.env` | the **`BUILD_DOTENV`** GitHub secret, inlined at **build** time |
| Source of server-only secrets | same `.env` files | the droplet's **runtime** env file (`--env-file`) |
| Default chain | whatever `NEXT_PUBLIC_ACTIVE_CHAIN` / `NEXT_PUBLIC_HUB_CHAIN_ID` say | same, but from `BUILD_DOTENV` |
| Deploy | `pnpm dev` | push to `main` **or** `gh workflow run build-image.yml --ref main` |

**The one rule that bit us:** `NEXT_PUBLIC_*` vars are **baked into the client
bundle at build time** (BuildKit secret → Dockerfile). Setting them on the
droplet's *runtime* env does nothing for client code. They must be in
`BUILD_DOTENV`, and a **rebuild** must run.

## Local dev (testnet — the default for testing)

`apps/web/.env.local` overrides root `.env`. Keep it on **testnet** so you run
with free faucet funds:

```
NEXT_PUBLIC_ACTIVE_CHAIN="arbitrum-sepolia"
NEXT_PUBLIC_HUB_CHAIN_ID="421614"
```

- Arc **testnet** (`5042002`) is a selectable chain in the picker; its gasless
  works via Pimlico (needs `NEXT_PUBLIC_PIMLICO_API_KEY`). Arc **mainnet** is
  also selectable but you have no funds there.
- Get funds: the in-app faucet (or `POST /api/faucet`) mints ~$1 of each test
  stablecoin. Needs `SETTLE_OPERATOR_PK` server-side.
- Balance shows per active chain — if it looks empty, you're on a chain where you
  have no funds. Switch networks in-app.

## Production (the droplet)

- **Build-time (`BUILD_DOTENV` secret):** every `NEXT_PUBLIC_*` line. The
  documented source is root `.env`; keep that complete. To update:
  ```bash
  grep '^NEXT_PUBLIC_' .env | gh secret set BUILD_DOTENV
  ```
  GitHub secrets are **write-only** — you can't read `BUILD_DOTENV` back to diff
  it, so always regenerate it from a complete `.env`, never from a partial one.
- **Runtime (droplet env file):** server-only secrets — `DATABASE_URL`,
  `BACHS_*`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_*`, `CNGN_*`, `ADMIN_SECRET`,
  `SETTLE_OPERATOR_PK`, `INHOUSE_PAYMASTER_PK`, `RAMP_WEBHOOK_SECRET`, etc.
  Never `NEXT_PUBLIC_*` here.
- **Deploy:** push to `main` (paths under `apps/web/**`, `packages/**`,
  `Dockerfile`, …) or `gh workflow run build-image.yml --ref main`. The workflow
  rebuilds (the `DOTENV_HASH` arg busts the cache when `BUILD_DOTENV` changed) and
  SSHes into the droplet to pull + restart (gated by the `DEPLOY_TO_DROPLET` repo
  var + `DROPLET_HOST`/`DROPLET_USER`/`DROPLET_SSH_KEY` secrets).

## Flipping testnet ↔ mainnet (production)

Only two `NEXT_PUBLIC_*` vars decide the chain. **Testnet** (for testing):
```
NEXT_PUBLIC_ACTIVE_CHAIN="arbitrum-sepolia"
NEXT_PUBLIC_HUB_CHAIN_ID="421614"
```
**Arc mainnet** (going live):
```
NEXT_PUBLIC_ACTIVE_CHAIN="arc"
NEXT_PUBLIC_HUB_CHAIN_ID="5042"
```
Update them inside `BUILD_DOTENV`, re-set the secret, and redeploy. Switching the
hub changes the chain for **every user** on the next deploy — never do it just to
test. (Arc **testnet** can't be the hub — the valid hub ids are
`421614 | 11155111 | 5042`; Arc testnet is only a selectable spoke.)

## Going live on Arc mainnet — checklist

Testing lives on testnet; production is a deliberate flip. Before pointing real
users at Arc mainnet:

1. `BUILD_DOTENV`: set `NEXT_PUBLIC_ACTIVE_CHAIN="arc"`, `NEXT_PUBLIC_HUB_CHAIN_ID="5042"`.
2. Gasless: in-house paymaster is deployed + funded on Arc mainnet (check its
   EntryPoint deposit). Put `INHOUSE_PAYMASTER_PK` on the droplet **runtime** env
   so `/api/paymaster` can sign. (Or set `NEXT_PUBLIC_GAS_MODE=user` so users pay
   their own gas in USDC — Arc's gas token — and fund no paymaster.)
3. Treasury: set `NEXT_PUBLIC_RAMP_ESCROW` to a mainnet wallet you control
   (it defaults to the testnet operator).
4. Off-ramp: `BACHS_PROD_KEY`, `BACHS_PROD_WEBHOOK_SECRET`, `BACHS_ENV=live` on the
   droplet, and a **funded live NGN float** at Bachs. Add other providers'
   live keys + float for their corridors (Flutterwave for KE/mobile-money, etc.).
5. Redeploy and smoke-test one real small payout before announcing.

## Gotchas

- **`NEXT_PUBLIC_*` is build-time.** Changing it on the droplet does nothing;
  change `BUILD_DOTENV` and rebuild.
- **Balance empty / can't send on every chain** usually means you're on a chain
  with no funds (e.g. prod switched to mainnet). Check `ACTIVE_CHAIN`.
- **Secrets are write-only.** Regenerate `BUILD_DOTENV` from a complete `.env`,
  not a partial merge, or you can silently drop vars.
- **A corridor goes live only when its provider key is set AND its account is
  funded for that currency** (e.g. Bachs settles NGN/USD only).
