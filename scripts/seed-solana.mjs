// Seed the prediction_market program on Solana devnet with a few markets so the
// app's Markets board reads LIVE from Solana. One-off: initialize Config, create
// a test SPL collateral (cNGN stand-in), create_market x3, and stake both sides
// so pools are non-zero. Idempotent-ish: skips initialize if Config exists and
// appends markets (ids continue from config.market_count).
//
// Run from the app dir: node scripts/seed-solana.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchor from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const { AnchorProvider, Program, Wallet, BN, web3 } = anchor;
const { Connection, PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } = web3;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IDL_PATH = path.join(REPO_ROOT, "contracts/svm/target/idl/prediction_market.json");
const RPC = process.env.SVM_RPC_URL || "https://api.devnet.solana.com";
const DECIMALS = 6;
const unit = (n) => BigInt(Math.round(n)) * 10n ** BigInt(DECIMALS);

function loadKeypair() {
  const p = path.join(os.homedir(), ".config/solana/id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8"))));
}

const MARKETS = [
  { q: "USD/NGN monthly close >= 1600", cmp: 0, threshold: 1600n, yes: 6200, no: 3800 },
  { q: "PMS pump price >= 1000/litre in December", cmp: 0, threshold: 1000n, yes: 2100, no: 1450 },
  { q: "Nigeria CPI inflation stays under 30%", cmp: 1, threshold: 30n, yes: 1300, no: 2700 },
];

async function main() {
  const payer = loadKeypair();
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: "confirmed" });
  const idl = JSON.parse(fs.readFileSync(IDL_PATH, "utf8"));
  const program = new Program(idl, provider);
  const programId = program.programId;
  console.log("program:", programId.toBase58(), "\npayer:  ", payer.publicKey.toBase58());

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);

  const cfgInfo = await connection.getAccountInfo(config);
  if (!cfgInfo) {
    await program.methods
      .initialize(payer.publicKey, 50)
      .accounts({ config, authority: payer.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    console.log("initialized config");
  } else {
    console.log("config already exists");
  }

  const mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
  await mintTo(connection, payer, mint, ata.address, payer, unit(1_000_000));
  console.log("collateral mint:", mint.toBase58());

  const now = Math.floor(Date.now() / 1000);
  const feedRef = Array(32).fill(0);

  for (const m of MARKETS) {
    const cfg = await program.account.config.fetch(config);
    const count = new BN(cfg.marketCount);
    const [market] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), count.toArrayLike(Buffer, "le", 8)],
      programId
    );
    const [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), market.toBuffer()],
      programId
    );

    await program.methods
      .createMarket(
        m.q,
        new BN(now + 30 * 86400),
        new BN(now + 31 * 86400),
        new BN(86400),
        payer.publicKey,
        new BN(unit(50).toString()), // bond (must be > 0 for attested markets)
        1, // source_kind = attested
        m.cmp,
        new BN(m.threshold.toString()),
        mint,
        mint,
        0,
        feedRef
      )
      .accounts({
        config,
        market,
        collateralMint: mint,
        vault,
        authority: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), payer.publicKey.toBuffer()],
      programId
    );

    for (const [isYes, amt] of [[true, m.yes], [false, m.no]]) {
      await program.methods
        .stake(isYes, new BN(unit(amt).toString()))
        .accounts({
          market,
          position,
          vault,
          userToken: ata.address,
          user: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
    console.log(`market #${count.toString()} "${m.q}" — yes ${m.yes} / no ${m.no}`);
  }

  const total = (await program.account.config.fetch(config)).marketCount;
  console.log("done. total markets:", total.toString());
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message || e);
  process.exit(1);
});
