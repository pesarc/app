# Pesarc

**One simple app to send, hold, earn and settle money across borders — in your own currency.**

Money the way you already think about it: you send naira, your cousin receives
cedis, a trader in Nairobi gets shillings. No big fees, no waiting, no jargon.

🌍 **Landing** → [pesarc.xyz](https://pesarc.xyz) · 📱 **App** → [app.pesarc.xyz](https://app.pesarc.xyz) · 📚 **Docs** → [docs.pesarc.xyz](https://docs.pesarc.xyz)

> The private product monorepo — web, mobile, backend, and the shared SDK.
> Turborepo + pnpm workspaces. The smart contracts live in the sibling public
> repo [`pesarc/contracts`](https://github.com/pesarc/contracts).

---

## What Pesarc is

A non-custodial, mobile-first money app for the Global South. One product, a few
everyday jobs:

- **Send** — to a contact, a phone number, a bank account, a mobile-money
  wallet, or straight to any crypto wallet. Same flow, whatever the destination.
- **Cash out** — deliver local currency into a bank account or mobile-money
  wallet in-country, through licensed local partners.
- **Hold & earn** — keep a balance and put it to work.
- **Ask** — an in-app agent that understands plain language, acts only on *your*
  own account, and asks before anything irreversible.

Everything is priced and shown **before** you confirm — the rate, the fee, the
arrival time. Nothing hidden.

### Under the hood (the part people never see)

Value moves over the fastest available rail — stablecoins across several
chains, bridged when a transfer crosses one — and is converted to the
recipient's local currency on the last mile. The settlement leg happens in a
US-dollar-pegged stablecoin, but that's plumbing: a sender picks an amount in
their currency and a recipient is paid in theirs. The dollar never surfaces in
the experience, and it isn't meant to.

---

## Repo layout

```
apps/
  web/      Next.js 15 consumer app (Send · Markets · Invest · Activity · Ask)
  mobile/   Expo (React Native) — same screens, shared core
  api/      backend request/response (agent, quote/settle, x402, waitlist)
  worker/   keepers: solver, CCTP relay, oracle recorder, market resolver
packages/
  sdk/      VM-neutral core: matching, oracle client, ChainAdapter, intents,
            the agent brain, the off-ramp rail, money math
  abi/      generated ABIs + Anchor IDLs — single source of truth
  ui/       shared brand tokens/components (web + mobile)
  config/   shared tsconfig / lint presets
deploy/     container + droplet deploy assets
```

### Why a monorepo

Web, mobile, backend and keepers share the *same* TypeScript — chain clients,
the settlement SDK, ABIs, types. A contract change regenerates `@pesarc/abi` and
every surface updates atomically, in one PR. No internal-SDK version dance, no
ABI hand-copied into the frontend, no cross-repo path hacks.

---

## How money moves

Pesarc routes each transfer down the simplest path that reaches the destination:

- **Wallet → wallet, same chain** — a direct token transfer, no intermediary.
- **Wallet → wallet, cross-chain** — burn on the source chain, mint to the
  recipient on the destination chain (CCTP), funds arriving straight to them.
- **Cash out to bank / mobile money** — a two-leg settlement:
  1. **On-chain leg (debits the sender):** the user's stablecoin moves to a
     Pesarc-controlled **escrow** wallet.
  2. **Fiat leg (pays the recipient):** a licensed local partner pays the
     local-currency amount from a funded **float**; the escrowed balance
     replenishes that float.

  The payout only ever fires *after* the on-chain debit confirms — the two legs
  are never allowed to drift out of step, so a recipient is never paid without
  the sender being charged, and vice-versa.

The off-ramp is a **per-country, health-selected rail**: each market maps to an
ordered list of partners and the first healthy one handles the payout. Today
that's Bachs (live in Nigeria) and Paystack, with more corridors to follow.

---

## The agent

The in-app assistant turns plain language ("send 20k to mum", "cash out half to
my OPay") into a concrete, previewed action. It's scoped to the **signed-in user
only** — it has no access to other accounts, org data, or admin surfaces —
corrects mistaken instructions, refuses unsafe ones (e.g. moving funds between
test and live environments), and always confirms before anything irreversible.
Intent understanding is provider-agnostic behind a small interface.

---

## Quickstart

```bash
pnpm install
pnpm dev                          # all apps (turbo)
pnpm --filter @pesarc/web dev     # just the web app
pnpm --filter @pesarc/mobile dev  # just mobile (Expo)
pnpm turbo typecheck              # typecheck the whole workspace
```

Copy `apps/web/.env.example` to configure the web app. In dev with no env, the
app runs in a safe simulated ("mock") mode; setting the live keys switches real
wallets and real settlement on.

### Environment essentials

`NEXT_PUBLIC_*` values are **inlined at build time** (they ship in the client
bundle); server secrets are read at runtime on the host. A few that matter:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Auth — switches the app from mock to live mode |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` / `…_GAS_POLICY_ID` | Smart-wallet + gas sponsorship |
| `NEXT_PUBLIC_RAMP_ESCROW` | Pesarc-controlled escrow wallet that receives cash-out inflow. **Must be set per environment, and must not be any sender's own wallet** — there is no default, so an unset escrow fails the cash-out safety check rather than self-sending. |
| `RAMP_COUNTRY_PROVIDERS` | Maps each country to its ordered off-ramp partners (e.g. `NG:bachs,paystack`) |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | The agent's language model |

See `apps/web/.env.example` for the full list.

---

## Deploy

The web app ships as a container image:

1. **build-image** (GitHub Actions) builds the image, inlining the
   `NEXT_PUBLIC_*` values from the `BUILD_DOTENV` secret.
2. The host pulls the new image and restarts the service
   (`sudo systemctl restart pesarc-web`).

Because `NEXT_PUBLIC_*` is baked in at build time, changing one of those values
(like the escrow address) requires a **new build**, not just a restart.

---

## Conventions

- Server components by default; `bigint` for token amounts; no `any`; addresses
  typed `` `0x${string}` ``.
- **Money math fails closed** — when something is uncertain, we refuse rather
  than guess, and a payout never runs ahead of its on-chain leg.
- Honest copy: no "free" or "gasless" where a real cost exists; errors are
  written for people, not stack traces.
- Branch → PR → `main`. See `MIGRATION.md` for how the legacy repos fold in.

---

Built for the Global South, first. More at [docs.pesarc.xyz](https://docs.pesarc.xyz).
