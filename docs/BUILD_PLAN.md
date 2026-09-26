# Pesarc build plan — no mocks, no gaps

Master to-do list to take every product surface to production: turn **mock**
features real, finish **partial** ones, and build the **absent** ones. Worked as
a loop, top to bottom, one checkbox at a time. Update the status boxes as items
land. Rules still apply: never mention the "no dollar in the path" angle in copy;
never use the em dash; mobile-first, no packed layouts (see CLAUDE.md 7-8).

Legend: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` blocked on an external
account/credential we must provision (flagged so the loop skips ahead).

## Phase 1 — Developer API + OPay-style pay (IN PROGRESS)

The named next. Turns "Developer API: absent" and "OPay redirect: partial" into
present.

- [x] **API key system.** `pk_live_` / `sk_live_` pairs, secret stored hashed,
  per-key `whsec_` signing secret. `sdk/apiKeys.ts` (DB + JSONL fallback).
- [x] **Developer auth guard.** `requireApiKey()` in `sdk/api/developer.ts`.
- [x] **Payment sessions model.** `sdk/payments.ts` (create / get / list / mark
  paid), DB + JSONL fallback.
- [x] **Public REST v1.** `POST/GET /api/v1/payments`, `GET /api/v1/payments/:id`,
  `GET /api/v1/ping` (all `sk_live_` authed, rate-limited, zod-validated).
- [x] **OPay-style hosted checkout.** `/checkout?session=` in-app page: customer
  signs into Pesarc, pays (live corridor send / mock), then is redirected to the
  merchant `redirect_url` with a signed `?paymentId&reference&status&signature`.
- [x] **Checkout support endpoints.** `GET /api/checkout/:id` (safe public
  fields), `POST /api/checkout/:id/complete` (mark paid, return signed redirect).
- [x] **Developers dashboard.** `/developers` page: create / reveal-once / revoke
  keys, live API docs + curl, a test-payment-link builder. Business persona only.
- [x] **Merchant webhooks.** POST `payment.succeeded` to a merchant `webhook_url`
  with the `whsec_` signature (`X-Pesarc-Signature: t,v1`) + retries
  (`sdk/webhooks.ts`); fires once on pending->paid, never blocks the redirect.
  Verify snippet in the dashboard.
- [ ] **SDK snippet + docs page** (`/developers/docs`) with Node/curl quickstart.

## Phase 2 — Finish the partial

- [ ] **OPay redirect hardening.** Idempotency keys on create, session expiry, a
  cancel path back to the merchant, amount/label locked server-side.
- [ ] **Business-vs-retail persona is server-side** (today localStorage only):
  persist persona on the account so guards survive a new device.

## Phase 3 — De-mock the money features

- [x] **Send FX pricing real by default.** Live pool quote stays primary; when it
  is unavailable the UI labels the number "indicative" (locked at settlement)
  instead of showing the mock as final, and `QuoteBreakdown` shows a source badge.
  (`sdk/quote.ts` + `sdk/chain/liveQuote.ts`.)
- [~] **Earn / LP real.** Live USD<->NGN hub TVL is read on-chain
  (`sdk/chain/livePool.ts`); Earn tags corridors Live vs Soon. Positions are now
  DURABLE server records per account (`sdk/earn-positions.ts` + `/api/earn`,
  Postgres + JSONL fallback) instead of React state, and EarnFlow loads/persists
  deposits + withdrawals. Still TODO (contracts task, deliberately deferred as
  money-risk): real on-chain LP via a deposit/zap into the v4 pool — safe
  single-token LP needs an audited vault + liquidity math, not a frontend hack.
  Retail-balance red line stays.
- [~] **On-chain African stocks real.** Holdings + orders are now DURABLE server
  records per account (`sdk/holdings.ts` + `/api/invest`, Postgres + JSONL
  fallback) with rolled average cost, not localStorage. Orders route server-side
  through the broker adapter (`sdk/broker.ts`): simulated by default, a real
  tokenized-equity / licensed broker when `BROKER_API_URL` is set (the live
  `httpBroker` is implemented). The UI shows a "Preview prices" badge until the
  feed is live. `[!]` remaining: a venue/broker account + a market-data feed to
  flip `BROKER_API_URL` on.
- [!] **cNGN real API.** Replace the testnet "test cNGN" token with the regulated
  cNGN issuer's mint/redeem API + attestation. Needs the cNGN issuer relationship
  and KYB. Keep the on-chain plumbing; swap the token + add issuer calls.

## Phase 4 — Build the absent

- [~] **Bills: Airtime / Data / Electricity.** In-app flow shipped (`/bills`,
  `BillsFlow.tsx`) + adapter seam (`sdk/bills.ts`, simulated sandbox default, real
  provider env-gated via `BILLS_PROVIDER_URL`) + `/api/bills` (Nigeria-first
  operators, data plans, prepaid electricity token). **Agent bill-pay intent DONE**
  (`sdk/agent/bill-intent.ts` — "buy 1GB of MTN data for 0803…", "pay 5k Ikeja
  electricity meter 041…"; asks for missing fields; wired into `/api/agent/settle`,
  no LLM needed). Still TODO: `[!]` a real provider (Reloadly / VTpass / Flutterwave).
- [x] **USSD payment support.** DONE: stateless menu engine (`sdk/ussd.ts`) +
  `/api/ussd` webhook (Africa's Talking CON/END format). Buy airtime/data (network
  inferred from the caller's number), pay electricity (DisCo → meter → amount →
  token), send money, all through the shared bills adapter. `[!]` remaining: point
  a real AT/telco shortcode callback at `/api/ussd`.
- [~] **WhatsApp agent.** DONE against the sandbox: `/api/whatsapp` webhook (GET
  verify handshake + POST bridge, signature-verified, retry-deduped) forwards
  text to the SHARED agent brain (`sdk/agent/run.ts`, now used by both the in-app
  chat and WhatsApp) and replies over the Cloud API (`sdk/whatsapp.ts`). Runs in
  "sandbox" (logs replies) until env is set. `[!]` remaining: connect a real
  WhatsApp Business number (Meta/Twilio) + set `WHATSAPP_*`; then WhatsApp voice
  notes (server-side transcription).
- [x] **Voice input (both agents).** In-app mic via the Web Speech API
  (`components/app/useSpeechInput.ts` + a mic in `AgentChat`). WhatsApp voice notes
  DONE too: `/api/whatsapp` downloads the audio and transcribes it
  (`sdk/transcribe.ts`, OpenAI-compatible seam) before running the shared agent,
  echoing back what it heard. `[!]` remaining: set `TRANSCRIBE_API_KEY` (a
  transcription provider) to turn WhatsApp voice on.
- [!] **Hyperliquid / aqua0 liquidity.** Tap Hyperliquid liquidity on Base +
  aqua0. Needs the integration spec + accounts; scope a `LiquiditySource` seam so
  the hub can route to it, then implement once access exists.

## Phase 5 — Infra the features lean on

- [~] **Dev / staging / prod separation.** App is env-aware (`sdk/env.ts` +
  `EnvBadge`, `APP_ENV`/`NEXT_PUBLIC_APP_ENV`). Droplet runs three separate stacks
  (own container + own Postgres instance each): production = top-level units;
  staging/dev under `deploy/envs/`; full runbook in `deploy/ENVIRONMENTS.md`
  (subdomains, ports, per-env env files, Caddy blocks, promotion flow). Still TODO
  on the droplet: create the two new DB instances + env files + Caddy routes, and
  add per-branch image tags to CI (`main→latest, staging→staging, dev→dev`).
- [x] **Real migrations.** `scripts/migrate.mjs` (`pnpm db:migrate`) applies the
  idempotent `deploy/schema.sql` (all 8 tables + indexes + a `schema_migrations`
  ledger) per env against its own `DATABASE_URL`; `--dry-run` prints statements.
  Verified against a real Postgres (creates the schema, idempotent on re-run). The
  app keeps `ensureSchema` as a zero-config dev fallback, but the script is now the
  source of truth.
- [x] **Move keepers to `apps/worker`.** A single dependency-free Node worker
  (`apps/worker/src/index.mjs`) owns the keeper schedules (settlement solver + FX
  oracle push), driving the app's authenticated routes; env-gated, idles when
  unconfigured, graceful shutdown. Quadlet unit `deploy/pesarc-worker.container`
  supersedes `pesarc-solve.service`/`.timer`. Verified: idle + configured ticks +
  error handling + SIGTERM.
- [x] **Public API rate limits + usage metering** backed by the store.
  `sdk/api/rate-limit-store.ts`: a Postgres fixed-window limiter (shared across
  instances, per API key) that FAILS OPEN behind the in-memory floor, plus a
  daily usage meter. Wired into `/api/v1/*` (keyed by api key id); `/api/usage`
  and the Developers dashboard show "requests today". Verified against a real
  Postgres: the shared bucket increments per call and the fixed window returns
  429 past the limit.

## External dependencies to provision (unblock the `[!]` items)

| Item | Needs |
| --- | --- |
| cNGN real API | cNGN issuer relationship + KYB |
| On-chain stocks | tokenized-equity venue or licensed broker API + market data |
| Bills | Reloadly / VTpass / Flutterwave Bills key |
| USSD | Africa's Talking (or telco) shortcode + gateway |
| WhatsApp | WhatsApp Business API number (Meta / Twilio) |
| Hyperliquid / aqua0 | integration spec + accounts |

Everything not marked `[!]` is buildable in-repo now and is what the loop works
through first.
