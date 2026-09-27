// Path A own-auth: mint the short-lived RS256 JWT that Privy validates (via our
// JWKS) to authenticate a user and provision their embedded wallet. The private
// key lives only in the server env (AUTH_JWT_PRIVATE_KEY_B64, base64 PKCS8 PEM);
// the public half is served at /api/auth/jwks for Privy to fetch.
import { createPrivateKey, createPublicKey } from "node:crypto";
import { SignJWT, importPKCS8, importJWK, jwtVerify, type JWK } from "jose";
import { PRIVY_APP_ID } from "../wallet/config";

const ALG = "RS256";
export const AUTH_JWT_KID = process.env.AUTH_JWT_KID || "pesarc-auth-1";
export const AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER || "https://app.pesarc.xyz";
// Privy expects the token's audience to be the Privy app id.
const AUD = PRIVY_APP_ID;

function privatePem(): string {
  const b64 = process.env.AUTH_JWT_PRIVATE_KEY_B64 || "";
  if (!b64) throw new Error("AUTH_JWT_PRIVATE_KEY_B64 is not set");
  return Buffer.from(b64, "base64").toString("utf8");
}

export const isAuthJwtConfigured = Boolean(process.env.AUTH_JWT_PRIVATE_KEY_B64);

/**
 * Sign a session token. `sub` is the stable user identity Privy keys the
 * embedded wallet on — keep it stable per person (e.g. "pesarc:phone:<e164>").
 */
export async function mintSessionToken(sub: string, extra?: Record<string, unknown>): Promise<string> {
  const key = await importPKCS8(privatePem(), ALG);
  return new SignJWT({ ...extra })
    .setProtectedHeader({ alg: ALG, kid: AUTH_JWT_KID, typ: "JWT" })
    .setSubject(sub)
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

/** JWKS document (public key only) for Privy to verify our tokens. */
export function publicJwks(): { keys: JWK[] } {
  const pub = createPublicKey(createPrivateKey(privatePem()));
  const jwk = pub.export({ format: "jwk" }) as { n?: string; e?: string };
  const key: JWK = { kty: "RSA", n: jwk.n, e: jwk.e, use: "sig", alg: ALG, kid: AUTH_JWT_KID };
  return { keys: [key] };
}

/** Stable Privy subject for a verified phone number. */
export function subForPhone(msisdn: string): string {
  return `pesarc:phone:${msisdn.replace(/[^\d]/g, "")}`;
}

// ---- our own session cookie (separate from the short Privy access token) ----
// After OTP verify we set a long-lived, signed session cookie holding `sub`; the
// client's getCustomAccessToken() then trades it for a fresh 10m access token.
export const SESSION_COOKIE = "pesarc_session";
const SESSION_AUD = "pesarc-session";

/** Long-lived (30d) signed session token stored in an httpOnly cookie. */
export async function mintSessionCookie(sub: string): Promise<string> {
  const key = await importPKCS8(privatePem(), ALG);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG, kid: AUTH_JWT_KID, typ: "JWT" })
    .setSubject(sub)
    .setIssuer(AUTH_JWT_ISSUER)
    .setAudience(SESSION_AUD)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

/** Verify a session cookie and return its `sub`, or null if invalid/expired. */
export async function subFromSession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const pub = await importJWK(publicJwks().keys[0], ALG);
    const { payload } = await jwtVerify(token, pub, {
      issuer: AUTH_JWT_ISSUER,
      audience: SESSION_AUD,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
