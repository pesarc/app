# @pesarc/worker

The keeper worker: one long-lived process that runs Pesarc's scheduled keepers,
off the request path. It replaces the ad-hoc `pesarc-solve` systemd timer with a
single managed process that owns the scheduling, retries and logging.

Today it drives two keepers by calling the app's own authenticated routes (the
app is a long-lived container on the droplet, so its routes are the execution
layer; the worker is the scheduler):

- **Settlement solver** — `GET /api/cron/solve` every `SOLVE_INTERVAL_MS`
  (default 5 min), bearer `CRON_SECRET`.
- **FX oracle push** — `POST /api/oracle/push` every `ORACLE_INTERVAL_MS`
  (default 15 min), bearer `OPERATOR_API_SECRET`.

It stays a pure scheduler on purpose: no build step, and it never imports the
browser SDK. As more keepers land (CCTP relay, market resolver, x402
settlement), add a tick here that calls the matching route.

## Run

```bash
pnpm --filter @pesarc/worker start
```

Config is env (see `deploy/ENVIRONMENTS.md` and `src/index.mjs`):
`WORKER_TARGET` (default `http://127.0.0.1:3000`), `CRON_SECRET`,
`OPERATOR_API_SECRET`, `SOLVE_INTERVAL_MS`, `ORACLE_INTERVAL_MS`. With neither
secret set it idles (safe default). On the droplet it runs as a Quadlet unit
(`deploy/pesarc-worker.container`), one per environment, and supersedes
`pesarc-solve.service` / `pesarc-solve.timer`.
