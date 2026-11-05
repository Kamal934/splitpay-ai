import "server-only";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/openai";
import type { Group, Member, PaymentRequest, RequestStatus } from "./types";
import { fromCents } from "./money";

/**
 * All PayPal calls in SplitPay go through the official PayPal Agent Toolkit.
 * The toolkit ships OpenAI-style tool adapters; we call its tool executor directly
 * (and expose curated wrappers of it to Claude in agent.ts).
 */
let toolkit: PayPalAgentToolkit | null = null;

function tk(): PayPalAgentToolkit {
  if (toolkit) return toolkit;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set");
  toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: {
        invoices: { create: true, send: true, get: true, list: true, sendReminder: true, cancel: true, recordPayment: true },
        orders: { create: true, get: true, capture: true },
      },
      context: { sandbox: process.env.PAYPAL_ENVIRONMENT !== "live" },
    },
  });
  return toolkit;
}

/** Run one PayPal Agent Toolkit tool and parse its JSON result. */
export async function paypalTool<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await tk().handleToolCall({
    id: `call_${Date.now()}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  });
  const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`PayPal ${name} failed: ${text.slice(0, 300)}`);
  }
  const p = parsed as Record<string, unknown>;
  if (p && (p.error || p.name === "INVALID_REQUEST" || p.debug_id)) {
    throw new Error(`PayPal ${name} failed: ${text.slice(0, 400)}`);
  }
  return parsed as T;
}

const idFromHref = (href: string) => href.split("/").pop()!.split("#").pop()!;

/** Create + send a PayPal invoice for one member's share. */
export async function sendInvoice(
  group: Group,
  member: Member,
  cents: number,
  note: string,
): Promise<Pick<PaymentRequest, "invoiceId" | "payerUrl" | "status">> {
  const [given, ...rest] = member.name.trim().split(/\s+/);
  const created = await paypalTool<{ href: string }>("create_invoice", {
    currency_code: group.currency,
    note,
    invoicer_business_name: `SplitPay · ${group.name}`.slice(0, 300),
    invoicer_email_address: process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL,
    primary_recipients: [
      { billing_info: { email_address: member.email, name: { given_name: given || member.name, surname: rest.join(" ") || "-" } } },
    ],
    items: [
      {
        name: `Your share · ${group.name}`.slice(0, 200),
        quantity: "1",
        unit_amount: { currency_code: group.currency, value: fromCents(cents) },
      },
    ],
  });
  const invoiceId = idFromHref(created.href);
  const sent = await paypalTool<{ href?: string }>("send_invoice", {
    invoice_id: invoiceId,
    send_to_recipient: true,
    note,
  });
  return { invoiceId, payerUrl: sent.href, status: "SENT" };
}

export async function getInvoiceStatus(invoiceId: string): Promise<RequestStatus> {
  const inv = await paypalTool<{ status: RequestStatus }>("get_invoice", { invoice_id: invoiceId });
  return inv.status;
}

export async function remindInvoice(invoiceId: string, note: string, subject?: string) {
  await paypalTool("send_invoice_reminder", { invoice_id: invoiceId, note, subject });
}

export async function cancelInvoice(invoiceId: string, note: string) {
  await paypalTool("cancel_sent_invoice", { invoice_id: invoiceId, note, send_to_recipient: true });
}
