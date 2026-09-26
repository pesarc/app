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
- [~] **Earn / LP real.** The live USD<->NGN hub corridor now reads real TVL
  on-chain (`sdk/chain/livePool.ts`, v4 PoolManager balances + oracle mid); Earn
  tags corridors Live vs Soon. Still TODO: real on-chain deposits/withdrawals
  through the pool and live fee-APY (retail-balance red line stays).
- [!] **On-chain African stocks real.** Wire `sdk/broker.ts` to a real tokenized-
  equity venue (or a licensed broker API via `BROKER_API_URL`). Needs a venue /
  broker account + market-data feed. Until then: mark the catalog clearly as a
  preview, not live prices.
- [!] **cNGN real API.** Replace the testnet "test cNGN" token with the regulated
  cNGN issuer's mint/redeem API + attestation. Needs the cNGN issuer relationship
  and KYB. Keep the on-chain plumbing; swap the token + add issuer calls.

## Phase 4 — Build the absent

- [~] **Bills: Airtime / Data / Electricity.** In-app flow shipped (`/bills`,
  `BillsFlow.tsx`) + adapter seam (`sdk/bills.ts`, simulated sandbox default, real
  provider env-gated via `BILLS_PROVIDER_URL`) + `/api/bills` (Nigeria-first
  operators, data plans, prepaid electricity token). Still TODO: agent intent
  ("buy 1GB", "pay PHCN 5k") and `[!]` wiring a real provider (Reloadly / VTpass /
  Flutterwave Bills).
- [ ] **USSD payment support.** Session state machine + an aggregator webhook
  (`/api/ussd`). `[!]` on a USSD gateway (Africa's Talking / a telco shortcode);
  build the menu engine + `/api/ussd` handler against the AT simulator first.
- [ ] **WhatsApp agent.** `/api/whatsapp` webhook bridging WhatsApp <-> the
  existing agent (`/api/agent/settle`). `[!]` on a WhatsApp Business API number
  (Meta / Twilio); build the webhook + message mapping against the sandbox.
- [ ] **Voice input (both agents).** In-app mic via Web Speech / MediaRecorder to
  a transcription endpoint, feeding the agent; WhatsApp voice notes transcribed
  server-side. In-app voice is fully buildable now; WhatsApp voice rides Phase 4's
  WhatsApp item.
- [!] **Hyperliquid / aqua0 liquidity.** Tap Hyperliquid liquidity on Base +
  aqua0. Needs the integration spec + accounts; scope a `LiquiditySource` seam so
  the hub can route to it, then implement once access exists.

## Phase 5 — Infra the features lean on

- [ ] **Real migrations.** A `scripts/migrate.mjs` that owns the schema (api_keys,
  payment_sessions, and the rest), so `ensureSchema` DDL fallbacks can retire.
- [ ] **Move keepers to `apps/worker`.** The cron/solver/oracle logic currently
  inline in API routes becomes a real worker process.
- [ ] **Public API rate limits + usage metering** backed by the store (today's
  limiter is per-instance memory).

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
