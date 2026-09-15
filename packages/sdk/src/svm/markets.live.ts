// Live read of the on-chain prediction_market program on Solana. Mirrors the
// EVM markets.live: overlays real pools + implied odds onto the market catalog,
// fails soft (null → mock catalog). Decodes Market accounts by fixed offset
// (Anchor 8-byte discriminator + borsh layout) so no Anchor client is needed.

import { Connection, PublicKey } from "@solana/web3.js";
import { svmConfig } from "./config";
import type { LiveMarket } from "../markets.live";

// Market account discriminator from the IDL (sha256("account:Market")[..8]).
const MARKET_DISCRIMINATOR = [219, 190, 213, 55, 0, 227, 198, 154];

// Byte offsets into the Market account (after the 8-byte discriminator):
//   id u64 @8 · pool_yes u64 @112 · pool_no u64 @120 · outcome u8 @217 · status u8 @218
const OFF = { id: 8, poolYes: 112, poolNo: 120, outcome: 217, status: 218 };
const MIN_LEN = 219;

function u64(view: DataView, offset: number): bigint {
  return view.getBigUint64(offset, true); // little-endian
}

function matchesDiscriminator(data: Uint8Array): boolean {
  for (let i = 0; i < 8; i++) if (data[i] !== MARKET_DISCRIMINATOR[i]) return false;
  return true;
}

export async function fetchSvmMarkets(): Promise<LiveMarket[] | null> {
  const cfg = svmConfig();
  if (!cfg.predictionMarket) return null;

  try {
    const conn = new Connection(cfg.rpcUrl, "confirmed");
    const accounts = await conn.getProgramAccounts(new PublicKey(cfg.predictionMarket));
    const scale = 10 ** cfg.collateralDecimals;

    const out: LiveMarket[] = [];
    for (const { account } of accounts) {
      const data = account.data as Uint8Array;
      if (data.length < MIN_LEN || !matchesDiscriminator(data)) continue;

      const view = new DataView(data.buffer, data.byteOffset, data.length);
      const poolYes = Number(u64(view, OFF.poolYes)) / scale;
      const poolNo = Number(u64(view, OFF.poolNo)) / scale;
      const total = poolYes + poolNo;

      out.push({
        id: Number(u64(view, OFF.id)),
        poolYes,
        poolNo,
        impliedYes: total > 0 ? poolYes / total : 0.5,
        outcome: data[OFF.outcome],
        status: data[OFF.status],
      });
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  } catch {
    return null;
  }
}
