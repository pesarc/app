-- Pesarc schema for the self-hosted Postgres. Idempotent — safe to re-run.
-- This is the source of truth, applied by scripts/migrate.mjs (`pnpm db:migrate`).
-- The app also self-heals via lazy CREATE TABLE IF NOT EXISTS as a zero-config
-- dev fallback, but production runs this once at deploy so the schema is owned
-- explicitly rather than on the request hot path.

CREATE TABLE IF NOT EXISTS waitlist (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfers (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account             text NOT NULL DEFAULT 'demo',
  direction           text NOT NULL,
  counterparty        text NOT NULL,
  counterparty_handle text,
  send_amount         numeric NOT NULL,
  send_currency       text NOT NULL,
  receive_amount      numeric NOT NULL,
  receive_currency    text NOT NULL,
  payout              text NOT NULL,
  reference           text NOT NULL,
  flag                text,
  tx_hash             text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tx_hash text;
CREATE INDEX IF NOT EXISTS transfers_account_created_idx
  ON transfers (account, created_at DESC);

CREATE TABLE IF NOT EXISTS payouts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account      text NOT NULL DEFAULT 'demo',
  reference    text NOT NULL,
  beneficiary  text NOT NULL,
  method       text NOT NULL,
  amount_ngn   numeric NOT NULL,
  tx_hash      text,
  partner_ref  text NOT NULL,
  status       text NOT NULL DEFAULT 'initiated',
  provider     text NOT NULL DEFAULT 'simulated',
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'demo';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'initiated';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'simulated';
CREATE INDEX IF NOT EXISTS payouts_account_ref_idx ON payouts (account, reference);
CREATE INDEX IF NOT EXISTS payouts_partner_ref_idx ON payouts (partner_ref);

-- Admin catalog (markets / stocks / agents), edited via /api/admin/catalog.
CREATE TABLE IF NOT EXISTS catalog_items (
  id         text PRIMARY KEY,
  kind       text NOT NULL,
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Developer API keys (secret stored hashed; whsec kept for signing).
CREATE TABLE IF NOT EXISTS api_keys (
  id             text PRIMARY KEY,
  account        text NOT NULL,
  label          text NOT NULL DEFAULT 'API key',
  publishable    text NOT NULL,
  secret_prefix  text NOT NULL,
  secret_hash    text NOT NULL,
  signing_secret text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  revoked_at     timestamptz
);
CREATE INDEX IF NOT EXISTS api_keys_secret_hash_idx ON api_keys (secret_hash);

-- Payment sessions (OPay-style checkout).
CREATE TABLE IF NOT EXISTS payment_sessions (
  id             text PRIMARY KEY,
  account        text NOT NULL,
  api_key_id     text NOT NULL,
  amount         numeric NOT NULL,
  currency       text NOT NULL,
  reference      text NOT NULL,
  merchant_name  text NOT NULL DEFAULT 'A Pesarc merchant',
  description    text,
  redirect_url   text NOT NULL,
  webhook_url    text,
  payout_address text,
  metadata       jsonb,
  status         text NOT NULL DEFAULT 'pending',
  customer_label text,
  tx_hash        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  paid_at        timestamptz,
  expires_at     timestamptz NOT NULL
);
ALTER TABLE payment_sessions ADD COLUMN IF NOT EXISTS webhook_url text;
CREATE INDEX IF NOT EXISTS payment_sessions_account_idx
  ON payment_sessions (account, created_at DESC);

-- Durable earn positions (one per account+pool).
CREATE TABLE IF NOT EXISTS earn_positions (
  account    text NOT NULL,
  pool_id    text NOT NULL,
  principal  numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, pool_id)
);

-- Durable invest holdings (one per account+symbol, volume-weighted avg cost).
CREATE TABLE IF NOT EXISTS holdings (
  account    text NOT NULL,
  symbol     text NOT NULL,
  shares     numeric NOT NULL,
  avg_price  numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, symbol)
);

-- Shared fixed-window rate limits for the public API (cross-instance).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket   text PRIMARY KEY,
  count    integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_reset_idx ON rate_limits (reset_at);

-- Daily developer-API usage meter.
CREATE TABLE IF NOT EXISTS api_usage (
  account text NOT NULL,
  key_id  text NOT NULL,
  day     date NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (account, key_id, day)
);

-- Migration ledger (each `pnpm db:migrate` records a row).
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
