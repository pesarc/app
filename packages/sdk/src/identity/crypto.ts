// Envelope encryption for the PII we must keep, using Node's built-in crypto —
// no new dependency, no native/WASM. Each field is sealed with AES-256-GCM under
// a per-record subkey that is HKDF-derived from a master key + a random salt, so
// two records never share a key and a leaked ciphertext reveals nothing without
// the master. The master lives only server-side (IDENTITY_ENC_KEY); it should be
// a KMS/HSM-managed key in production. Posture: encrypt what you must keep, prove
// what you can (see attest.ts), quarantine what regulators need (the licensed
// partner), and store an attestation instead of raw PII whenever possible.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { SealedBlob } from "./types";

const INFO = "pesarc-identity-pii-v1";

/** The 32-byte master key from IDENTITY_ENC_KEY (hex-64 or base64). Throws when
 *  absent or the wrong length, so a misconfig fails closed rather than silently
 *  encrypting under a weak key. */
function masterKey(): Buffer {
  const raw = (process.env.IDENTITY_ENC_KEY || "").trim();
  if (!raw) throw new Error("IDENTITY_ENC_KEY is not set");
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, "hex");
  else key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("IDENTITY_ENC_KEY must be 32 bytes (hex-64 or base64)");
  return key;
}

const b64 = (b: Buffer) => b.toString("base64");

/** True when a valid master key is configured (so callers can degrade cleanly). */
export function encryptionReady(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

/** Seal a plaintext string into an opaque, self-describing ciphertext. */
export function seal(plaintext: string): SealedBlob {
  const master = masterKey();
  const salt = randomBytes(16);
  const subkey = Buffer.from(hkdfSync("sha256", master, salt, INFO, 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subkey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64(salt), b64(iv), b64(tag), b64(ct)].join(".");
}

/** Open a sealed blob back to plaintext. Throws on tamper or a wrong key. */
export function open(sealed: SealedBlob): string {
  const parts = sealed.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") throw new Error("malformed sealed blob");
  const [, salt, iv, tag, ct] = parts;
  const master = masterKey();
  const subkey = Buffer.from(hkdfSync("sha256", master, Buffer.from(salt, "base64"), INFO, 32));
  const decipher = createDecipheriv("aes-256-gcm", subkey, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

/** Seal a map of fields (skips empty values). */
export function sealFields(fields: Record<string, string | undefined>): Record<string, SealedBlob> {
  const out: Record<string, SealedBlob> = {};
  for (const [k, v] of Object.entries(fields)) if (v) out[k] = seal(v);
  return out;
}

/** Constant-time equality for comparing a candidate against a sealed value's
 *  plaintext (e.g. verifying a BVN match) without leaking timing. */
export function sealedEquals(sealed: SealedBlob, candidate: string): boolean {
  let plain: string;
  try {
    plain = open(sealed);
  } catch {
    return false;
  }
  const a = Buffer.from(plain);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}
