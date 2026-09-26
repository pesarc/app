// Pesarc keeper worker: one long-lived process that runs the scheduled keepers
// (settlement solver + FX oracle push), replacing the ad-hoc systemd solve
// timer. Execution logic stays in the app's authenticated routes; the worker
// owns the scheduling, retries and logging in one place, off the request path.
//
// It drives the app over HTTP (the app is a long-lived container on the droplet,
// not serverless), so it needs no build step and never imports the browser SDK.
//
// Env:
//   WORKER_TARGET          base URL of the web app (default http://127.0.0.1:3000)
//   CRON_SECRET            bearer for GET /api/cron/solve (solver keeper)
//   OPERATOR_API_SECRET    bearer for POST /api/oracle/push (oracle keeper)
//   SOLVE_INTERVAL_MS      solver cadence (default 300000 = 5 min)
//   ORACLE_INTERVAL_MS     oracle cadence (default 900000 = 15 min)
//   WORKER_HTTP_TIMEOUT_MS per-request timeout (default 60000)

const TARGET = (process.env.WORKER_TARGET || "http://127.0.0.1:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET || "";
const OPERATOR_SECRET = process.env.OPERATOR_API_SECRET || "";
const SOLVE_MS = int(process.env.SOLVE_INTERVAL_MS, 300_000);
const ORACLE_MS = int(process.env.ORACLE_INTERVAL_MS, 900_000);
const HTTP_TIMEOUT = int(process.env.WORKER_HTTP_TIMEOUT_MS, 60_000);

function int(v, d) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function log(msg, extra) {
  const line = `[worker ${new Date().toISOString()}] ${msg}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

async function call(method, pathname, secret) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT);
  try {
    const res = await fetch(`${TARGET}${pathname}`, {
      method,
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined,
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function tickSolve() {
  try {
    const { status, body } = await call("GET", "/api/cron/solve", CRON_SECRET);
    if (status === 200 && body.ok) {
      log(`solve: settled=${(body.settled || []).length} skipped=${(body.skipped || []).length} open=${body.openIntents ?? "?"}`);
    } else if (status === 501 || status === 503) {
      // Not enabled on this deployment — quiet, expected in sandbox.
    } else {
      log(`solve: HTTP ${status}`, body.error || "");
    }
  } catch (e) {
    log("solve: request failed", e instanceof Error ? e.message : e);
  }
}

async function tickOracle() {
  try {
    const { status, body } = await call("POST", "/api/oracle/push", OPERATOR_SECRET);
    if (status === 200 && body.ok) {
      log(`oracle: pushed rate=${body.pushed?.rate} src=${body.pushed?.source} tx=${body.tx?.slice?.(0, 10)}…`);
    } else if (status === 501) {
      // Keeper not enabled — quiet.
    } else {
      log(`oracle: HTTP ${status}`, body.error || "");
    }
  } catch (e) {
    log("oracle: request failed", e instanceof Error ? e.message : e);
  }
}

const timers = [];
function every(ms, fn, startDelay) {
  setTimeout(() => {
    fn();
    timers.push(setInterval(fn, ms));
  }, startDelay);
}

function main() {
  const solveOn = Boolean(CRON_SECRET);
  const oracleOn = Boolean(OPERATOR_SECRET);
  log(`starting. target=${TARGET} solver=${solveOn ? `every ${SOLVE_MS / 1000}s` : "off (no CRON_SECRET)"} oracle=${oracleOn ? `every ${ORACLE_MS / 1000}s` : "off (no OPERATOR_API_SECRET)"}`);
  if (!solveOn && !oracleOn) {
    log("no keepers configured — idling. Set CRON_SECRET / OPERATOR_API_SECRET to enable.");
  }
  // Stagger the first runs so they don't hit the app at the same instant.
  if (solveOn) every(SOLVE_MS, tickSolve, 3_000);
  if (oracleOn) every(ORACLE_MS, tickOracle, 8_000);

  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      log(`${sig} received — shutting down.`);
      for (const t of timers) clearInterval(t);
      process.exit(0);
    });
  }
}

main();
