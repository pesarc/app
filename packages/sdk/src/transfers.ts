import { promises as fs } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

// Account scoping comes from the verified Privy identity (lib/api/auth.ts).
// Unauthenticated/mock-mode callers share the demo bucket; real users never do.
export { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

export type TransferInput = {
  direction: "sent" | "received";
  counterparty: string;
  counterpartyHandle?: string;
  sendAmount: number;
  sendCurrency: string;
  receiveAmount: number;
  receiveCurrency: string;
  payout: string;
  reference: string;
  flag?: string;
  /** On-chain settlement tx hash, when the send executed on testnet. */
  txHash?: string;
};

export type TransferRow = TransferInput & {
  id: string;
  account: string;
  createdAt: string;
};

const hasNeon = () => Boolean(process.env.DATABASE_URL);

function sqlClient() {
  return neon(process.env.DATABASE_URL!);
}

type Sql = ReturnType<typeof sqlClient>;

// Migrations (scripts/migrate.mjs) own the schema. This runs at most ONCE per
// process as a zero-config dev fallback — never DDL on the request hot path.
let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= createSchema(sql);
  return schemaReady;
}

async function createSchema(sql: Sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS transfers (
      id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account           text NOT NULL DEFAULT 'demo',
      direction         text NOT NULL,
      counterparty      text NOT NULL,
      counterparty_handle text,
      send_amount       numeric NOT NULL,
      send_currency     text NOT NULL,
      receive_amount    numeric NOT NULL,
      receive_currency  text NOT NULL,
      payout            text NOT NULL,
      reference         text NOT NULL,
      flag              text,
      tx_hash           text,
      created_at        timestamptz NOT NULL DEFAULT now()
    )
  `;
  // Upgrade pre-existing tables in place.
  await sql`ALTER TABLE transfers ADD COLUMN IF NOT EXISTS tx_hash text`;
}

export async function recordTransfer(
  input: TransferInput,
  account = DEMO_ACCOUNT
): Promise<{ ok: boolean; error?: string }> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      await sql`
        INSERT INTO transfers
          (account, direction, counterparty, counterparty_handle,
           send_amount, send_currency, receive_amount, receive_currency,
           payout, reference, flag, tx_hash)
        VALUES
          (${account}, ${input.direction}, ${input.counterparty},
           ${input.counterpartyHandle ?? null}, ${input.sendAmount},
           ${input.sendCurrency}, ${input.receiveAmount}, ${input.receiveCurrency},
           ${input.payout}, ${input.reference}, ${input.flag ?? null},
           ${input.txHash ?? null})
      `;
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Neon insert failed",
      };
    }
  }
  return recordToFile(input, account);
}

export async function listTransfers(
  account = DEMO_ACCOUNT,
  limit = 20
): Promise<TransferRow[]> {
  if (hasNeon()) {
    try {
      const sql = sqlClient();
      await ensureSchema(sql);
      const rows = await sql`
        SELECT * FROM transfers
        WHERE account = ${account}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return (rows as any[]).map(mapRow);
    } catch {
      return [];
    }
  }
  return listFromFile(account, limit);
}

function mapRow(r: any): TransferRow {
  return {
    id: String(r.id),
    account: r.account,
    direction: r.direction,
    counterparty: r.counterparty,
    counterpartyHandle: r.counterparty_handle ?? undefined,
    sendAmount: Number(r.send_amount),
    sendCurrency: r.send_currency,
    receiveAmount: Number(r.receive_amount),
    receiveCurrency: r.receive_currency,
    payout: r.payout,
    reference: r.reference,
    flag: r.flag ?? undefined,
    txHash: r.tx_hash ?? undefined,
    createdAt:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

/* ---- Local JSONL fallback (zero-config dev without DATABASE_URL) ---- */

function filePath() {
  return path.join(process.cwd(), ".data", "transfers.jsonl");
}

async function recordToFile(
  input: TransferInput,
  account: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const file = filePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const row: TransferRow = {
      ...input,
      id: `${Date.now()}`,
      account,
      createdAt: new Date().toISOString(),
    };
    await fs.appendFile(file, JSON.stringify(row) + "\n", "utf8");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "File write failed",
    };
  }
}

async function listFromFile(
  account: string,
  limit: number
): Promise<TransferRow[]> {
  try {
    const data = await fs.readFile(filePath(), "utf8");
    return data
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as TransferRow)
      .filter((r) => r.account === account)
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}
