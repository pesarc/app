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

## Phase 2 — Auth (Privy + Google)
Dashboard: <https://dashboard.privy.io>.
- [ ] Enable login methods: **Google, Email, Passkey, Wallet (external)**.
- [ ] Allowed origins: `https://app.pesarc.xyz` (+ `http://localhost:3055` for dev).
- [ ] `NEXT_PUBLIC_PRIVY_APP_ID=<prod app id>` **[build]** (use `PROD_PRIVY_APP_ID`).
- [ ] **Google OAuth** (Google Cloud): consent screen (app name, logo, authorized
      domain `pesarc.xyz`, **Privacy** `pesarc.xyz/privacy` + **Terms**
      `pesarc.xyz/terms`), Web OAuth client → paste client id/secret into Privy.
- [ ] `NEXT_PUBLIC_AUTH_MODE=privy` **[build]** (keep `privy` until the own-auth
      phone stack is ready — Phase 4b).

## Phase 3 — Wallets & gasless (Alchemy)
Dashboard: <https://dashboard.alchemy.com>.
- [ ] App on the hub chain → `NEXT_PUBLIC_ALCHEMY_API_KEY=<key>` **[build]**.
- [ ] Gas Manager policy → `NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID=<id>` **[build]**
      (+ `NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID_ARB_SEPOLIA` etc. if multi-chain).
- [ ] **Fund the gas policy** — gasless runs on its balance. Start small, watch burn.

## Phase 4 — Agent (natural-language actions)
The brain (`sdk/llm/extract.ts`) is provider-agnostic; set a key + a signing key.
- [ ] LLM: **Anthropic** — `ANTHROPIC_API_KEY` **[server]** + `LLM_MODEL=claude-opus-5`
      **[server]** (`claude-haiku-4-5` is much cheaper for a high-volume classifier).
      **Or** OpenAI-compatible — `LLM_PROVIDER=openai`, `LLM_BASE_URL`, `LLM_API_KEY`,
      `LLM_MODEL` **[server]**.
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
| `NEXT_PUBLIC_ALCHEMY_API_KEY` / `_GAS_POLICY_ID` | build | gasless smart wallets |
| `ANTHROPIC_API_KEY` + `LLM_MODEL` (or `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`) | server | agent brain |
| `SETTLE_OPERATOR_PK` / `ARC_AGENT_PK` | server | agent on-chain signer |
| `TERMII_API_KEY` / `TERMII_SENDER_ID`, `AUTH_JWT_PRIVATE_KEY_B64` / `AUTH_JWT_KID` | server | phone login (own-auth) |
| `PAYSTACK_SECRET_KEY` | server | payouts + bank resolution |
| `BILLS_PROVIDER_URL` / `BILLS_PROVIDER_KEY` | server | real bills |
| `BROKER_API_URL` / `NEXT_PUBLIC_BROKER_API_URL` | server/build | real stock orders |
| `DATABASE_URL` | server | Postgres |
| `NEXT_PUBLIC_*_POOL_MANAGER/_SWAP_ROUTER/_TOKEN_*` | build | corridor pool (optional) |
