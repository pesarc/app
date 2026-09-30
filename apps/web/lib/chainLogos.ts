// Real chain brand logos on Cloudinary (public cloud name), one source of truth
// shared by the landing network hub and the in-app activity feed. Delivery needs
// only the public cloud name; add a chain here and both surfaces pick it up.

export const CLOUD = "noivtpg4";

/** Canonical chain name -> Cloudinary public ID. */
export const CHAIN_LOGO: Record<string, string> = {
  Ethereum: "eth-diamond-_color-filled_cbdlt6",
  Base: "Base_square_blue_dd1ktd",
  Arc: "Arc_Icon_YellowGradient_avsvys",
  Solana: "solanaLogoMark_jvqcyo",
  Celo: "Celo_Symbol_RGB_ProsperityYellow_vvwx61",
  Arbitrum: "1225_Arbitrum_Logomark_FullColor_ClearSpace_xlpcpl",
  Optimism: "05dee11fbd0f605cc307d301daf68e2192297e50_k3gqrv",
  Algorand: "algorand-logomark-blue-RGB_ckba3s",
  Polygon: "polygon-icon-primary-purple_w6psna",
};

// e_trim strips each source's surrounding padding first, so marks that ship with
// lots of whitespace (Arbitrum, Polygon) end up the same visual size as the rest.
const DEFAULT_TRANSFORM = "e_trim/w_64,h_64,c_fit,f_auto,q_auto";

/** Cloudinary delivery URL for a chain logo, or "" when we have none. */
export function chainLogoUrl(key: string, transform = DEFAULT_TRANSFORM): string {
  const id = CHAIN_LOGO[key];
  if (!id) return "";
  return `https://res.cloudinary.com/${CLOUD}/image/upload/${transform}/${id}`;
}

/** Map any human chain label ("Arbitrum Sepolia", "OP Mainnet", …) to a canonical
 *  CHAIN_LOGO key. One place so every surface (balance, swap, send, bridge) tags
 *  a chain with the same brand mark. */
export function chainLogoKey(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("arbitrum")) return "Arbitrum";
  if (l.includes("base")) return "Base";
  if (l.includes("optimism") || /\bop\b/.test(l)) return "Optimism";
  if (l.includes("polygon") || l.includes("amoy")) return "Polygon";
  if (l.includes("celo")) return "Celo";
  if (l.includes("arc")) return "Arc";
  if (l.includes("solana")) return "Solana";
  if (l.includes("algorand")) return "Algorand";
  if (l.includes("avalanche") || l.includes("fuji")) return "Avalanche";
  if (l.includes("ethereum") || l.includes("sepolia")) return "Ethereum";
  return "";
}

/** Logo URL straight from a chain label ("" when we have none). */
export const chainLogoUrlForLabel = (label: string, transform?: string): string =>
  chainLogoUrl(chainLogoKey(label), transform);
