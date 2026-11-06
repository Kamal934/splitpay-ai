import "server-only";
import { listGroups, updateGroup } from "./db";
import { fmt } from "./money";
import { getInvoiceStatus } from "./paypal";
import { audit, type ActionLog } from "./service";
import { PAID_STATUSES, type RequestStatus } from "./types";

const API = process.env.PAYPAL_ENVIRONMENT === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

let token: { value: string; exp: number } | null = null;

async function accessToken() {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

/**
 * Ask PayPal whether this webhook really came from PayPal for our webhook ID.
 * https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
 */
export async function verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not set");
  const h = (k: string) => headers.get(k) ?? "";
  if (!h("paypal-transmission-id") || !h("paypal-transmission-sig")) return false;
  const res = await fetch(`${API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: h("paypal-auth-algo"),
      cert_url: h("paypal-cert-url"),
      transmission_id: h("paypal-transmission-id"),
      transmission_sig: h("paypal-transmission-sig"),
      transmission_time: h("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });
  if (!res.ok) return false;
  const j = (await res.json()) as { verification_status?: string };
  return j.verification_status === "SUCCESS";
}

/** Every PayPal invoice ID mentioned anywhere in the event (e.g. INV2-ABCD-1234-EFGH-5678). */
export function invoiceIdsIn(event: unknown): string[] {
  return [...new Set(JSON.stringify(event).match(/INV2(?:-[A-Z0-9]{4}){4}/g) ?? [])];
}

/**
 * For each of our invoices mentioned in a verified event, re-read the status straight
 * from PayPal (we don't trust the event body for money state) and update the ledger.
 * Safe to run twice: nothing changes if the status is already current.
 */
export async function applyInvoiceEvent(eventType: string, invoiceIds: string[]) {
  const groups = await listGroups();
  let matched = 0;
  let changed = 0;
  for (const g of groups) {
    const hits = g.requests.filter((r) => r.invoiceId && invoiceIds.includes(r.invoiceId));
    if (!hits.length) continue;
    matched += hits.length;
    const fresh = new Map<string, RequestStatus>();
    for (const r of hits) {
      try {
        fresh.set(r.id, await getInvoiceStatus(r.invoiceId!));
      } catch {
        /* leave as is; Check payments / autopilot will catch up */
      }
    }
    const log: ActionLog[] = [];
    await updateGroup(g.id, (gg) => {
      gg.lastCheckedAt = new Date().toISOString();
      for (const r of gg.requests) {
        const s = fresh.get(r.id);
        if (!s || s === r.status) continue;
        r.status = s;
        r.updatedAt = new Date().toISOString();
        changed++;
        const who = gg.members.find((m) => m.id === r.memberId)?.name ?? "Someone";
        log.push({
          kind: "status",
          detail: PAID_STATUSES.includes(s)
            ? `PayPal confirmed ${who} paid ${fmt(r.cents, gg.currency)}`
            : `PayPal: ${who}'s ${fmt(r.cents, gg.currency)} request is now ${s.toLowerCase().replace(/_/g, " ")}`,
          ok: true,
        });
      }
    });
    await audit(g.id, "paypal", log);
  }
  return { eventType, matched, changed };
}
