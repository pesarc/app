# Pesarc launch checklist — everything to go live in prod

Work top to bottom. Each phase is independent, so you can turn features on one at
a time and watch the "demo/indicative" tags disappear. Legend for **where** a
variable goes:

- **[build]** — a `NEXT_PUBLIC_*` value. It is inlined into the client at build
  time, so it goes in the CI **`BUILD_DOTENV`** secret (GitHub → Settings →
  Secrets → Actions) and takes effect on the next `main` deploy.
- **[server]** — a server-only secret. It goes in the droplet's
  **`/etc/pesarc/pesarc.env`** (chmod 600) and is read at runtime.

The app auto-deploys on every push to `main` (CI builds the image + restarts the
droplet). After changing `[server]` vars, `systemctl restart pesarc-web` (or
redeploy) to reload them.

---

## Phase 0 — Company & legal (in progress)
- [ ] CAC: Private Company Limited By Shares — Certificate of Incorporation + TIN.
- [ ] Corporate bank account (CoI, status report, TIN, directors' IDs).
- [ ] Fintech-lawyer consult before taking customer money at scale. Stay
      **non-custodial** and pay out through **licensed partners** (Paystack /
      Flutterwave) so you operate under their licences initially.
      See `REGISTER_NIGERIA.md` + `BUSINESS_ACTIVITY.md`.

## Phase 1 — Domains, email, docs (mostly done)
- [x] App on the droplet: `pesarc.xyz` (landing) + `app.pesarc.xyz` (app), Caddy TLS.
- [x] Docs: `docs.pesarc.xyz` (Mintlify).
- [x] Email: Zoho — `hello@` / `support@` / `security@pesarc.xyz`.
- [ ] `NEXT_PUBLIC_SITE_URL=https://pesarc.xyz` **[build]**
- [ ] `NEXT_PUBLIC_APP_URL=https://app.pesarc.xyz` **[build]**

## Phase 2 — Auth (Privy + Google) ✅ done
Dashboard: <https://dashboard.privy.io>.
- [x] Login methods enabled: **Google, Email, Passkey, Wallet (external)**.
- [x] Allowed origins: `https://app.pesarc.xyz` (+ `http://localhost:3055` for dev).
- [x] `NEXT_PUBLIC_PRIVY_APP_ID=<prod app id>` **[build]**.
- [x] **Google OAuth** configured (consent screen + Web OAuth client → Privy).
- [x] `NEXT_PUBLIC_AUTH_MODE=privy` **[build]** (own-auth phone stack stays off
      until Termii sender-id is approved — Phase 4b).

## Phase 3 — Wallets & gasless (in-house paymaster)
We run our OWN ERC-4337 gasless (Alchemy PAYG not needed): a bundler relays, and
**our** `VerifyingPaymaster` on Arc pays, signed by the `/api/paymaster` service key.
- [ ] **Deploy + fund + stake** the paymaster on Arc (one command — it deploys,
      stakes, and deposits USDC so it can sponsor). See `GO_LIVE.md §Gasless`.
      Signer = the `INHOUSE_PAYMASTER_PK` address `0xb440319e…BE675`.
- [ ] `NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse` **[build]**.
- [ ] `NEXT_PUBLIC_INHOUSE_PAYMASTER_ADDRESS=<deployed addr>` **[build]** — confirm
      it matches the broadcast output (deterministic, so it should equal the env value).
- [ ] `INHOUSE_PAYMASTER_PK=<service signer key>` **[server]** — signs sponsorships;
      holds NO funds.
- [ ] Bundler: `NEXT_PUBLIC_PIMLICO_API_KEY=<key>` **[build]** (Pimlico bundles for
      free; only OUR paymaster pays) — or `NEXT_PUBLIC_ARC_BUNDLER_URL` if Arc ships one.
- [ ] **Keep the paymaster deposit funded** — sponsored gas burns its USDC deposit.
      `PM_DEPOSIT` starts at 1 USDC; top up (`paymaster.deposit{value:…}()`) for real load.

## Phase 4 — Agent (natural-language actions)
The brain (`sdk/llm/extract.ts`) is provider-agnostic; set a key + a signing key.
- [ ] LLM: **OpenRouter** (OpenAI-compatible) — `LLM_PROVIDER=openai`,
      `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_API_KEY=<sk-or-…>`,
      `LLM_MODEL=anthropic/claude-3.5-sonnet` (or a cheaper model for the classifier),
      `OPENROUTER_SITE_URL=https://app.pesarc.xyz` **[server]**.
- [ ] Agent signing key: `SETTLE_OPERATOR_PK` (or `ARC_AGENT_PK`) **[server]** —
      fund with a little USDC for gas on Arc.

### Phase 4b — Global phone login (own-auth, later)
When Termii sender-id is approved (business registration):
- [ ] `TERMII_API_KEY`, `TERMII_SENDER_ID`, `TERMII_CHANNEL` **[server]**.
- [ ] `AUTH_JWT_PRIVATE_KEY_B64`, `AUTH_JWT_KID` **[server]** (already generated in
      local `.env` — copy them over).
- [ ] Privy dashboard → custom auth JWKS URL `https://app.pesarc.xyz/api/auth/jwks`,
      subject claim `sub`.
- [ ] Flip `NEXT_PUBLIC_AUTH_MODE=own` **[build]**. See `AUTH_OWN_STACK.md`.

## Phase 5 — Payments providers
- [ ] **Payouts / bank resolution** (Send bank payouts, name lookup):
      `PAYSTACK_SECRET_KEY` (or your ramp provider's keys) **[server]**.
- [ ] **Bills** (airtime/data/electricity): `BILLS_PROVIDER_URL` +
      `BILLS_PROVIDER_KEY` **[server]** → `httpBillsAdapter` routes real payments.
- [ ] **cNGN** (Naira stablecoin: NGN→cNGN virtual accounts, cNGN→NGN
      redemption, on-chain withdraw): `CNGN_API_KEY` + `CNGN_ENCRYPTION_KEY` +
      `CNGN_SSH_PRIVATE_KEY` (+ optional `CNGN_BASE_URL`, `CNGN_WEBHOOK_SECRET`)
      **[server]** → `cngnRampAdapter` handles NGN bank redemption and
      `/api/virtual-accounts` mints deposit accounts. Key prefix
      (`cngn_test`/`cngn_live`) selects sandbox vs prod. Unset → simulated
      fallback.
- [ ] **Invest** (stocks): `BROKER_API_URL` (+ `NEXT_PUBLIC_BROKER_API_URL` for
      client quotes) + key **[server/build]** → real broker orders.

## Phase 6 — Corridors (on-chain)
Contract addresses are already deployed on Arc mainnet (see `ARC_SUBMISSION.md`).
- [x] Nigeria (cNGN) — live from flow.
- [ ] **Ghana / Kenya** — run `DeployCorridor.s.sol` to seed the oracle rate
      (netting core). Commands are in `CORRIDORS_ROADMAP.md`; ~0.016 USDC gas each,
      simulation-verified. After running, the frontend quotes go live automatically.
- [ ] Live-quote / pool env (only if using the pool fallback):
      `NEXT_PUBLIC_*_POOL_MANAGER`, `_SWAP_ROUTER`, `_TOKEN_USD/NGN/GHS/KES` **[build]**.
- [ ] Uganda / Tanzania — deploy cUGX/cTZS first, then a corridor each.

## Phase 7 — Database & jobs
- [ ] `DATABASE_URL` **[server]** — self-hosted Postgres (or Neon). Tables
      auto-create; run `scripts/migrate.mjs` for a clean apply.
- [x] Settlement cron + nightly DB backup (systemd timers, see `deploy/DEPLOY.md`).

## Phase 8 — Deploy & verify
1. Put all **[build]** vars in `BUILD_DOTENV`; all **[server]** vars in
   `/etc/pesarc/pesarc.env`.
2. Push to `main` → CI builds + redeploys. `systemctl restart pesarc-web` to
   reload server env if needed.
3. **Verify on `app.pesarc.xyz`:**
   - [ ] Sign in with Google + a wallet.
   - [ ] **Send** shows a real balance (not "demo") and the network switcher lists
         your chains; a small test send shows a **live rate** (not "indicative")
         and a real tx hash; it completes gasless.
   - [ ] **Earn / Invest / Markets** show live balances and gate over-balance.
   - [ ] **Agent**: "send ₦5,000 to Ama" is understood and (with the signing key)
         executed.
   - [ ] **Bills**: a small airtime top-up returns a real reference.
   - [ ] `docs.pesarc.xyz` loads; `/privacy` and `/terms` load.

---

### Quick env reference
| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | build | landing + app URLs |
| `NEXT_PUBLIC_PRIVY_APP_ID` | build | Privy auth |
| `NEXT_PUBLIC_AUTH_MODE` | build | `privy` or `own` |
| `NEXT_PUBLIC_GAS_SPONSOR_ARC=inhouse` + `_INHOUSE_PAYMASTER_ADDRESS` + `_PIMLICO_API_KEY` | build | in-house gasless (bundler + our paymaster) |
| `INHOUSE_PAYMASTER_PK` | server | signs `/api/paymaster` sponsorships |
| `LLM_PROVIDER=openai` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` (OpenRouter) | server | agent brain |
| `SETTLE_OPERATOR_PK` / `ARC_AGENT_PK` | server | agent on-chain signer |
| `TERMII_API_KEY` / `TERMII_SENDER_ID`, `AUTH_JWT_PRIVATE_KEY_B64` / `AUTH_JWT_KID` | server | phone login (own-auth) |
| `PAYSTACK_SECRET_KEY` | server | payouts + bank resolution |
| `BILLS_PROVIDER_URL` / `BILLS_PROVIDER_KEY` | server | real bills |
| `CNGN_API_KEY` / `CNGN_ENCRYPTION_KEY` / `CNGN_SSH_PRIVATE_KEY` (+ `CNGN_BASE_URL` / `CNGN_WEBHOOK_SECRET`) | server | cNGN redeem + virtual accounts |
| `BROKER_API_URL` / `NEXT_PUBLIC_BROKER_API_URL` | server/build | real stock orders |
| `DATABASE_URL` | server | Postgres |
| `NEXT_PUBLIC_*_POOL_MANAGER/_SWAP_ROUTER/_TOKEN_*` | build | corridor pool (optional) |
