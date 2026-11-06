import { NextResponse } from "next/server";
import { applyInvoiceEvent, invoiceIdsIn, verifyWebhook } from "@/lib/webhook";

export const maxDuration = 60;

/**
 * PayPal webhook receiver (Dashboard → your app → Webhooks).
 * 1. Verify the signature with PayPal (rejects anything not from PayPal for our webhook ID).
 * 2. If the event mentions one of our invoices, re-read its status from PayPal and update the ledger.
 * 3. Everything else (we subscribed to all event types) is acknowledged and ignored.
 */
export async function POST(req: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID) {
    return NextResponse.json({ error: "Webhook not configured (PAYPAL_WEBHOOK_ID missing)" }, { status: 503 });
  }
  let event: { id?: string; event_type?: string } | null = null;
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await verifyWebhook(req.headers, event);
  } catch (e) {
    console.error("[webhook] verify error", (e as Error).message);
    // 500 makes PayPal retry later (e.g. if PayPal's verify API had a hiccup).
    return NextResponse.json({ error: "Verification unavailable" }, { status: 500 });
  }
  if (!verified) {
    console.warn("[webhook] rejected unverified event", event?.id, event?.event_type);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const ids = invoiceIdsIn(event);
  if (!ids.length) return NextResponse.json({ ok: true, ignored: event?.event_type ?? "unknown" });

  try {
    const r = await applyInvoiceEvent(event?.event_type ?? "unknown", ids);
    console.log("[webhook]", event?.event_type, JSON.stringify(r));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[webhook] apply error", (e as Error).message);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

/** Handy for checking the URL is live (PayPal only ever POSTs). */
export function GET() {
  return NextResponse.json({ ok: true, configured: !!process.env.PAYPAL_WEBHOOK_ID });
}
