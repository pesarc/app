-- Pesarc schema for the self-hosted Postgres. Idempotent — safe to re-run.
-- Mirrors apps/web/scripts/migrate.mjs (the app also self-heals via lazy
-- CREATE TABLE IF NOT EXISTS, but run this once at deploy so the schema is
-- owned explicitly rather than on the request hot path).

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
