# StableArc · app

The private product monorepo — web, mobile, backend, and the shared SDK.
Turborepo + pnpm workspaces. Contracts live in the sibling public repo
[`stablearc/contracts`](https://github.com/stablearc/contracts).

```
apps/
  web/      Next.js 15 consumer app (Send · Markets · Invest · Activity · Ask)
  mobile/   Expo (React Native) — same screens, shared core
  api/      backend request/response (agent, quote/settle, x402, waitlist)
  worker/   keepers: solver, CCTP relay, oracle recorder, market resolver
packages/
  sdk/      VM-neutral core: matching, oracle client, ChainAdapter, intents
  abi/      generated ABIs + Anchor IDLs — single source of truth
  ui/       shared brand tokens/components (web + mobile)
  config/   shared tsconfig / lint presets
```

## Why a monorepo
Web, mobile, backend and keepers share the *same* TypeScript — chain clients,
the settlement SDK, ABIs, types. A contract change regenerates `@pesarc/abi`
and every surface updates atomically, in one PR. No internal-SDK version dance,
no ABI hand-copied into the frontend, no cross-repo path hacks.

## Quickstart
```bash
pnpm install
pnpm dev            # all apps (turbo)
pnpm --filter @pesarc/web dev
pnpm --filter @pesarc/mobile dev
```

## Conventions
Server components by default; `bigint` for token amounts; no `any`; addresses
typed `0x${string}`. Money math fails closed. Branch `dev` → PR → `main`.
See `MIGRATION.md` for how the current repos fold in.
