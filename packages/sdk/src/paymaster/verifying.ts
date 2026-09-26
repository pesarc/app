// In-house ERC-4337 VerifyingPaymaster: the off-chain signer half. Given a
// user operation, it signs a time-boxed sponsorship that our on-chain
// VerifyingPaymaster (contracts/evm/src/VerifyingPaymaster.sol) verifies. Kept
// deliberately consistent with that contract's getHash so signatures recover.
//
// AUDIT REQUIRED before Arc mainnet. This is money-path code: a bug lets someone
// drain the paymaster's deposit. It ships behind the gas-sponsor seam so Circle
// Gas Station carries production until this is audited + integration-tested.

import {
  keccak256,
  encodeAbiParameters,
  encodePacked,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** The subset of a v0.7 UserOperation the sponsorship binds to. */
export type UserOpForHash = {
  sender: Address;
  nonce: bigint;
  callData: Hex;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

/**
 * The sponsorship hash. MUST match VerifyingPaymaster.getHash on-chain: binds
 * the sponsorship to who is sending, what they're calling, the fees, the
 * validity window, this chain, and this paymaster — so a signed sponsorship
 * can't be replayed on another op, chain, or paymaster.
 */
export function getSponsorHash(params: {
  userOp: UserOpForHash;
  validUntil: number;
  validAfter: number;
  chainId: number;
  paymaster: Address;
}): Hex {
  const { userOp, validUntil, validAfter, chainId, paymaster } = params;
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" }, // sender
        { type: "uint256" }, // nonce
        { type: "bytes32" }, // keccak(callData)
        { type: "uint256" }, // maxFeePerGas
        { type: "uint256" }, // maxPriorityFeePerGas
        { type: "uint48" }, // validUntil
        { type: "uint48" }, // validAfter
        { type: "uint256" }, // chainId
        { type: "address" }, // paymaster
      ],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.callData),
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        validUntil,
        validAfter,
        BigInt(chainId),
        paymaster,
      ],
    ),
  );
}

/** paymasterData = uint48 validUntil || uint48 validAfter || 65-byte signature. */
export function encodePaymasterData(
  validUntil: number,
  validAfter: number,
  signature: Hex,
): Hex {
  return encodePacked(
    ["uint48", "uint48", "bytes"],
    [validUntil, validAfter, signature],
  );
}

/** A 65-byte dummy signature for gas estimation (pm_getPaymasterStubData). */
export const STUB_SIGNATURE: Hex = `0x${"fc".repeat(65)}`;

/**
 * Sign a sponsorship for `userOp`, valid for `validitySeconds` from now.
 * Returns the ERC-7677 paymasterData fields.
 */
export async function signSponsorship(params: {
  userOp: UserOpForHash;
  chainId: number;
  paymaster: Address;
  signerPk: Hex;
  validitySeconds?: number;
  now?: number;
}): Promise<{ validUntil: number; validAfter: number; signature: Hex; paymasterData: Hex }> {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validUntil = now + (params.validitySeconds ?? 300);

  const hash = getSponsorHash({
    userOp: params.userOp,
    validUntil,
    validAfter,
    chainId: params.chainId,
    paymaster: params.paymaster,
  });

  // The contract verifies toEthSignedMessageHash(getHash).recover == owner, so
  // sign the EIP-191 personal-message form of the hash.
  const account = privateKeyToAccount(params.signerPk);
  const signature = await account.signMessage({ message: { raw: hash } });

  return {
    validUntil,
    validAfter,
    signature,
    paymasterData: encodePaymasterData(validUntil, validAfter, signature),
  };
}
