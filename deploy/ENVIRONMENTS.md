# Environments: dev, staging, production

Three fully separate stacks on the droplet, each with its **own container and
its own Postgres instance**, so test data never touches production. Same image,
different `APP_ENV` + `DATABASE_URL` + secrets.

| Env | Branch | Subdomain | Web port | DB instance | Image tag | Env dir |
| --- | --- | --- | --- | --- | --- | --- |
| production | `main` | app.pesarc.xyz | 127.0.0.1:3000 | `pesarc-db` | `:latest` | `/etc/pesarc` |
| staging | `staging` | staging.pesarc.xyz | 127.0.0.1:3001 | `pesarc-db-staging` | `:staging` | `/etc/pesarc/staging` |
| dev | `dev` | dev.pesarc.xyz | 127.0.0.1:3002 | `pesarc-db-dev` | `:dev` | `/etc/pesarc/dev` |

Production is the existing top-level units (`pesarc-web.container`,
`pesarc-db.container`). Staging and dev are under `envs/staging/` and `envs/dev/`.
All stacks share `pesarc.network`; each reaches its own DB by alias
(`pesarc-db-<env>`).

The app knows its environment from `APP_ENV` (server) and `NEXT_PUBLIC_APP_ENV`
(browser, baked at build time). Off production it shows a corner ribbon
(`components/app/EnvBadge.tsx`, driven by `sdk/env.ts`). An unset value resolves
to production, so staging/dev **must** set both.

## How code promotes

`dev` → `staging` → `main`, each merge triggering that env's image build:

- Work lands on `dev`, deploys to dev.pesarc.xyz.
- Promote by merging `dev` → `staging` (deploys to staging.pesarc.xyz).
- Release by merging `staging` → `main` (deploys to app.pesarc.xyz).

CI must build a tag per branch. Point the image workflow at:
`main → :latest`, `staging → :staging`, `dev → :dev`
(`.github/workflows/build-image.yml`). Each stack has `AutoUpdate=registry`, so
`podman auto-update` (or the timer) pulls its tag.

## One-time droplet setup (per env, e.g. staging)

```bash
# 1. Env files (root-only). One directory per env.
sudo mkdir -p /etc/pesarc/staging
sudoedit /etc/pesarc/staging/pesarc.env   # app env — see the template below
sudoedit /etc/pesarc/staging/db.env       # POSTGRES_USER/PASSWORD/DB
sudo chmod 600 /etc/pesarc/staging/*.env

# 2. Install the units (network is shared, already installed).
sudo cp deploy/envs/staging/pesarc-db-staging.container /etc/containers/systemd/
sudo cp deploy/envs/staging/pesarc-web-staging.container /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl start pesarc-db-staging
# Create the schema in the NEW instance (psql or deploy/schema.sql):
#   podman exec -i pesarc-db-staging psql -U pesarc -d pesarc < deploy/schema.sql
sudo systemctl start pesarc-web-staging

# 3. Route the subdomain (append to /etc/caddy/Caddyfile, then reload caddy).
```

`/etc/pesarc/staging/pesarc.env` (the parts that MUST differ per env):

```ini
APP_ENV=staging
NEXT_PUBLIC_APP_ENV=staging
DATABASE_URL=postgres://pesarc:<staging-pw>@pesarc-db-staging:5432/pesarc
NEXT_PUBLIC_SITE_URL=https://staging.pesarc.xyz
# Non-prod secrets only: sandbox/test keys for Paystack, bills, operator keys,
# a SEPARATE Privy app, etc. Never put production live keys in staging/dev.
```

Repeat for `dev` (swap `staging` → `dev`, port 3002, subdomain dev.pesarc.xyz).

## Caddy blocks to add

```caddyfile
staging.pesarc.xyz {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
}

dev.pesarc.xyz {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3002
}
```

Point `staging` and `dev` A records at the droplet IP; Caddy issues a cert per
host on demand. Consider Basic Auth on dev/staging (`basic_auth` block) so they
stay private.

## Databases — one instance per env

Chosen topology: **3 separate instances**. Two ways to run each:

1. **Co-located container** (the `pesarc-db-<env>` units here): separate
   container + separate named volume `pesarc-db-<env>-data`. Simple, all on the
   droplet. Back each up separately (extend `pesarc-db-backup.sh` per env).
2. **Managed Postgres** (DigitalOcean/Neon): skip the DB unit and point that
   env's `DATABASE_URL` at the managed instance. Recommended for production.

Either way, migrations run against each instance independently.

## Migrations

`deploy/schema.sql` is the source of truth (idempotent). Apply it per env with
its own `DATABASE_URL`:

```bash
DATABASE_URL=postgres://…/pesarc pnpm db:migrate        # runs scripts/migrate.mjs
node scripts/migrate.mjs --dry-run                       # print statements, no DB
```

Run it on every deploy, before starting the web + worker. The app still
self-heals via lazy `CREATE TABLE IF NOT EXISTS`, but that is a dev fallback, not
the source of truth. Each run records a row in `schema_migrations`.

## Keeper worker

`apps/worker` is a single dependency-free Node process that runs the scheduled
keepers (settlement solver + FX oracle push) by calling the app's authenticated
routes. It supersedes `pesarc-solve.service` / `pesarc-solve.timer`.

Deploy: copy `apps/worker/src/index.mjs` to `/opt/pesarc/worker/index.mjs`,
install `deploy/pesarc-worker.container`, and set `CRON_SECRET` +
`OPERATOR_API_SECRET` in that env's `pesarc.env`. It reaches the web app by its
network alias (`WORKER_TARGET=http://pesarc-web-<env>:3000`). With neither secret
set it idles. One worker per environment.

## Safety rules

- Production live keys (Privy prod app, real Paystack/bills keys, mainnet
  operator keys) live ONLY in `/etc/pesarc/pesarc.env`. Staging/dev use test or
  sandbox keys and their own throwaway wallets.
- Never point two envs at the same `DATABASE_URL`.
- The off-prod ribbon is the quick visual check you are not on production.
