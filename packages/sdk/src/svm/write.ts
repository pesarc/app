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

export type SolanaSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
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
  const user = signer.publicKey;

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

  const ix = new TransactionInstruction({ programId, keys, data: Buffer.from(data) });
  const tx = new Transaction().add(ix);
  tx.feePayer = user;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const signed = await signer.signTransaction(tx);
  const sig = await conn.sendRawTransaction(signed.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
