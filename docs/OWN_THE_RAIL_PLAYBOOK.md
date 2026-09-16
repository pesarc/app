# Owning the rail — from rented PSPs to a sovereign settlement layer

*How Pesarc moves from renting a Western-controlled fiat edge (Paystack/Stripe) to
owning its own licensed rail and settling through PAPSS. Founder playbook — not
legal advice; every figure is approximate and must be re-verified with current
CBN/SEC rules and local counsel before you act.*

## 0. The principle
Your moat is the **on-chain local-currency settlement engine + the realized-rate
oracle + the published "no dollar in the path" metric** — you already own that.
The **fiat last mile is a commodity**: compose it now, diversify it next, own it
eventually. Don't let a rented edge (Paystack, Stripe-owned) define the company,
and don't over-invest in it early. The sequence: **rent → diversify → own.**

```
Phase   Fiat edge                         What you control
P0–P1   Paystack (rented)                 nothing at the edge; everything on-chain
P2      + Flutterwave / Yellow Card /     multi-rail, African-owned; no single
        mobile money (diversified)        Western chokepoint  ← we built this
P3+     licensed: NIBSS + mobile money    you ARE the rail; PAPSS for cross-border
        direct + PAPSS via a bank         sovereignty story is real
```

## 1. P2 — diversify off the single Western PSP (done in code)
The `RampAdapter` is now a **multi-provider router** (`packages/sdk/src/ramp.ts`):
per payout it picks the first configured provider whose `supports()` accepts the
currency/method, with the simulator as fallback. Adding a rail is one adapter + a
key — no other code changes. Providers to add behind it, by ownership:

- **Flutterwave** (Nigerian-founded, pan-African, bank + mobile money) — adapter
  already written; set `FLUTTERWAVE_SECRET_KEY`.
- **Yellow Card / Fincra / Onafriq (MFS Africa) / Cellulant** — African-owned;
  Yellow Card and Fincra also take the stablecoin directly (matches the escrow
  model). Wire via a dedicated adapter or the generic `RAMP_PROVIDER_URL` seam.
- **Mobile money direct**: M-Pesa (Daraja), MTN MoMo, Airtel — per country.

Route order + failover: `RAMP_PROVIDER_ORDER`, e.g. `flutterwave,paystack`. Goal:
no single provider (least of all a Western-owned one) can gate your flow.

## 2. P3 — become your own rail (Nigeria first)
The OPay/Moniepoint playbook: get **licensed** and plug **directly** into the
sovereign rails (NIBSS + mobile money), removing the PSP middleman. Two routes,
usually run in parallel:

### 2a. Partner-first (start here — weeks, not years)
Rent a license via a **sponsor**: a licensed bank / switch / BaaS provider fronts
the regulated activity while you build volume and product. This is how almost
every fintech starts. It also gets you an early **NIBSS** connection (NIP payouts,
name-enquiry, NQR) under the partner's licence. Keep the `RampAdapter` seam so the
partner is swappable.

### 2b. Get your own licence (the moat)
Nigeria's on-ramp for a crypto-native settlement firm is the **SEC ARIP**
(Accelerated Regulatory Incubation Programme) — file it early; it's built for
exactly this stage. In parallel, the **CBN** payment licences (approximate minimum
capital — verify current CBN framework):

| Licence | ~Min capital | What it lets you do |
|---|---|---|
| Super-Agent | ₦50M | Agent network (cash-in/out) |
| PSSP (Payment Solution Service Provider) | ₦100M | Payment processing / gateway, NIBSS access |
| PTSP | ₦100M | POS terminal services |
| Switching & Processing | ₦2B | Operate as a switch — direct NIBSS/NIP participant |
| Mobile Money Operator (MMO) | ₦2B | Mobile wallets + agent banking |
| Payment Service Bank (PSB) | ₦5B | Deposit-taking, wide agent banking |

**Accelerant:** *acquire* a licence instead of applying — buy a microfinance bank
or a licensed PSP (Moniepoint's route). Faster than a de-novo application and
comes with an existing NIBSS/CBN footprint.

### 2c. Direct rail integration (once licensed/sponsored)
- **NIBSS** — NIP (NIBSS Instant Payment) for real-time bank payouts, name
  enquiry, NQR, BVN validation. Direct participation needs a bank/switch licence
  (or a sponsor). This replaces Paystack's transfer API with the sovereign rail.
- **Mobile money** — direct M-Pesa (Daraja) / MTN MoMo / Airtel per country.
- Keep everything behind the `RampAdapter` so "direct NIBSS" is just another
  provider that outranks the rented PSPs in `RAMP_PROVIDER_ORDER`.

### Per-corridor licensing
Each new country is its own regime — Kenya (CBK PSP + M-Pesa), Ghana (BoG DEMI /
PSP), etc. Grow the licensed footprint corridor-by-corridor, sponsor-first, and
document the posture per corridor (as the PRD already frames).

## 3. PAPSS — the sovereign cross-border layer (feed it, don't fight it)
**PAPSS** (Pan-African Payment and Settlement System, built by Afreximbank for
AfCFTA) is your thesis at the state level: it settles cross-border trade in
**local currencies without routing through the dollar**. You do not compete with
it — you become the **crypto-native, consumer/SME-facing layer that feeds it**,
where PAPSS is the bank-to-bank clearing underneath.

**How you connect (it's not a public Stripe-style API):**
- PAPSS participants are **central banks** (settlement agents), **commercial banks
  / switches** (direct or indirect participants), and **PSPs/fintechs onboard
  through a participating bank** (a sponsor). So the concrete move is: once you're
  licensed or bank-partnered, **open a PAPSS conversation via a participating
  bank** in your corridor. Afreximbank / the domestic central bank are the
  counterparties.
- Near-term you can already **align**: settle intra-African corridors in local
  currency on-chain (you do this), publish the dollar-independence metric, and
  position Pesarc publicly as the digital, SME-first front end to the PAPSS/AfCFTA
  agenda. That alignment is a moat dollar-rails structurally can't chase, and it's
  a door-opener with central banks and Afreximbank.

**Why this matters strategically:** aligning with sovereign de-dollarization
(PAPSS, AfCFTA, Nigeria's push to settle African trade without dollar conversion)
puts you on the side of where African monetary policy is already going — a rare,
fundable place to stand, and one Circle Arc / Stripe Tempo / Yellow Card cannot
occupy without contradicting their own dollar-centric models.

## 4. Execution checklist
**Now (P2):**
- [ ] Add Flutterwave key; add 1–2 African-owned providers (Fincra / Yellow Card)
      behind the router; set `RAMP_PROVIDER_ORDER` to prefer African rails.
- [ ] Pick a **sponsor bank / licensed partner** for the Nigeria pilot's fiat leg.

**Next (P2.5 → P3):**
- [ ] File **SEC ARIP**.
- [ ] Decide licence path: **apply** (PSSP → Switching) vs **acquire** (MFB/PSP).
- [ ] Stand up a direct **NIBSS/NIP** integration under the partner/licence.
- [ ] Add M-Pesa/MoMo direct for the KES/GHS corridors.

**Cross-border (P3+):**
- [ ] Identify a **PAPSS participating bank** per corridor; open the conversation.
- [ ] Publish the live dollar-independence dashboard; take the PAPSS/AfCFTA
      alignment story to central banks and Afreximbank.

## 5. The honest framing for investors
"We rent the fiat edge today (swappable in one env var), diversify it to
African-owned rails next, and own it at scale — licensed, direct on NIBSS and
mobile money, and settling cross-border through PAPSS. The defensible core —
local-currency on-chain settlement, self-referential pricing, and a published
independence metric — we already own. We are not a better dollar rail; we are the
rail that makes the dollar optional, aligned with where the continent's monetary
policy is already heading."
