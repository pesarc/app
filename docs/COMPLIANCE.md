# Off-ramp compliance — what each rail needs before it will pay out

*Practical compliance map for every provider behind the `RampAdapter`
(`packages/sdk/src/ramp.ts`), plus how it relates to getting your own licence.
Nigeria-first. **Not legal advice** — every figure and requirement is approximate
and must be re-verified with the provider and current CBN/SEC rules and local
counsel before you rely on it. Pairs with [OWN_THE_RAIL_PLAYBOOK.md](OWN_THE_RAIL_PLAYBOOK.md).*

## 0. The one thing to understand first: two compliance tracks

There are **two separate compliance questions**, and conflating them is the
classic mistake:

1. **Provider KYB (business verification)** — to switch on payouts on a *rented*
   rail (Paystack, Flutterwave, …), you complete the provider's Know-Your-Business
   flow. You operate as a *merchant under the provider's licence*. This is what
   unblocks the "starter business" wall you hit on Paystack. **No payments licence
   of your own is needed for this** — the provider is the regulated entity.
2. **Your own licence** — needed only when you (a) go **direct** to the sovereign
   rails (NIBSS/NIP, PAPSS), (b) **hold customer funds** / operate a wallet, or
   (c) run **cross-border remittance** at any real scale (see §1). This is the
   CBN/SEC track in the playbook.

**So: rented rails + provider KYB get you to a real pilot. Your own licence is for
going direct and for the remittance leg.** Build volume on track 1 while you work
track 2 — but read §1 first, because remittance is the exception that can pull
licensing forward.

## 1. ⚠️ The remittance exception — IMTO (read this before anything else)

Pesarc is **cross-border**. In Nigeria, *inbound* cross-border money transfer is
regulated as an **IMTO (International Money Transfer Operator)** by the CBN — a
heavy licence (historically ~**US$1M** minimum operating capital for a Nigerian
IMTO, foreign IMTOs higher; verify the current CBN IMTO guidelines). Crucially,
**a domestic PSP/aggregator licence (or a Paystack/Flutterwave merchant account)
does NOT authorise you to run inbound remittance.** Diaspora → Nigeria payout
must land through a **licensed IMTO** or a **bank/IMTO partnership**.

What this means concretely:
- **You cannot legally be the IMTO of record on a starter/merchant account.** The
  "cannot initiate third-party payouts as a starter business" error is a preview
  of this: rails gate *disbursing other people's money to third parties* precisely
  because it shades into regulated money transmission.
- **Near-term legal path:** partner with a **licensed IMTO or bank** who is the
  operator of record for the cross-border leg, while you own the product, UX, and
  on-chain settlement. Same "sponsor-first" pattern as the licence playbook.
- **Intra-Nigeria** payouts (naira in → naira out, domestic) are *not* IMTO — they
  are ordinary payouts under a PSP, and provider KYB is enough. So a **domestic-NGN
  pilot** (or a corridor where a partner holds the cross-border licence) is the
  compliant way to start.

> Bottom line: local/domestic payouts → provider KYB is enough. Cross-border
> remittance → you need an IMTO/bank partner now, and IMTO-grade licensing later.

## 2. Per-provider compliance (rented rails)

### Paystack (built + tested — `paystack` adapter)
Stripe-owned, CBN-licensed PSSP. Currently **Transfers/Payouts are blocked on your
account** ("starter business").
- **To enable payouts:** upgrade **Starter → Registered Business** in the
  dashboard: **Compliance / Settings → Business**. Submit:
  - **CAC** certificate (RC number) + business name
  - **TIN** (tax ID)
  - Director/owner **BVN** and government ID
  - Proof of business address
  - A settlement **bank account** in the business name
- **After approval:** the `transfer` call in the adapter starts succeeding, no code
  change. Bulk/third-party disbursement may need an extra agreement — ask your
  Paystack account manager once verified.
- **Limit:** Paystack does not make you an IMTO. Use it for the **domestic-NGN**
  leg (or under a partner's cross-border licence), not as your remittance licence.

### Flutterwave (adapter written — `flutterwave`)
Nigerian-founded, pan-African (NGN/GHS/KES/UGX/TZS/XAF/XOF/ZAR).
- **To enable transfers/payouts:** register a business + pass **KYB compliance**:
  CAC/company registration, TIN, director BVN/ID, proof of address, settlement
  account. Payouts and higher limits gate behind compliance approval, same shape
  as Paystack.
- **Set** `FLUTTERWAVE_SECRET_KEY`; the adapter shape follows the v3 docs — **observe
  one real request/response before going live** (noted in the code).
- Same IMTO caveat: it's a rail, not your remittance licence.

### Generic HTTP adapter (`http`, `RAMP_PROVIDER_URL`) — Yellow Card, Fincra, others
The seam for African-owned rails; each has its own onboarding:
- **Yellow Card** — pan-African crypto↔fiat on/off-ramp (takes the stablecoin
  directly, which matches the escrow model). Onboarding is a **B2B/partnership +
  KYB** process (business docs, compliance review, a partnership/API agreement),
  not a self-serve dashboard. They hold local licences across many markets — a
  strong "African-owned, already-licensed" cross-border partner.
- **Fincra** — collections + payouts across NGN/GHS/KES + pan-African. **KYB**:
  CAC/registration, TIN, directors' KYC, proof of address, compliance review;
  payouts enabled post-approval.
- Wire either behind `RAMP_PROVIDER_URL` (+ `RAMP_API_KEY`) or a dedicated adapter.

### Mobile money direct (per country — future adapters)
- **M-Pesa (Safaricom Daraja, Kenya)**, **MTN MoMo**, **Airtel Money** — each needs
  a **registered business in that country** (or a local partner), a developer/
  business account, and a disbursement/B2C agreement. Per-corridor KYB + often a
  local entity. Treat each country as its own regime (CBK PSP in Kenya, BoG in
  Ghana, etc.).

## 3. Do-once KYB document pack (Nigeria)
Gather these once; every provider above asks for the same core set:
- [ ] **CAC** certificate + status report (RC number)
- [ ] **TIN** (tax identification number)
- [ ] **Director(s)** BVN + government photo ID (NIN/passport/driver's licence)
- [ ] **Proof of business address** (utility bill / tenancy)
- [ ] **Business bank account** (settlement account, in the company name)
- [ ] Memart / shareholding docs (some providers)
- [ ] A short **business description** of the money flow (they assess remittance /
      third-party-payout risk from this — be accurate; misdescribing it stalls you)

## 4. Sequencing (compliant, cheapest-first)
1. **Now — domestic-NGN pilot:** complete **Paystack KYB** (registered business);
   payouts are naira-in/naira-out under Paystack's licence. No IMTO needed.
2. **Cross-border pilot:** sign a **licensed IMTO / bank partner** (or Yellow Card
   where their licence covers the corridor) as operator of record for the
   diaspora→Nigeria leg. You keep product + on-chain settlement.
3. **Diversify:** add **Flutterwave** + one African-owned rail (Fincra / Yellow
   Card) behind the router; set `RAMP_PROVIDER_ORDER` to prefer African rails.
4. **Own it (the licence track):** **SEC ARIP**, then CBN licences (PSSP → Switching)
   and/or **IMTO** for remittance, direct **NIBSS**, and **PAPSS** via a
   participating bank. Full detail + capital table in the playbook.

## 5. The honest one-liner for investors/regulators
"Today we move money on licensed partners' rails — Paystack/Flutterwave for the
domestic leg, a licensed IMTO/bank for the cross-border leg — so every naira is
already inside a regulated perimeter. We complete provider KYB now and pursue our
own CBN/SEC + IMTO licences to go direct on NIBSS and settle cross-border through
PAPSS. The defensible core — local-currency on-chain settlement — we already own."
