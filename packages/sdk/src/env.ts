// Which deployment environment this process is: development, staging, or
// production. Drives env-aware behavior (a visible ribbon off-prod, safer
// defaults) and keeps dev/staging/prod cleanly separated.
//
// Server code reads APP_ENV. The browser only sees NEXT_PUBLIC_* at build time,
// so a client build MUST set NEXT_PUBLIC_APP_ENV for the badge to know it is
// non-prod (an unset value resolves to production, which is the safe default —
// no ribbon shown when we are unsure).

export type AppEnv = "development" | "staging" | "production";

function resolve(): AppEnv {
  const raw = (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    ""
  ).toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "stage") return "staging";
  if (raw === "development" || raw === "dev" || raw === "local") return "development";
  // No explicit signal: only a production Node build is treated as production.
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

export const APP_ENV: AppEnv = resolve();
export const isProduction = APP_ENV === "production";
export const isStaging = APP_ENV === "staging";
export const isDevelopment = APP_ENV === "development";

export const envLabel =
  APP_ENV === "production" ? "Production" : APP_ENV === "staging" ? "Staging" : "Development";

/** Show an environment ribbon everywhere except production. */
export const showEnvBadge = APP_ENV !== "production";
