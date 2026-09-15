// Transfer/payout references.
//
// These are user-visible receipt codes, but they're also a lookup key, so they
// must not be guessable — short `Math.random()` codes were enumerable, which is
// how a payout's beneficiary PII could be read by a stranger. Rows are also
// account-scoped now (lib/api/auth.ts); this is defence in depth.
//
// ~96 bits from the CSPRNG, Crockford-ish base32 (no I/L/O/U — unambiguous when
// read aloud or typed off a receipt).

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomCode(chars: number): string {
  const bytes = new Uint8Array(chars);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** Groups as XXXX-XXXX-XXXX so it's readable on a receipt. */
function grouped(prefix: string): string {
  const c = randomCode(12);
  return `${prefix}-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

/** Reference for a send (`SARC-…`). */
export function sendReference(): string {
  return grouped("SARC");
}

/** Reference for a QR payment (`QRP-…`). */
export function payReference(): string {
  return grouped("QRP");
}
