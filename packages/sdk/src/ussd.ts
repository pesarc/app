// USSD menu engine — feature phones, no smartphone or data (Global-South
// mandate). Provider-agnostic but shaped for the Africa's Talking format: the
// gateway POSTs the accumulated `text` (choices joined by "*") each step, and we
// reply with plain text prefixed "CON " (expect more input) or "END " (done).
//
// Stateless: the whole path is in `text`, so we derive the step from it. Buys
// run through the same bills adapter as the app (simulated sandbox by default).

import {
  getBillsAdapter,
  operatorsFor,
  findOperator,
  type BillCategory,
} from "./bills";
import { recordTransfer } from "./transfers";

export type UssdResponse = { type: "CON" | "END"; message: string };

// Nigerian number-range prefixes -> telco, so airtime/data top up the right
// network without asking. Defaults to MTN.
const RANGES: Array<[RegExp, string]> = [
  [/^0?(802|808|708|812|701|902|901|904|907|912|911)/, "airtel-ng"],
  [/^0?(805|807|705|815|811|905|915)/, "glo-ng"],
  [/^0?(809|817|818|908|909)/, "9mobile-ng"],
  [/^0?(803|806|703|706|813|816|810|814|903|906|913|916|704)/, "mtn-ng"],
];

export function operatorFromPhone(phone: string): string {
  const p = phone.replace(/^\+?234/, "0");
  for (const [re, id] of RANGES) if (re.test(p)) return id;
  return "mtn-ng";
}

function money(n: number): string {
  return `NGN ${n.toLocaleString()}`;
}

// Data bundles offered on USSD (kept short for a feature-phone page).
const DATA_MENU: Array<{ label: string; suffix: string }> = [
  { label: "1GB - NGN 1,000", suffix: "1gb" },
  { label: "2GB - NGN 2,000", suffix: "2gb" },
  { label: "5GB - NGN 3,500", suffix: "5gb" },
];

const DISCOS = operatorsFor("electricity"); // ordered list for the menu

const con = (message: string): UssdResponse => ({ type: "CON", message });
const end = (message: string): UssdResponse => ({ type: "END", message });

function record(account: string, label: string, customer: string, amount: number, category: BillCategory, reference: string) {
  recordTransfer(
    {
      direction: "sent",
      counterparty: label,
      counterpartyHandle: customer,
      sendAmount: amount,
      sendCurrency: "NGN",
      receiveAmount: amount,
      receiveCurrency: "NGN",
      payout: category,
      reference,
    },
    account,
  ).catch(() => {});
}

/**
 * Run one USSD step. `text` is the gateway's accumulated input, `phoneNumber`
 * the caller (E.164), `account` the scope key (e.g. `ussd:<phone>`).
 */
export async function handleUssd(input: {
  text: string;
  phoneNumber: string;
  account: string;
}): Promise<UssdResponse> {
  const { text, phoneNumber, account } = input;
  const parts = text === "" ? [] : text.split("*");
  const choice = parts[0];

  if (!choice) {
    return con(
      "Pesarc\n1. Buy airtime\n2. Buy data\n3. Pay electricity\n4. Send money\n5. My account",
    );
  }

  // 1 — Airtime (tops up the caller's own number).
  if (choice === "1") {
    if (parts.length === 1) return con("Buy airtime\nEnter amount (NGN)");
    const amt = parseInt((parts[1] || "").replace(/\D/g, ""), 10);
    if (!amt) return end("Invalid amount. Please dial again.");
    const opId = operatorFromPhone(phoneNumber);
    const r = await getBillsAdapter().purchase({
      category: "airtime",
      operatorId: opId,
      customer: phoneNumber,
      amount: amt,
    });
    record(account, `${findOperator(opId)?.name} airtime`, phoneNumber, r.amount, "airtime", r.reference);
    return end(`Done. ${money(amt)} ${findOperator(opId)?.name} airtime sent to ${phoneNumber}.\nRef ${r.reference}`);
  }

  // 2 — Data (caller's own number, caller's network).
  if (choice === "2") {
    if (parts.length === 1) {
      return con("Buy data\n" + DATA_MENU.map((d, i) => `${i + 1}. ${d.label}`).join("\n"));
    }
    const pick = DATA_MENU[parseInt(parts[1] || "", 10) - 1];
    if (!pick) return end("Invalid choice. Please dial again.");
    const opId = operatorFromPhone(phoneNumber);
    const r = await getBillsAdapter().purchase({
      category: "data",
      operatorId: opId,
      customer: phoneNumber,
      planId: `${opId}-${pick.suffix}`,
    });
    record(account, `${findOperator(opId)?.name} data`, phoneNumber, r.amount, "data", r.reference);
    return end(`Done. ${pick.label.split(" - ")[0]} ${findOperator(opId)?.name} data for ${phoneNumber}.\nRef ${r.reference}`);
  }

  // 3 — Electricity: choose DisCo, meter, amount.
  if (choice === "3") {
    if (parts.length === 1) {
      return con("Pay electricity\n" + DISCOS.map((d, i) => `${i + 1}. ${d.name}`).join("\n"));
    }
    const disco = DISCOS[parseInt(parts[1] || "", 10) - 1];
    if (!disco) return end("Invalid choice. Please dial again.");
    if (parts.length === 2) return con(`${disco.name}\nEnter meter number`);
    if (parts.length === 3) return con(`${disco.name}\nEnter amount (NGN)`);
    const meter = (parts[2] || "").replace(/\D/g, "");
    const amt = parseInt((parts[3] || "").replace(/\D/g, ""), 10);
    if (!meter || !amt) return end("Invalid meter or amount. Please dial again.");
    const r = await getBillsAdapter().purchase({
      category: "electricity",
      operatorId: disco.id,
      customer: meter,
      amount: amt,
      meterType: "prepaid",
    });
    record(account, `${disco.name} electricity`, meter, r.amount, "electricity", r.reference);
    const tokenLine = r.token ? `\nToken: ${r.token}` : "";
    return end(`Done. Paid ${money(amt)} to ${disco.name} for meter ${meter}.${tokenLine}\nRef ${r.reference}`);
  }

  // 4 — Send money to another phone.
  if (choice === "4") {
    if (parts.length === 1) return con("Send money\nEnter recipient phone");
    if (parts.length === 2) return con("Enter amount (NGN)");
    const to = (parts[1] || "").replace(/\D/g, "");
    const amt = parseInt((parts[2] || "").replace(/\D/g, ""), 10);
    if (to.length < 7 || !amt) return end("Invalid phone or amount. Please dial again.");
    const ref = `USSD-${Date.now().toString(36).toUpperCase()}`;
    record(account, `Sent to ${to}`, to, amt, "airtime", ref);
    return end(`Done. ${money(amt)} sent to ${to}.\nRef ${ref}`);
  }

  // 5 — Account.
  if (choice === "5") {
    return end(
      "Pesarc: gasless money for every phone. From this menu you can buy airtime, data, pay electricity and send money.",
    );
  }

  return end("Invalid choice. Please dial again.");
}
