import { computeBalances } from "./money";
import type { Group } from "./types";
import { PAID_STATUSES } from "./types";

/** Real numbers only: everything is derived from the ledger and PayPal statuses. */
export function groupStats(g: Group) {
  const balances = computeBalances(g);
  const spent = g.expenses.reduce((a, e) => a + e.totalCents, 0);
  const collected = g.requests.filter((r) => PAID_STATUSES.includes(r.status)).reduce((a, r) => a + r.cents, 0);
  const pending = balances.reduce((a, b) => a + b.pendingCents, 0);
  const notRequested = balances.reduce((a, b) => a + b.requestableCents, 0);
  return { balances, spent, collected, pending, notRequested, open: pending + notRequested };
}

export type Activity = { at: string; groupId: string; groupName: string; text: string; kind: "expense" | "request" | "paid" | "cancelled" | "failed" };

export function recentActivity(groups: Group[], limit = 8): Activity[] {
  const out: Activity[] = [];
  for (const g of groups) {
    const name = (id: string) => g.members.find((m) => m.id === id)?.name ?? "Someone";
    for (const e of g.expenses) {
      out.push({ at: e.createdAt, groupId: g.id, groupName: g.name, kind: "expense", text: `${name(e.paidBy)} added “${e.description}”` });
    }
    for (const r of g.requests) {
      if (r.status === "ERROR") {
        out.push({ at: r.createdAt, groupId: g.id, groupName: g.name, kind: "failed", text: `PayPal request to ${name(r.memberId)} failed` });
        continue;
      }
      out.push({ at: r.createdAt, groupId: g.id, groupName: g.name, kind: "request", text: `PayPal request sent to ${name(r.memberId)}` });
      if (PAID_STATUSES.includes(r.status)) out.push({ at: r.updatedAt, groupId: g.id, groupName: g.name, kind: "paid", text: `${name(r.memberId)} paid via PayPal` });
      if (r.status === "CANCELLED") out.push({ at: r.updatedAt, groupId: g.id, groupName: g.name, kind: "cancelled", text: `Request to ${name(r.memberId)} cancelled` });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
