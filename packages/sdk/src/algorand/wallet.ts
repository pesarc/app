// Client-side, self-custody Algorand wallet creation. The account is generated in
// the browser; the 25-word recovery phrase is shown to the user once and NEVER
// sent to or stored by Pesarc (same trust model as MetaMask). We keep only the
// public address. algosdk is imported dynamically so it stays out of the main
// bundle until a user actually creates a wallet.

export type NewAlgorandWallet = { address: string; mnemonic: string };

/** Generate a fresh Algorand account in the browser. Returns the public address
 *  and the 25-word mnemonic — the caller shows the mnemonic once and must not
 *  persist it anywhere. */
export async function createAlgorandAccount(): Promise<NewAlgorandWallet> {
  const algosdk = (await import("algosdk")).default;
  const acct = algosdk.generateAccount();
  return { address: acct.addr, mnemonic: algosdk.secretKeyToMnemonic(acct.sk) };
}

/** True when `phrase` is a valid 25-word Algorand mnemonic that recovers `address`
 *  (when given). Used to confirm the user actually saved their phrase. */
export async function mnemonicMatches(phrase: string, address?: string): Promise<boolean> {
  try {
    const algosdk = (await import("algosdk")).default;
    const { addr } = algosdk.mnemonicToSecretKey(phrase.trim().replace(/\s+/g, " "));
    return address ? addr === address : true;
  } catch {
    return false;
  }
}
