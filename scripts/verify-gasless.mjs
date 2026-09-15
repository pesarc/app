// Prove Solana gasless: build a stake with the relayer as fee payer, sign only
// as the user, POST to /api/svm/sponsor, and confirm the USER's SOL is unchanged
// (the relayer paid) while the stake landed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, Keypair } from "@solana/web3.js";

const PROGRAM = new PublicKey("2aMC2CKjqwxmLrS6dv98c6pVYEKogRXxEuz3NZpzv8CZ");
const RELAYER = new PublicKey("4gYU7ctPQmrXepspKP8KCCr9di8vzf4eEx5vKTpqayH2");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATOKEN = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const STAKE = Uint8Array.from([206, 176, 202, 18, 200, 209, 179, 108]);
const u64 = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, n, true); return b; };
const ata = (o, m) => PublicKey.findProgramAddressSync([o.toBuffer(), TOKEN.toBuffer(), m.toBuffer()], ATOKEN)[0];
const user = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), Buffer.from(u64(0n))], PROGRAM);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], PROGRAM);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), user.publicKey.toBuffer()], PROGRAM);
  const info = await conn.getAccountInfo(market);
  const mint = new PublicKey(info.data.subarray(16, 48));
  const userToken = ata(user.publicKey, mint);
  const poolBefore = Number(new DataView(info.data.buffer, info.data.byteOffset, info.data.length).getBigUint64(112, true)) / 1e6;
  const userSolBefore = await conn.getBalance(user.publicKey);
  const relayerSolBefore = await conn.getBalance(RELAYER);

  const data = new Uint8Array(17);
  data.set(STAKE, 0); data[8] = 1; data.set(u64(5n * 10n ** 6n), 9);
  const keys = [
    { pubkey: market, isSigner: false, isWritable: true },
    { pubkey: position, isSigner: false, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: userToken, isSigner: false, isWritable: true },
    { pubkey: user.publicKey, isSigner: true, isWritable: true },
    { pubkey: TOKEN, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const tx = new Transaction().add(new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(data) }));
  tx.feePayer = RELAYER; // gasless
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.partialSign(user); // only the user signs client-side

  const b64 = Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString("base64");
  const res = await fetch("http://localhost:3000/api/svm/sponsor", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: b64 }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error("sponsor: " + JSON.stringify(out));
  await conn.confirmTransaction(out.signature, "confirmed");

  const info2 = await conn.getAccountInfo(market);
  const poolAfter = Number(new DataView(info2.data.buffer, info2.data.byteOffset, info2.data.length).getBigUint64(112, true)) / 1e6;
  const userSolAfter = await conn.getBalance(user.publicKey);
  const relayerSolAfter = await conn.getBalance(RELAYER);

  console.log("sig:", out.signature);
  console.log(`pool_yes: ${poolBefore} -> ${poolAfter} (Δ ${poolAfter - poolBefore})`);
  console.log(`USER  SOL Δ: ${(userSolAfter - userSolBefore) / 1e9} (0 = gasless ✓)`);
  console.log(`RELAYER SOL Δ: ${(relayerSolAfter - relayerSolBefore) / 1e9} (paid the fee)`);
  console.log("GASLESS_OK:", userSolAfter === userSolBefore && relayerSolAfter < relayerSolBefore && poolAfter > poolBefore);
}
main().catch((e) => { console.error("FAILED:", e.message || e); process.exit(1); });
