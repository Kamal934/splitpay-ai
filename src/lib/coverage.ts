import type { Expense, Group, PaymentRequest } from "./types";

/** Requests that still count (not cancelled, not failed). */
export const isActive = (r: PaymentRequest) => r.status !== "CANCELLED" && r.status !== "ERROR";

/**
 * Which PayPal request (if any) already covers this member's share of this receipt.
 * A per-receipt request lists its receipt; a "pay all" request covers every receipt
 * added before it was sent. This is what stops anyone being asked twice.
 */
export function coveringRequest(g: Group, memberId: string, e: Expense): PaymentRequest | undefined {
  return g.requests.find((r) => r.memberId === memberId && isActive(r) && (r.expenseIds ? r.expenseIds.includes(e.id) : r.createdAt > e.createdAt));
}
