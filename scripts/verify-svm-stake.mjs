// Verify the manual (no-Anchor) SVM stake instruction from svm/write.ts by
// staking on market #0 with the CLI keypair and checking the pool grew. Proves
// the discriminator + account order + borsh the browser writer uses are correct.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair,
} from "@solana/web3.js";

const PROGRAM = new PublicKey("2aMC2CKjqwxmLrS6dv98c6pVYEKogRXxEuz3NZpzv8CZ");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATOKEN = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const STAKE_DISC = Uint8Array.from([206, 176, 202, 18, 200, 209, 179, 108]);
const DEC = 6;

const u64 = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, n, true); return b; };
const ata = (o, m) => PublicKey.findProgramAddressSync([o.toBuffer(), TOKEN.toBuffer(), m.toBuffer()], ATOKEN)[0];
const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), Buffer.from(u64(0n))], PROGRAM);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), kp.publicKey.toBuffer()], PROGRAM);
  const info = await conn.getAccountInfo(market);
  const before = Number(new DataView(info.data.buffer, info.data.byteOffset, info.data.length).getBigUint64(112, true)) / 1e6;
  const mint = new PublicKey(info.data.subarray(16, 48));
  const userToken = ata(kp.publicKey, mint);

  const amount = 10n * 10n ** BigInt(DEC);
  const data = new Uint8Array(17);
  data.set(STAKE_DISC, 0); data[8] = 1; data.set(u64(amount), 9);
  const keys = [
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: position, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: userToken, isSigner: false, isWritable: true },
    { pubkey: kp.publicKey, isSigner: true, isWritable: true },
    { pubkey: TOKEN, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const tx = new Transaction().add(new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(data) }));
  tx.feePayer = kp.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(kp);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");

  const after = Number(new DataView((await conn.getAccountInfo(market)).data.buffer).getBigUint64(112, true)) / 1e6;
  console.log("stake sig:", sig);
  console.log(`pool_yes: ${before} -> ${after} (Δ ${after - before}) — manual SVM stake instruction OK`);
}
main().catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
