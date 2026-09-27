# Go-live config — make login, wallets and gasless real in prod

Right now the app runs live-with-fallback: when Privy + Alchemy + a corridor
pool aren't wired for the environment, it shows demo balances and mock quotes.
This is the checklist to turn each part on for `app.pesarc.xyz` (the droplet).

`NEXT_PUBLIC_*` values are baked into the client at **build time**, so they go in
the CI build secret (`BUILD_DOTENV`) and take effect on the next deploy. Server
secrets go in the droplet's `/etc/pesarc/pesarc.env`.

## 1. Privy (auth + embedded wallets)

Dashboard: <https://dashboard.privy.io> → your app.

1. **Login methods** → enable **Google, Email, Passkey, Wallet (external)** to
   match the code (`WalletProvider.tsx`). SMS stays off (we use our own — see
   `AUTH_OWN_STACK.md`).
2. **Allowed origins / domains** → add `https://app.pesarc.xyz` and, for dev,
   `http://localhost:3055`. Without this, login silently fails on prod.
3. **Embedded wallets** → confirm "create on login" for EVM (and Solana) is on
   (the code requests `all-users`).
4. **Google branding (recommended)** → under Google login, add **your own Google
   OAuth client** so the consent screen says pesarc.xyz (steps in §3). Otherwise
   Privy's default Google is used (works, but shows Privy branding).
5. Copy the **App ID** → set `NEXT_PUBLIC_PRIVY_APP_ID` in `BUILD_DOTENV`.
   (There's already a `PROD_PRIVY_APP_ID` in your `.env`; use the prod app's ID.)

## 2. Alchemy (gasless smart accounts)

Dashboard: <https://dashboard.alchemy.com>.

1. Create an **App** for your hub chain; copy the **API key** →
   `NEXT_PUBLIC_ALCHEMY_API_KEY`.
2. **Gas Manager** → create a **gas policy** (sponsorship rules: which
   contracts/methods, per-user + global caps). Copy the **policy ID** →
   `NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID` (and the per-chain ones,
   `NEXT_PUBLIC_ALCHEMY_GAS_POLICY_ID_ARB_SEPOLIA` etc. from `wallet/config.ts`
   if you sponsor multiple chains).
3. **Fund the policy** — gasless only works while the policy has balance. Start
   small, watch the burn.

Both `ALCHEMY_API_KEY` and a `GAS_POLICY_ID` must be set or `isSmartWalletConfigured`
is false and sends fall back to the demo path.

## 3. Google OAuth client (for branded Google login + consent)

Google Cloud Console: <https://console.cloud.google.com>.

1. New project → **APIs & Services → OAuth consent screen**: External, app name
   "Pesarc", support email, logo, **authorized domain `pesarc.xyz`**, scopes
   `email profile openid`. Add the **Privacy Policy** (`pesarc.xyz/privacy`) and
   **Terms** (`pesarc.xyz/terms`) URLs — Google requires them.
2. **Credentials → Create OAuth client ID → Web application**. Authorized
   redirect URI = the one Privy shows in its Google-login config.
3. Paste the **client ID + secret** into Privy's Google login settings.
4. Publish the consent screen (or add test users while in testing).

## 4. Corridor / contracts env (live quotes + on-chain send)

For the live USDC→cNGN corridor to price and settle, set the pool + token
addresses the frontend reads (`chain/contracts.ts` / registry), e.g. on the hub:
`NEXT_PUBLIC_*_POOL_MANAGER`, `_SWAP_ROUTER`, `_TOKEN_USD`, `_TOKEN_NGN`
(and `_TOKEN_GHS`, `_TOKEN_KES` as those corridors come online — see
`CORRIDORS_ROADMAP.md`). Until these point at a real, funded pool, quotes are
"indicative" and sends use the demo path.

## 4b. Agent (natural-language actions)

The agent's brain is already built and provider-agnostic (`sdk/llm/extract.ts`,
tool-based extraction). In demo mode it understands and replies but doesn't
execute; to make it act, set two things on the droplet (server-only):

1. **An LLM key** — either
   - Anthropic (native): `ANTHROPIC_API_KEY` (or `LLM_PROVIDER=anthropic` +
     `LLM_API_KEY`), plus `LLM_MODEL=claude-opus-5`. For a high-volume intent
     extractor, `claude-haiku-4-5` is much cheaper and fast — your call.
   - Or any OpenAI-compatible endpoint: `LLM_PROVIDER=openai`, `LLM_BASE_URL`,
     `LLM_API_KEY`, `LLM_MODEL`.
2. **An agent signing key** — `SETTLE_OPERATOR_PK` (or `ARC_AGENT_PK` for a
   specific chain): the server-side key that submits and settles the agent's
   on-chain intents. Fund it with a little USDC for gas on Arc.

With both set (and `evmAgentReady`), "send ₦50,000 to Ama in Accra" or "pay my
Ikeja electricity bill" is understood and executed, in the app and on WhatsApp.

## 5. Set the env and deploy

- **Client (build-time):** add the `NEXT_PUBLIC_*` values above to the repo's
  `BUILD_DOTENV` secret (Settings → Secrets → Actions). They inline on the next
  build.
- **Server (runtime):** add server-only secrets to `/etc/pesarc/pesarc.env` on
  the droplet (`DATABASE_URL`, payout provider keys, `TERMII_API_KEY`,
  `AUTH_JWT_PRIVATE_KEY_B64`, `AUTH_JWT_KID`).
- Push to `main` → CI builds the image and redeploys the droplet.

## 6. Verify (after deploy)

- Sign in on `app.pesarc.xyz` with Google + a wallet.
- On **Send**, the balance header shows a real on-chain USDC balance (not "demo")
  and the network switcher lists your configured chains.
- A small test send shows a **live rate** (not "indicative") and a real tx hash.
- Gasless: the send completes without the user holding a gas token.

Work top-down: Privy first (login), then Alchemy (gasless), then the corridor
env (live quotes). Each is independent, so you can turn them on one at a time and
watch the demo tags disappear.
