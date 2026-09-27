import { getSql } from "./db";
export { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";
import { DEMO_ACCOUNT } from "@pesarc/sdk/api/auth";

// Saved recipients per account, so someone you send to (a phone number or a
// resolved bank account) reappears next time instead of being re-typed.

export type RecipientKind = "phone" | "bank" | "alias" | "contact";

export type RecipientInput = {
  name: string;
  handle: string; // phone / masked account / @alias — the natural key per account
  kind: RecipientKind;
  receiveCurrency: string;
  flag?: string;
  country?: string;
  bankCode?: string;
  accountLast4?: string;
};

export type SavedRecipient = RecipientInput & {
  id: string;
  account: string;
  createdAt: string;
};

const hasNeon = () => Boolean(process.env.DATABASE_URL);
type Sql = ReturnType<typeof getSql>;

let schemaReady: Promise<void> | null = null;
function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS recipients (
      id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      account          text NOT NULL DEFAULT 'demo',
      name             text NOT NULL,
      handle           text NOT NULL,
      kind             text NOT NULL,
      receive_currency text NOT NULL,
      flag             text,
      country          text,
      bank_code        text,
      account_last4    text,
      created_at       timestamptz NOT NULL DEFAULT now(),
      updated_at       timestamptz NOT NULL DEFAULT now(),
      UNIQUE (account, handle)
    )
  `.then(() => undefined);
  return schemaReady;
}

/** Upsert a recipient for an account (bumped to the top on repeat sends). */
export async function saveRecipient(
  input: RecipientInput,
  account = DEMO_ACCOUNT,
): Promise<{ ok: boolean }> {
  if (!hasNeon() || !input.handle.trim()) return { ok: false };
  try {
    const sql = getSql();
    await ensureSchema(sql);
    await sql`
      INSERT INTO recipients
        (account, name, handle, kind, receive_currency, flag, country, bank_code, account_last4)
      VALUES
        (${account}, ${input.name}, ${input.handle}, ${input.kind}, ${input.receiveCurrency},
         ${input.flag ?? null}, ${input.country ?? null}, ${input.bankCode ?? null}, ${input.accountLast4 ?? null})
      ON CONFLICT (account, handle) DO UPDATE SET
        name = EXCLUDED.name,
        kind = EXCLUDED.kind,
        receive_currency = EXCLUDED.receive_currency,
        flag = COALESCE(EXCLUDED.flag, recipients.flag),
        country = COALESCE(EXCLUDED.country, recipients.country),
        bank_code = COALESCE(EXCLUDED.bank_code, recipients.bank_code),
        account_last4 = COALESCE(EXCLUDED.account_last4, recipients.account_last4),
        updated_at = now()
    `;
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Recipients for an account, most-recently-used first. */
export async function listRecipients(
  account = DEMO_ACCOUNT,
  limit = 30,
): Promise<SavedRecipient[]> {
  if (!hasNeon()) return [];
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT * FROM recipients
      WHERE account = ${account}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((r) => ({
      id: String(r.id),
      account: r.account,
      name: r.name,
      handle: r.handle,
      kind: r.kind as RecipientKind,
      receiveCurrency: r.receive_currency,
      flag: r.flag ?? undefined,
      country: r.country ?? undefined,
      bankCode: r.bank_code ?? undefined,
      accountLast4: r.account_last4 ?? undefined,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}
