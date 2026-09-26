// Solana CCTP V2 — depositForBurn (source side). Burns USDC on Solana so it can
// be minted on an EVM/Arc destination by the existing relayer. Built from
// Circle's program source (programs/v2/token-messenger-minter-v2), so the
// account list, PDA seeds and instruction layout are authoritative — not
// guessed. A malformed instruction reverts atomically (no funds move); the only
// fund-directing field is mintRecipient, which we set to the padded dest addr.
//
// NOTE: mainnet money path — test with a small amount before trusting it.
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import type { SolanaSigner } from "./write";

// Mainnet program IDs (developers.circle.com/cctp/solana-programs).
export const TOKEN_MESSENGER_MINTER_V2 = new PublicKey(
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe",
);
export const MESSAGE_TRANSMITTER_V2 = new PublicKey(
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC",
);
export const SOLANA_USDC = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// anchor sha256("global:deposit_for_burn")[:8]
const DEPOSIT_FOR_BURN_DISC = Uint8Array.from([215, 60, 61, 46, 114, 55, 128, 176]);

const seed = (s: string) => Buffer.from(s);
const pda = (seeds: (Buffer | Uint8Array)[], program: PublicKey) =>
  PublicKey.findProgramAddressSync(seeds, program)[0];

function ataFor(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/** An EVM address (0x…20 bytes) as a 32-byte CCTP recipient (left-padded). */
export function evmRecipient32(address: string): Uint8Array {
  const hex = address.replace(/^0x/, "").padStart(64, "0");
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export type SolanaBurnParams = {
  amount: bigint;
  destinationDomain: number;
  /** 32-byte mint recipient on the destination (see evmRecipient32). */
  mintRecipient: Uint8Array;
  maxFee: bigint;
  minFinalityThreshold: number;
};

function encodeData(p: SolanaBurnParams): Buffer {
  const b = Buffer.alloc(8 + 8 + 4 + 32 + 32 + 8 + 4);
  let o = 0;
  Buffer.from(DEPOSIT_FOR_BURN_DISC).copy(b, o); o += 8;
  b.writeBigUInt64LE(p.amount, o); o += 8;
  b.writeUInt32LE(p.destinationDomain, o); o += 4;
  Buffer.from(p.mintRecipient).copy(b, o); o += 32;        // mint_recipient
  Buffer.alloc(32).copy(b, o); o += 32;                    // destination_caller = default
  b.writeBigUInt64LE(p.maxFee, o); o += 8;
  b.writeUInt32LE(p.minFinalityThreshold, o); o += 4;
  return b;
}

/** Build the depositForBurn instruction (accounts in the program's exact order). */
export function buildDepositForBurnIx(
  owner: PublicKey,
  messageSentEventData: PublicKey,
  p: SolanaBurnParams,
): TransactionInstruction {
  const senderAuthority = pda([seed("sender_authority")], TOKEN_MESSENGER_MINTER_V2);
  const denylist = pda([seed("denylist_account"), owner.toBuffer()], TOKEN_MESSENGER_MINTER_V2);
  const messageTransmitter = pda([seed("message_transmitter")], MESSAGE_TRANSMITTER_V2);
  const tokenMessenger = pda([seed("token_messenger")], TOKEN_MESSENGER_MINTER_V2);
  const remoteTokenMessenger = pda(
    [seed("remote_token_messenger"), seed(String(p.destinationDomain))],
    TOKEN_MESSENGER_MINTER_V2,
  );
  const tokenMinter = pda([seed("token_minter")], TOKEN_MESSENGER_MINTER_V2);
  const localToken = pda([seed("local_token"), SOLANA_USDC.toBuffer()], TOKEN_MESSENGER_MINTER_V2);
  const eventAuthority = pda([seed("__event_authority")], TOKEN_MESSENGER_MINTER_V2);
  const burnTokenAccount = ataFor(owner, SOLANA_USDC);

  const keys = [
    { pubkey: owner, isSigner: true, isWritable: false }, // owner
    { pubkey: owner, isSigner: true, isWritable: true }, // event_rent_payer (= owner)
    { pubkey: senderAuthority, isSigner: false, isWritable: false },
    { pubkey: burnTokenAccount, isSigner: false, isWritable: true },
    { pubkey: denylist, isSigner: false, isWritable: false },
    { pubkey: messageTransmitter, isSigner: false, isWritable: true },
    { pubkey: tokenMessenger, isSigner: false, isWritable: false },
    { pubkey: remoteTokenMessenger, isSigner: false, isWritable: false },
    { pubkey: tokenMinter, isSigner: false, isWritable: false },
    { pubkey: localToken, isSigner: false, isWritable: true },
    { pubkey: SOLANA_USDC, isSigner: false, isWritable: true }, // burn_token_mint
    { pubkey: messageSentEventData, isSigner: true, isWritable: true },
    { pubkey: MESSAGE_TRANSMITTER_V2, isSigner: false, isWritable: false },
    { pubkey: TOKEN_MESSENGER_MINTER_V2, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false }, // #[event_cpi]
    { pubkey: TOKEN_MESSENGER_MINTER_V2, isSigner: false, isWritable: false }, // program
  ];

  return new TransactionInstruction({
    programId: TOKEN_MESSENGER_MINTER_V2,
    keys,
    data: encodeData(p),
  });
}

/** Burn USDC on Solana. The user is fee-payer (needs a little SOL) and the
 *  fresh event-data account co-signs. Returns the burn tx signature. */
export async function burnOnSolana(
  signer: SolanaSigner,
  rpcUrl: string,
  p: SolanaBurnParams,
): Promise<string> {
  const conn = new Connection(rpcUrl, "confirmed");
  const owner = new PublicKey(signer.address);
  const eventData = Keypair.generate();

  const ix = buildDepositForBurnIx(owner, eventData.publicKey, p);
  const tx = new Transaction().add(ix);
  tx.feePayer = owner;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.partialSign(eventData); // the event-data account signs; the user signs next

  const unsigned = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const userSigned = await signer.signTransaction(new Uint8Array(unsigned));
  const sig = await conn.sendRawTransaction(userSigned);
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}
