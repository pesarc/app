# Path A — Own the auth stack (global phone login), Privy as the wallet vault

## Why
Privy's built-in phone OTP only covers the US/Canada, which is a dead end for
our core corridors (Nigeria, Ghana, Kenya). Privy's **custom auth** (JWT) is
"bring your own identity provider": our system authenticates the user, mints a
JWT, and Privy validates it and provisions the embedded EVM + Solana wallets —
so the Alchemy gasless smart-account flow is unchanged. This lets us own the
phone channel (fits the "own the local leg / Global South first" thesis) and add
Google + wallet under one identity.

**Important:** custom auth makes *our* system the identity source. It is not
designed to run next to Privy's native login modal, so Path A **replaces** the
current Privy-native login (Google/email/wallet/passkey) with our own screens.
That is the deliberate trade: full control + global coverage, at the cost of
building and owning the login surface.

## Current state (after Path B)
- `packages/sdk/src/wallet/WalletProvider.tsx`: `loginMethods` = google, email,
  passkey, wallet (Privy-native). Privy `sms` removed (US/Canada only).
- Embedded wallets: `createOnLogin: "all-users"` for ethereum + solana.
- Smart wallet / gasless: Alchemy (`isSmartWalletConfigured`).
- No OTP/SMS provider wired for login. WhatsApp uses Meta Cloud API
  (`packages/sdk/src/whatsapp.ts`) — reusable for WhatsApp OTP later.

## Target architecture
```
User ─▶ our sign-in UI ─▶ /api/auth/*  ─▶ verify identity (phone OTP / Google / wallet)
                                        └▶ upsert user, mint RS256 JWT (sub = user id)
Client ─▶ PrivyProvider config.customAuth.getCustomAccessToken() = our JWT
Privy  ─▶ validates JWT against our JWKS ─▶ provisions embedded wallet ─▶ Alchemy gasless (unchanged)
```

### 1. Identity providers (server, `apps/web/app/api/auth/*`)
- **Phone OTP** (primary): provider adapter with **Termii** first
  (`packages/sdk/src/otp/termii.ts`), interface `sendOtp(phone)` /
  `verifyOtp(phone, code)`. Termii does SMS **and** WhatsApp OTP in one API and
  has strong NG/GH/KE deliverability; Africa's Talking is a drop-in alternative
  behind the same interface. Meta WhatsApp (existing) is a later channel option.
- **Google**: OIDC "Sign in with Google" (`/api/auth/google`), verify the
  Google ID token, map `google.sub` → our user.
- **Wallet**: Sign-In With Ethereum (EIP-4361) + Sign-In With Solana — issue a
  nonce, verify the signature, map the address → our user.
- **Email** (optional): reuse the same OTP infra (email code) or a magic link.

### 2. Session + JWT (server)
- On successful verification, upsert the user and mint an **RS256 JWT**:
  claims `sub` (stable user id), `iss` (`https://app.pesarc.xyz`), `aud`
  (Privy app id), `iat`, `exp` (short, ~10 min), plus a rotating refresh in an
  httpOnly cookie.
- Expose **`/.well-known/jwks.json`** (public key) so Privy can verify. Keep the
  private key server-only (env: `AUTH_JWT_PRIVATE_KEY`), plan key rotation
  (`kid`).

### 3. User store (Postgres — already self-hosted)
- `users` (id, created_at, primary_identifier) and `user_identities`
  (user_id, kind: phone|google|wallet|email, value, verified_at) so one person
  can link several login methods to **one identity + one embedded wallet**.
- Dedupe/link by verified identifier (e.g. same phone → same user).

### 4. Privy custom-auth bridge (client)
- Privy dashboard: **Authentication → Custom auth** → JWKS URL
  `https://app.pesarc.xyz/.well-known/jwks.json`, subject claim `sub`. Decide
  whether to disable native login methods.
- `WalletProvider`: set `config.customAuth = { isLoading, getCustomAccessToken }`
  returning our access token; **stop** using Privy's `login()` / `loginMethods`.
- Keep `embeddedWallets.createOnLogin: "all-users"` → wallets provision on the
  custom-auth login exactly as today.

### 5. UI (replaces the Privy modal in `AuthGate`)
- Method chooser (Phone · Google · Wallet), phone-entry + OTP-entry screens,
  Mum-Test styling (money words, no crypto jargon), resend + error states.

## Security checklist
- OTP: 5-min expiry, hashed codes at rest, max attempts, resend cooldown,
  per-phone + per-IP rate limits. Never log codes.
- JWT: short access TTL, httpOnly refresh cookie, single-use nonces (SIWE/SIWS)
  bound to our domain, `kid` rotation.
- Secrets server-only: `TERMII_API_KEY`, `AUTH_JWT_PRIVATE_KEY`, Google client
  secret. `NEXT_PUBLIC_*` only for non-secret client config.

## Migration risk (must plan before shipping)
Switching the identity source changes how Privy keys embedded wallets. If any
**real** users already exist on Privy-native login in prod, their wallet is tied
to the Privy-native identity; moving them to custom auth needs the same stable
`sub` mapping or a linking step, or they get a *new* embedded wallet (and would
lose access to balances on the old one). Audit prod users first; if it's still
pre-launch/no real balances, this is a non-issue and we can cut over cleanly.

## Inputs needed from you
- **OTP provider account**: Termii (recommended) or Africa's Talking — API key +
  approved sender ID.
- **Google OAuth**: a Google Cloud OAuth client (client id + secret).
- **Privy dashboard**: enable custom auth, set the JWKS URL + subject claim, and
  decide whether native login stays on during rollout.
- **Confirm** whether prod has real users with balances (migration).

## Phased build
1. **Phase 1 (core):** Termii phone OTP + JWT/JWKS + Privy custom-auth bridge +
   phone-only sign-in UI. Proves the whole loop end to end.
2. **Phase 2:** Google (OIDC) leg + account linking.
3. **Phase 3:** Wallet (SIWE/SIWS) leg + linking.
4. **Phase 4:** Hardening (rate limits, refresh, key rotation), user migration,
   remove Privy-native login.

## Rough effort
Multi-day. Phase 1 is the meaningful chunk (the loop); 2–4 are additive. It is
the app's login, so each phase ships behind a flag and is tested before cutover.
