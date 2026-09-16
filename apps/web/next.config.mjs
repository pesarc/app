import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load the monorepo-root .env (apps/web runs from a subdir), so the whole app
// is configured from one app/.env instead of a copy per package. Dependency-free
// (pnpm doesn't expose @next/env to this package); values already in the
// environment or in apps/web/.env* win, so nothing here overrides a real deploy.
(function loadRootEnv() {
  try {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const raw = fs.readFileSync(path.join(repoRoot, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const eq = s.indexOf("=");
      if (eq === -1) continue;
      const key = s.slice(0, eq).trim();
      if (!key || key in process.env) continue;
      let val = s.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    /* no root .env — rely on the environment / apps/web/.env */
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for containers (Docker/Podman). Trace from the
  // monorepo root so workspace deps (@pesarc/*) are bundled into standalone.
  output: "standalone",
  outputFileTracingRoot: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  // globe.gl + three-globe ship ESM only — let Next compile them.
  transpilePackages: ["globe.gl", "three-globe", "@pesarc/sdk", "@pesarc/abi", "@pesarc/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  webpack: (config) => {
    // Ignore optional Privy Solana deps we don't use — they only warn in dev but
    // hard-fail a production `next build`. memo: Privy's funding plugin, whose
    // build wants a @solana/kit subpath our pinned kit doesn't export.
    // @farcaster/mini-app-solana: an optional Farcaster mini-app connector.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@solana-program/memo": false,
      "@farcaster/mini-app-solana": false,
    };
    return config;
  },
};

export default nextConfig;
