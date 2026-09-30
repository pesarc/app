# Identity layer — privacy & compliance posture

One canonical identity unifies a person's chain addresses, phone, username, and
(once licensed) a bank account number. The rule that governs the data:

**Encrypt what you keep. Prove what you can. Quarantine what regulators need.**

## Stacks (chosen to stay dependency-light — no native/WASM in the hot path)

- **Encryption — Node `crypto` (built-in), AES-256-GCM.** `crypto.ts` seals each
  PII field under a per-record HKDF subkey derived from a master key
  (`IDENTITY_ENC_KEY`, 32 bytes; a KMS/HSM key in production). Tamper-evident
  (GCM tag), self-describing ciphertext, zero new dependencies.
- **Selective disclosure — viem EIP-712 attestations.** `attest.ts`: a trusted
  issuer (the KYC/ramp partner) signs a `Claim` ("kyc"=2, "region"="NG"); the app
  stores the signed claim and verifies it to gate a corridor, without ever holding
  documents. `nullifier()` gives one-identity-one-action (sybil resistance)
  without linking back to who acted. viem is already a dependency.
- **Later, isolated:** full zk membership proofs (Semaphore / Noir) can layer on
  for unlinkable proofs — kept off this path so no zk-SNARK WASM enters the core.

## How the two tensions resolve

- **Data-protection law (NDPA 2023 / GDPR) pushes us here.** Minimization,
  encryption, purpose limitation. Holding attestations instead of raw PII, and
  encrypting what we must, *is* compliance.
- **AML/CFT law pulls the other way.** Once fiat is touched we must identify
  users, screen sanctions, monitor, file SARs, honor the Travel Rule, and produce
  records on lawful request. We never make ourselves unable to comply.
- **Resolution — quarantine, not concealment.** Regulated-visibility PII lives
  with the **licensed entity** (the KYC/ramp partner, or our MFB once licensed),
  which retains lawful access and monitoring. This identity layer holds only
  handles, public addresses, encrypted field blobs, and signed attestations —
  minimized. Encryption/zk govern what the *app and other users* see; the licensed
  layer retains what *regulators* are entitled to.

Not legal advice, and per-country: NDPA, each data-protection regulator, and each
AML regime differ. Get counsel before holding or proving anything about real
people.
