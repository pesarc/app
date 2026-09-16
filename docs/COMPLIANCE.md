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

## 5. Corridor-by-corridor (beyond Nigeria)

The **two-track model (§0) applies in every country**: a *domestic* wallet/PSP
regime, and a separate *cross-border/remittance* regime that gates the money
crossing a border. And in every corridor the fastest **compliant** entry is the
same as Nigeria — a **local licensed partner** (PSP / EMI / bank / remittance
operator) or a **pan-African aggregator that already holds the licences** (§6) —
not a de-novo licence. Depth below is heaviest for the next likely corridors
(Kenya, Ghana). **Not legal advice; verify each with local counsel.**

| Corridor | Regulator | Domestic wallet/PSP licence | Cross-border / remittance regime | Dominant mobile money | Crypto/VASP status |
|---|---|---|---|---|---|
| **Kenya** (cKES) | CBK | PSP authorisation (National Payment System Act) | **Money Remittance Provider** licence (Money Remittance Regs 2013) | **M-Pesa** (Safaricom), Airtel Money | VASP Bill emerging; CBK cautious. DPA 2019 |
| **Ghana** (cGHS) | Bank of Ghana | **DEMI** (e-money/wallet) or **PSP** (Enhanced/Medium/Standard) — Act 987 | BoG approval; Enhanced PSP + partner bank for inbound | **MTN MoMo**, Telecel Cash, AirtelTigo | Draft crypto guidelines. DPA 2012 |
| **South Africa** | SARB + FSCA | Operate via a **sponsoring bank** (NPS Act); non-bank clearing limited | **ADLA** (Authorised Dealer w/ Limited Authority) for remittance | (bank-led; less MM-centric) | Crypto = financial product (FSCA 2022), **CASP** licence. POPIA |
| **Uganda** | Bank of Uganda | PSP licence (large/small) — NPS Act 2020 | BoU approval + partner | MTN, Airtel | Cautious |
| **Tanzania** | Bank of Tanzania | PSP licence — NPS Act 2015 | BoT approval + partner | M-Pesa (Vodacom), Tigo Pesa, Airtel | Cautious |
| **Francophone W. Africa** (XOF) | **BCEAO** (regional, 8 UEMOA states) | E-money issuer licence via BCEAO, usually **bank/EME partnership** | BCEAO/regional; partner-led | **Wave**, Orange Money, MTN | Regional, conservative |
| **Central Africa** (XAF) | **BEAC** (regional, 6 CEMAC states) | E-money issuer licence via BEAC, partner-led | BEAC/regional | Orange, MTN | Conservative |

**Kenya (deep):** the highest-value non-Nigeria corridor because **M-Pesa** is the
rail. Domestic C2B/B2C runs under a **PSP** authorisation; the moment money is
*cross-border* you also need a **Money Remittance Provider** licence — or you ride
a licensed remittance partner. Integrate M-Pesa via **Safaricom Daraja** (B2C for
payouts) once you have a business/short-code and a disbursement agreement (direct,
or through an aggregator). Crypto rules are still forming — keep the on-chain leg
as settlement plumbing, not a consumer-facing "crypto" product, and localise data
under the **Data Protection Act 2019**.

**Ghana (deep):** BoG's **Act 987** is one of Africa's clearest regimes. A wallet
that holds e-money = **DEMI**; pure processing = a **PSP** tier. Mobile money is
**MTN MoMo**-dominant; inbound cross-border pairs an **Enhanced PSP** with a partner
bank. Good second corridor because the licence categories are explicit and the
mobile-money API surface is mature.

**Regional blocs (XOF/XAF):** one **BCEAO** or **BEAC** relationship covers 8 and 6
countries respectively — efficient, but licensing runs through a **local bank/EME
partner**, and **Wave** (Senegal/Côte d'Ivoire) has reset pricing expectations, so
plan on thin margins there.

**Per-corridor doc discipline:** for each corridor, record posture in one place —
regulator, the licence you rely on (yours or the partner's), the mobile-money/bank
rail, the data-residency rule, and who is operator-of-record for the cross-border
leg. The PRD already frames this "posture per corridor"; keep it current as you add
rails behind `RAMP_PROVIDER_ORDER`.

## 6. Aggregator coverage — enter corridors under someone else's licence

You do **not** need a licence per country to start — a pan-African aggregator that
already holds them covers many corridors under one KYB relationship. Map a rail to
where you want to go, prefer **African-owned**, and set `RAMP_PROVIDER_ORDER`:

- **Flutterwave** — NGN, GHS, KES, UGX, TZS, XAF, XOF, ZAR (bank + mobile money).
  Broadest single-integration coverage; the `flutterwave` adapter is written.
- **Yellow Card** — pan-African, takes the **stablecoin directly** (matches the
  escrow model) and is licensed across many markets → a strong **cross-border**
  partner, not just a payout rail.
- **Onafriq (MFS Africa)** / **Cellulant** — deep **mobile-money** reach across the
  continent; wire behind the generic `http` seam.
- **Fincra** — NGN/GHS/KES collections + payouts.
- **M-Pesa / MTN MoMo / Airtel direct** — best rates but per-country licensing +
  local entity; do these once a corridor has volume, behind the same seam.

**Rule of thumb:** ride aggregators (their licences) to prove each corridor, then
go **direct + your own licence** only where volume justifies it — same rent → own
arc as Nigeria (see the playbook).

## 7. The honest one-liner for investors/regulators
"Today we move money on licensed partners' rails — Paystack/Flutterwave for the
domestic leg, a licensed IMTO/bank for the cross-border leg — so every naira is
already inside a regulated perimeter. We complete provider KYB now and pursue our
own CBN/SEC + IMTO licences to go direct on NIBSS and settle cross-border through
PAPSS. The defensible core — local-currency on-chain settlement — we already own."
