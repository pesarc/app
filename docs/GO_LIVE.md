# Go-live config — make login, wallets and gasless real in prod

Right now the app runs live-with-fallback: when Privy + the in-house paymaster +
a corridor aren't wired for the environment, it shows demo balances and mock quotes.
This is the checklist to turn each part on for `app.pesarc.xyz` (the droplet).

`NEXT_PUBLIC_*` values are baked into the client at **build time**, so they go in
the CI build secret (`BUILD_DOTENV`) and take effect on the next deploy. Server
secrets go in the droplet's `/etc/pesarc/pesarc.env`.

## 1. Privy (auth + embedded wallets)

Dashboard: <https://dashboard.privy.io> → your app.

1. **Login methods** → enable **Google, Email, Passkey, Wallet (external)** to
   match the code (`WalletProvider.tsx`). SMS stays off (we use our own — see
   `AUTH_OWN_STACK.md`).
2. **Allowed origins / domains** → add `https://app.pesarc.xyz` and, for dev,
   `http://localhost:3055`. Without this, login silently fails on prod.
3. **Embedded wallets** → confirm "create on login" for EVM (and Solana) is on
   (the code requests `all-users`).
4. **Google branding (recommended)** → under Google login, add **your own Google
   OAuth client** so the consent screen says pesarc.xyz (steps in §3). Otherwise
   Privy's default Google is used (works, but shows Privy branding).
5. Copy the **App ID** → set `NEXT_PUBLIC_PRIVY_APP_ID` in `BUILD_DOTENV`.
   (There's already a `PROD_PRIVY_APP_ID` in your `.env`; use the prod app's ID.)

## 2. Gasless — in-house paymaster (no Alchemy PAYG)

We run our OWN ERC-4337 gasless on Arc: a **bundler** relays the UserOperation,
and **our** `VerifyingPaymaster` pays for it, signed by the `/api/paymaster`
service key. No third-party sponsorship policy, no Alchemy PAYG.

**Step 1 — deploy + stake + fund the paymaster (once).** The script does all
three in one broadcast. Run it from `contracts/evm` (needs USDC in the deployer
for gas + the stake + the deposit):

```bash
PRIVATE_KEY=<deployer_pk_with_usdc> \
PAYMASTER_SIGNER=0xb440319eE67d10Ffce6F413e4B889D06F20BE675 \
PM_DEPOSIT=25000000000000000000 \
PM_STAKE=1000000000000000000 \
forge script script/DeployPaymaster.s.sol --rpc-url arc --broadcast --slow
```

- `PAYMASTER_SIGNER` is the **address** of `INHOUSE_PAYMASTER_PK` (already in
  `.env.local` as the verifyingSigner). It signs sponsorships and holds no funds.
- `PM_DEPOSIT` is the USDC the paymaster spends on sponsored gas (example: 25
  USDC — the default is only 1). `PM_STAKE` is the ERC-4337 reputation bond.
- The deploy address is deterministic, so the printed
  `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS=` should equal the value already in env
  (`0xAe5493…b22`). **Confirm it matches** before relying on it.

**Step 2 — env.** (Already set in `.env.local`; mirror to prod.)

- `NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse` **[build]**
- `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS=<deployed addr>` **[build]**
- `INHOUSE_PAYMASTER_PK=<service signer key>` **[server]**
- Bundler: `NEXT_PUBLIC_PIMLICO_API_KEY=<key>` **[build]** — Pimlico bundles for
  free; only our paymaster pays. (Or `NEXT_PUBLIC_ARC_BUNDLER_URL` if Arc ships
  a native bundler.)

**Step 3 — keep it funded.** Sponsored gas burns the paymaster's USDC deposit.
Watch `paymaster.getDeposit()`; top up with `paymaster.deposit{value:…}()` (owner
= the deployer). If the deposit hits zero, sends fall back to the demo path.

## 3. Google OAuth client (for branded Google login + consent)

Google Cloud Console: <https://console.cloud.google.com>.

1. New project → **APIs & Services → OAuth consent screen**: External, app name
   "Pesarc", support email, logo, **authorized domain `pesarc.xyz`**, scopes
   `email profile openid`. Add the **Privacy Policy** (`pesarc.xyz/privacy`) and
   **Terms** (`pesarc.xyz/terms`) URLs — Google requires them.
2. **Credentials → Create OAuth client ID → Web application**. Authorized
   redirect URI = the one Privy shows in its Google-login config.
3. Paste the **client ID + secret** into Privy's Google login settings.
4. Publish the consent screen (or add test users while in testing).

## 4. Corridor / contracts env (live quotes + on-chain send)

For the live USDC→cNGN corridor to price and settle, set the pool + token
addresses the frontend reads (`chain/contracts.ts` / registry), e.g. on the hub:
`NEXT_PUBLIC_*_POOL_MANAGER`, `_SWAP_ROUTER`, `_TOKEN_USD`, `_TOKEN_NGN`
(and `_TOKEN_GHS`, `_TOKEN_KES` as those corridors come online — see
`CORRIDORS_ROADMAP.md`). Until these point at a real, funded pool, quotes are
"indicative" and sends use the demo path.

## 4b. Agent (natural-language actions)

The agent's brain is already built and provider-agnostic (`sdk/llm/extract.ts`,
tool-based extraction). In demo mode it understands and replies but doesn't
execute; to make it act, set two things on the droplet (server-only):

1. **An LLM key** — we use **OpenRouter** (OpenAI-compatible, one key for many
   models):
   - `LLM_PROVIDER=openai`
   - `LLM_BASE_URL=https://openrouter.ai/api/v1`
   - `LLM_API_KEY=<sk-or-…>`
   - `LLM_MODEL=anthropic/claude-3.5-sonnet` (swap to a cheaper model for a
     high-volume intent classifier — `LLM_MODEL` is all you change).
   - `OPENROUTER_SITE_URL=https://app.pesarc.xyz` (attribution header).
2. **An agent signing key** — `SETTLE_OPERATOR_PK` (or `ARC_AGENT_PK` for a
   specific chain): the server-side key that submits and settles the agent's
   on-chain intents. Fund it with a little USDC for gas on Arc.

With both set (and `evmAgentReady`), "send ₦50,000 to Ama in Accra" or "pay my
Ikeja electricity bill" is understood and executed, in the app and on WhatsApp.

## 4c. cNGN (Naira stablecoin: deposits + redemption)

The Nigeria fiat legs run through cNGN via the official `cngn-typescript-library`
(server-side, wrapped in `sdk/cngn.ts`). In demo mode the ramp and virtual
accounts use a simulated fallback; to make them real, set the cNGN secrets on
the droplet (server-only, **never** `NEXT_PUBLIC`):

1. `CNGN_API_KEY` — the `cngn_test…` / `cngn_live…` key from the cNGN dashboard.
   The prefix selects sandbox vs production; no separate URL needed.
2. `CNGN_ENCRYPTION_KEY` — AES-256-CBC key used to encrypt request bodies.
3. `CNGN_SSH_PRIVATE_KEY` — your Ed25519 (OpenSSH) private key that decrypts
   sealed responses. Store it on one line with `\n` for newlines.
4. `CNGN_WEBHOOK_SECRET` (optional) — enables `/api/cngn/webhook` to verify and
   apply deposit/redemption status callbacks. Add cNGN's dashboard IP allowlist
   entry for the droplet too.
5. `CNGN_BASE_URL` (optional) — override the API host (defaults to
   `https://api.cngn.co/v1/api`).

With these set (`cngnConfigured()`), the off-ramp routes cNGN → NGN bank
redemptions through `cngnRampAdapter` and `/api/virtual-accounts` mints real
NUBANs for NGN → cNGN deposits.

## 5. Set the env and deploy

- **Client (build-time):** add the `NEXT_PUBLIC_*` values above to the repo's
  `BUILD_DOTENV` secret (Settings → Secrets → Actions). They inline on the next
  build.
- **Server (runtime):** add server-only secrets to `/etc/pesarc/pesarc.env` on
  the droplet (`DATABASE_URL`, payout provider keys, `TERMII_API_KEY`,
  `AUTH_JWT_PRIVATE_KEY_B64`, `AUTH_JWT_KID`).
- Push to `main` → CI builds the image and redeploys the droplet.

## 6. Verify (after deploy)

- Sign in on `app.pesarc.xyz` with Google + a wallet.
- On **Send**, the balance header shows a real on-chain USDC balance (not "demo")
  and the network switcher lists your configured chains.
- A small test send shows a **live rate** (not "indicative") and a real tx hash.
- Gasless: the send completes without the user holding a gas token.

Work top-down: Privy first (login), then the in-house paymaster (gasless), then
the corridor env (live quotes). Each is independent, so you can turn them on one
at a time and watch the demo tags disappear.

## 7. Arc submission demo (mainnet-live)

The whole flow runs in **demo mode** on dev with nothing configured (every step
functions, tagged "Demo"), which is enough to rehearse. For the **mainnet-live**
recording, set the env below, then follow the shot list. Chain + addresses are in
`CORRIDORS_ROADMAP.md` and `ARC_SUBMISSION.md` (Arc mainnet, chain `5042`, USDC is
the native gas token).

### Minimum env for a live mainnet demo
| Need | Set | Where |
|---|---|---|
| Sign in + embedded wallet on Arc | `NEXT_PUBLIC_PRIVY_APP_ID` (+ Arc `5042` in the registry) | build |
| Gasless | paymaster **deployed + funded** on Arc (§2) · `NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse` · `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS` · `INHOUSE_PAYMASTER_PK` · `NEXT_PUBLIC_PIMLICO_API_KEY` | build+server |
| Live corridor quotes + settle | `NEXT_PUBLIC_ARC_*` corridor token addresses (cNGN/cGHS/cKES) | build |
| Agent executes (not just replies) | `LLM_API_KEY` (OpenRouter, §4b) + `SETTLE_OPERATOR_PK`/`ARC_AGENT_PK` funded with a little USDC on Arc | server |
| Real cash-out | `PAYSTACK_SECRET_KEY` **or** `CNGN_*` (§4c). Without it the off-ramp is a realistic sandbox that advances initiated → paid | server |
| Records + history | `DATABASE_URL` (else in-memory/JSONL) | server |
| Demo wallet balance | real **USDC on Arc** in the signed-in smart wallet (mainnet has no faucet) | on-chain |

### Shot list (maps to the submission flow)
1. **Sign in with Privy (Google)** → an embedded smart wallet is created on Arc.
   Show the wallet address; note USDC is the gas token.
2. **Funds.** On mainnet there is no faucet: pre-fund the smart wallet with USDC
   on Arc before recording (for a testnet rehearsal, the in-app faucet mints
   cNGN/cGHS/cKES). Show the balance header go from empty to funded.
3. **"Send ₦50,000 to Ama"** in the agent (or Send). The agent confirms the
   corridor and asks bank vs contact, then settles **peer-to-peer via
   IntentMatcher** in local currency — no dollar shown in the path. Show the
   on-chain tx and "Matched peer-to-peer".
4. **Hedge ₦50,000** on a parimutuel market (PredictionMarket on Arc). Back Yes/No;
   show the position settling **gaslessly** in cNGN with an on-chain tx.
5. **Earn + Invest.** Provide liquidity on a corridor (Earn), then buy a
   Global-South stock in **Invest**, quoted and settled in cNGN. (Invest shows
   real orders only with `BROKER_API_URL`; otherwise narrate as sandbox.)
6. **Cash out** to a Nigerian bank via the off-ramp: pick the bank (name resolves
   from `/api/banks`), confirm, and show the payout move initiated → paid. Live
   with `PAYSTACK_SECRET_KEY`/`CNGN_*`; a realistic sandbox otherwise.

Tip: personas make the story tight — sign in as **Personal** for steps 1-4 and 6,
and switch to **Saver** (Settings → Experience) to open straight into Earn for
step 5.
