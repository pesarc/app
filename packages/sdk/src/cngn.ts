// cNGN (Naira stablecoin) client — server-only.
//
// cNGN is the crypto leg's fiat anchor for the Nigeria corridor: NGN in →
// cNGN minted (virtual accounts), and cNGN → NGN out (redemption to a bank).
// This module isolates that provider behind the same shapes the rest of the app
// already speaks:
//
//   • when unconfigured, NOTHING here is reachable and callers fall back to the
//     simulated adapters (exactly like bills.ts / ramp.ts), so the app runs with
//     no cNGN account;
//   • when CNGN_* is set, we wrap the OFFICIAL cNGN TypeScript SDK
//     (`cngn-typescript-library`) so the bespoke transport crypto — AES-256-CBC
//     request encryption + Ed25519/Curve25519 response decryption — is the
//     vendor's own implementation, not hand-rolled here.
//
// Auth model (per https://docs.cngn.co): Bearer API key (the `cngn_test` /
// `cngn_live` prefix selects sandbox vs production server-side), IP whitelist,
// AES-256-CBC encrypted request bodies, and responses sealed to your Ed25519
// public key (decrypted with the matching private key). SERVER-ONLY — none of
// these values may ever be exposed as NEXT_PUBLIC_*.
//
// NOTE on the base URL: cngn-typescript-library@3.0.2 ships a hardcoded
// `http://localhost:8081/v1/api` base URL with no public override, so we point
// its axios instance at the real API after construction. Override with
// CNGN_BASE_URL if the vendor changes hosts.

import {
  mapProviderStatus,
  SimulatedRampAdapter,
  type RampAdapter,
  type PayoutStatus,
} from "./ramp";

// Types come from the official SDK (type-only import — erased at build, no
// runtime cost and none of the SDK's heavy chain deps are pulled in here).
import type {
  Secrets,
  cNGNManager as CngnManager,
  IResponse,
  Balance,
  Transactions,
  ITransactionPagination,
  IVirtualAccount,
  ICreateTemporaryVirtualAccount,
  TemporaryVirtualAccount,
  RedeemAsset,
  IWithdraw,
  IWithdrawResponse,
  IBanks,
  SupportedNetworks,
} from "cngn-typescript-library";

export type {
  IResponse,
  Balance,
  Transactions,
  ITransactionPagination,
  IVirtualAccount,
  ICreateTemporaryVirtualAccount,
  TemporaryVirtualAccount,
  RedeemAsset,
  IWithdraw,
  IWithdrawResponse,
  IBanks,
  SupportedNetworks,
};

const DEFAULT_BASE_URL = "https://api.cngn.co/v1/api";

/* --------------------------------- env ---------------------------------- */

function apiKey(): string {
  return process.env.CNGN_API_KEY || "";
}
function encryptionKey(): string {
  return process.env.CNGN_ENCRYPTION_KEY || "";
}
/**
 * Ed25519 private key (OpenSSH format) used to decrypt sealed responses.
 * Stored on one line with escaped newlines in .env → restore the real ones.
 */
function sshPrivateKey(): string {
  return (process.env.CNGN_SSH_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}
function baseUrl(): string {
  return (process.env.CNGN_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

/** True once all three secrets are present; otherwise callers use the sim path. */
export function cngnConfigured(): boolean {
  return Boolean(apiKey() && encryptionKey() && sshPrivateKey());
}

/** Which cNGN environment the current key targets (prefix-selected). */
export function cngnMode(): "sandbox" | "production" {
  return apiKey().startsWith("cngn_live") ? "production" : "sandbox";
}

/* ------------------------------- manager -------------------------------- */

let managerPromise: Promise<CngnManager> | null = null;

/**
 * Lazily construct (and memoise) the official SDK manager. The manager class is
 * loaded from its service subpath so the SDK's wallet-generation deps (tronweb,
 * stellar-sdk, …) are never pulled into this server bundle — we only need the
 * merchant-account calls.
 */
async function getManager(): Promise<CngnManager> {
  if (!managerPromise) {
    managerPromise = (async () => {
      const mod = await import("cngn-typescript-library/dist/services/cngn.manager");
      const secrets: Secrets = {
        apiKey: apiKey(),
        privateKey: sshPrivateKey(),
        encryptionKey: encryptionKey(),
      };
      const mgr = new mod.cNGNManager(secrets);
      // Repoint the SDK's hardcoded localhost base URL at the real API.
      (mgr as unknown as { axiosInstance: { defaults: { baseURL: string } } }).axiosInstance.defaults.baseURL =
        baseUrl();
      return mgr as unknown as CngnManager;
    })();
  }
  return managerPromise;
}

/* ---------------------------- typed methods ----------------------------- */
// Thin pass-throughs to the official SDK. Each returns the SDK's IResponse<T>
// envelope ({ success, data?, error? }). Call only when cngnConfigured().

/** cNGN balances across every network the merchant holds. */
export async function getBalances(): Promise<IResponse<Balance[]>> {
  return (await getManager()).getBalance();
}

/**
 * Create a (temporary) virtual NGN bank account to accept a deposit. NGN paid to
 * the returned NUBAN is minted as cNGN to the merchant.
 */
export async function createVirtualAccount(
  input: ICreateTemporaryVirtualAccount,
): Promise<IResponse<TemporaryVirtualAccount>> {
  return (await getManager()).createTemporaryVirtualAccount(input);
}

/** The merchant's dedicated (permanent) virtual accounts. */
export async function listVirtualAccounts(): Promise<IResponse<IVirtualAccount[]>> {
  return (await getManager()).getVirtualAccount();
}

/** Redeem cNGN → NGN, settled to a Nigerian bank account (NUBAN + bank code). */
export async function redeemToBank(input: RedeemAsset): Promise<IResponse<Transactions>> {
  return (await getManager()).redeemAsset(input);
}

/** Withdraw cNGN on-chain to a (whitelisted) wallet on a given network. */
export async function withdrawOnchain(input: IWithdraw): Promise<IResponse<IWithdrawResponse>> {
  return (await getManager()).withdraw(input);
}

/** Paginated transaction history. */
export async function listTransactions(
  page = 1,
  limit = 20,
): Promise<IResponse<ITransactionPagination>> {
  return (await getManager()).getTransactionHistory(page, limit);
}

/** A single transaction by its cNGN reference (used for status resolution). */
export async function getTransaction(ref: string): Promise<IResponse<Transactions>> {
  return (await getManager()).getTransaction(ref);
}

/** Supported redemption banks (name / code). */
export async function getBanks(): Promise<IResponse<IBanks[]>> {
  return (await getManager()).getBanks();
}

/** Supported networks with their UUIDs (needed for withdraw `networkId`). */
export async function getSupportedNetworks(
  includeBlockchain = false,
): Promise<IResponse<SupportedNetworks[]>> {
  return (await getManager()).getSupportedNetworks(includeBlockchain);
}

/* ------------------------------ ramp seam ------------------------------- */

/**
 * cNGN's status vocabulary (pending / pending_deposit / failed / rejected /
 * completed) → our PayoutStatus. The two cNGN-specific tokens map explicitly;
 * everything else defers to the shared mapProviderStatus.
 */
export function mapCngnStatus(s: string | undefined): PayoutStatus {
  const v = (s ?? "").toLowerCase();
  if (v === "rejected") return "failed";
  if (v === "pending_deposit") return "processing";
  return mapProviderStatus(v);
}

// Local ref for the sim fallback. The "RMP-" prefix marks a payout that never
// reached cNGN, so statusFor() knows to resolve it on the simulated timeline.
function simRef(): string {
  return `RMP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

/**
 * Off-ramp adapter backed by cNGN redemption. `initiate` redeems cNGN → NGN to
 * the beneficiary's Nigerian bank account; `statusFor` reads the redemption
 * transaction's status. Any error degrades to the simulated timeline so a demo
 * never breaks. Wired into ramp.ts's selectAdapter() when cngnConfigured().
 */
export function cngnRampAdapter(): RampAdapter {
  return {
    name: "cngn",
    // cNGN settles NGN to a Nigerian NUBAN — bank method, NGN corridor only.
    supports: (i) => i.method === "bank" && (i.currency ?? "NGN").toUpperCase() === "NGN",
    async initiate(input) {
      // Redemption needs a NUBAN + bank code; without them we can't reach cNGN,
      // so record it as initiated and let the webhook/poll correct it.
      if (!input.accountNumber || !input.bankCode) {
        return { partnerRef: simRef(), status: "initiated" };
      }
      try {
        const res = await redeemToBank({
          amount: input.amountNgn,
          bankCode: input.bankCode,
          accountNumber: input.accountNumber,
        });
        const tx = res.data;
        const partnerRef = tx?.trx_ref ?? input.reference;
        if (!res.success || !tx) {
          console.warn(
            `[ramp:cngn] redeem failed for ${input.reference}: ${res.error ?? "unknown error"}`,
          );
          return { partnerRef, status: "initiated" };
        }
        return { partnerRef, status: mapCngnStatus(tx.status) };
      } catch (e) {
        console.warn(
          `[ramp:cngn] redeem threw for ${input.reference}: ${(e as Error).message}`,
        );
        return { partnerRef: simRef(), status: "initiated" };
      }
    },
    async statusFor(createdAt, partnerRef) {
      if (!partnerRef || partnerRef.startsWith("RMP-")) {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
      try {
        const res = await getTransaction(partnerRef);
        if (!res.success || !res.data) return SimulatedRampAdapter.statusFor(createdAt);
        return mapCngnStatus(res.data.status);
      } catch {
        return SimulatedRampAdapter.statusFor(createdAt);
      }
    },
  };
}
