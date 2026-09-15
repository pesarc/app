// SVM prediction-market WRITE path (stake). Builds the stake instruction with
// @solana/web3.js only (no Anchor in the bundle): Anchor's 8-byte discriminator
// + borsh(is_yes: bool, amount: u64). Loaded lazily by the venue writer.
//
// Needs a Solana signer ({ publicKey, signTransaction }) — e.g. a Privy Solana
// embedded wallet or a wallet-adapter. The instruction path itself is verified
// on devnet (the seed script stakes through the same accounts).

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { svmConfig } from "./config";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const STAKE_DISCRIMINATOR = Uint8Array.from([206, 176, 202, 18, 200, 209, 179, 108]);
const CLAIM_DISCRIMINATOR = Uint8Array.from([62, 198, 214, 193, 213, 159, 108, 210]);

// Byte-oriented signer so the provider never needs @solana/web3.js — it just
// wraps the wallet's sign call (e.g. Privy's Solana embedded wallet). This
// module builds/serializes the tx and this signer returns signed bytes.
export type SolanaSigner = {
  address: string;
  signTransaction: (txBytes: Uint8Array) => Promise<Uint8Array>;
};

function ata(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function u64le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

export type SvmStakeParams = {
  marketId: number;
  isYes: boolean;
  amount: number; // whole collateral units
};

/** Build + send a stake tx on Solana. Returns the signature. */
export async function svmStake(signer: SolanaSigner, p: SvmStakeParams): Promise<string> {
  const cfg = svmConfig();
  const conn = new Connection(cfg.rpcUrl, "confirmed");
  const programId = new PublicKey(cfg.predictionMarket);
  const user = new PublicKey(signer.address);

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(u64le(BigInt(p.marketId)))],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    programId,
  );
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    programId,
  );

  // collateral mint lives at offset 16 of the Market account (after 8-byte disc + id u64).
  const info = await conn.getAccountInfo(market);
  if (!info) throw new Error("market not found");
  const mint = new PublicKey(info.data.subarray(16, 48));
  const userToken = ata(user, mint);

  const amount = BigInt(Math.round(p.amount)) * 10n ** BigInt(cfg.collateralDecimals);
  const data = new Uint8Array(8 + 1 + 8);
  data.set(STAKE_DISCRIMINATOR, 0);
  data[8] = p.isYes ? 1 : 0;
  data.set(u64le(amount), 9);

  const keys = [
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: position, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: userToken, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  return sendSigned(conn, signer, new TransactionInstruction({ programId, keys, data: Buffer.from(data) }));
}

/** Claim winnings on a finalized market. No args; the market PDA carries the id. */
export async function svmClaim(signer: SolanaSigner, p: { marketId: number }): Promise<string> {
  const cfg = svmConfig();
  const conn = new Connection(cfg.rpcUrl, "confirmed");
  const programId = new PublicKey(cfg.predictionMarket);
  const user = new PublicKey(signer.address);

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(u64le(BigInt(p.marketId)))],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId);
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
    programId,
  );
  const info = await conn.getAccountInfo(market);
  if (!info) throw new Error("market not found");
  const mint = new PublicKey(info.data.subarray(16, 48));
  const userToken = ata(user, mint);

  const keys = [
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: position, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: userToken, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const data = Buffer.from(CLAIM_DISCRIMINATOR);
  return sendSigned(conn, signer, new TransactionInstruction({ programId, keys, data }));
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function sendSigned(
  conn: Connection,
  signer: SolanaSigner,
  ix: TransactionInstruction,
): Promise<string> {
  const cfg = svmConfig();
  const user = new PublicKey(signer.address);
  // Gasless: the relayer is the fee payer and co-signs + submits server-side, so
  // the user never needs SOL. Without a relayer configured, the user pays.
  const sponsored = Boolean(cfg.feePayer);
  const tx = new Transaction().add(ix);
  tx.feePayer = sponsored ? new PublicKey(cfg.feePayer) : user;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;

  const unsigned = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const userSigned = await signer.signTransaction(new Uint8Array(unsigned));

  if (sponsored) {
    const res = await fetch("/api/svm/sponsor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx: toBase64(new Uint8Array(userSigned)) }),
    });
    if (!res.ok) throw new Error(`sponsor failed (${res.status})`);
    const { signature } = (await res.json()) as { signature: string };
    return signature;
  }

  const sig = await conn.sendRawTransaction(userSigned);
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
