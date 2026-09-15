// Prove the full on-chain lifecycle on devnet: create -> stake -> propose ->
// finalize -> CLAIM. Uses a distinct proposer (attestor) from the treasury so
// finalize's treasury_token != proposer_token. This is the end-to-end proof
// that the claim path (svmClaim) pays out.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const { AnchorProvider, Program, Wallet, BN, web3 } = anchor;
const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, LAMPORTS_PER_SOL } = web3;

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IDL = JSON.parse(fs.readFileSync(path.join(REPO, "contracts/svm/target/idl/prediction_market.json"), "utf8"));
const DEC = 6;
const unit = (n) => new BN(BigInt(Math.round(n)) * 10n ** BigInt(DEC));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf8"))));
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(payer), { commitment: "confirmed" });
  const program = new Program(IDL, provider);
  const programId = program.programId;
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

  const proposer = Keypair.generate();
  await provider.sendAndConfirm(new web3.Transaction().add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: proposer.publicKey, lamports: 0.05 * LAMPORTS_PER_SOL })));

  const mint = await createMint(conn, payer, payer.publicKey, null, DEC);
  const payerAta = await getOrCreateAssociatedTokenAccount(conn, payer, mint, payer.publicKey);
  const propAta = await getOrCreateAssociatedTokenAccount(conn, payer, mint, proposer.publicKey);
  await mintTo(conn, payer, mint, payerAta.address, payer, 1_000_000n * 10n ** BigInt(DEC));
  await mintTo(conn, payer, mint, propAta.address, payer, 1_000n * 10n ** BigInt(DEC));

  const id = new BN((await program.account.config.fetch(config)).marketCount);
  const [market] = PublicKey.findProgramAddressSync([Buffer.from("market"), id.toArrayLike(Buffer, "le", 8)], programId);
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("position"), market.toBuffer(), payer.publicKey.toBuffer()], programId);

  const now = Math.floor(Date.now() / 1000);
  const CLOSE = 15;
  await program.methods
    .createMarket("Demo lifecycle market", new BN(now + CLOSE), new BN(now + CLOSE + 1), new BN(1),
      proposer.publicKey, unit(50), 1, 0, new BN(1600), mint, mint, 0, Array(32).fill(0))
    .accounts({ config, market, collateralMint: mint, vault, authority: payer.publicKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId, rent: SYSVAR_RENT_PUBKEY })
    .rpc();
  console.log("created market #" + id.toString());

  for (const [isYes, amt] of [[true, 4000], [false, 1500]]) {
    await program.methods.stake(isYes, unit(amt))
      .accounts({ market, position, vault, userToken: payerAta.address, user: payer.publicKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
  }
  console.log("staked yes 4000 / no 1500");

  const waitMs = (now + CLOSE + 2 - Math.floor(Date.now() / 1000)) * 1000;
  await sleep(Math.max(waitMs, 1000));

  await program.methods.propose(1)
    .accounts({ market, vault, attestorToken: propAta.address, attestor: proposer.publicKey, tokenProgram: TOKEN_PROGRAM_ID })
    .signers([proposer]).rpc();
  console.log("proposed Yes");

  await sleep(3000);
  await program.methods.finalize()
    .accounts({ market, vault, treasuryToken: payerAta.address, proposerToken: propAta.address, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  const m = await program.account.market.fetch(market);
  console.log(`finalized — status=${m.status} outcome=${m.outcome} (3=Finalized,1=Yes)`);

  const before = Number((await getAccount(conn, payerAta.address)).amount) / 1e6;
  await program.methods.claim()
    .accounts({ market, position, vault, userToken: payerAta.address, user: payer.publicKey, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
  const after = Number((await getAccount(conn, payerAta.address)).amount) / 1e6;
  console.log(`CLAIM: collateral ${before} -> ${after} (Δ ${after - before}) — winner paid out ✓`);
}
main().catch((e) => { console.error("FAILED:", e.message || e); if (e.logs) console.error(e.logs.slice(-8).join("\n")); process.exit(1); });
