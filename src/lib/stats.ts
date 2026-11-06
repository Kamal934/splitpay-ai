import { computeBalances, fmt } from "./money";
import type { Group } from "./types";
import { PAID_STATUSES } from "./types";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Real numbers only: everything is derived from the ledger and PayPal statuses.
 * Note two separate ideas:
 *  - PayPal collection (collected / pending / notRequested): money moving to the organiser.
 *  - Internal settlement (paybackDue): money the organiser holds that belongs to
 *    members who paid more than their share. That never shows up as "outstanding".
 */
export function groupStats(g: Group) {
  const balances = computeBalances(g);
  const spent = g.expenses.reduce((a, e) => a + e.totalCents, 0);
  const collected = g.requests.filter((r) => PAID_STATUSES.includes(r.status)).reduce((a, r) => a + r.cents, 0);
  const pending = balances.reduce((a, b) => a + b.pendingCents, 0);
  const notRequested = balances.reduce((a, b) => a + b.requestableCents, 0);
  const paybackDue = balances.filter((b) => !b.member.isOrganizer && b.netCents > 0).reduce((a, b) => a + b.netCents, 0);
  return { balances, spent, collected, pending, notRequested, open: pending + notRequested, paybackDue };
}

export type GroupStatus = { key: "new" | "ready" | "collecting" | "payback" | "settled_paypal" | "settled_internal"; label: string; tone: "neutral" | "brand" | "warning" | "success"; hint: string };

/** One status per group, checked in priority order. Purely a reading of groupStats; no maths changes. */
export function groupStatus(g: Group): GroupStatus {
  const s = groupStats(g);
  if (s.spent === 0) return { key: "new", label: "New", tone: "neutral", hint: "No expenses yet" };
  if (s.notRequested > 0) return { key: "ready", label: "Ready to request", tone: "brand", hint: `${fmt(s.notRequested, g.currency)} owed with no PayPal request yet` };
  if (s.pending > 0) return { key: "collecting", label: "Collecting", tone: "warning", hint: `${fmt(s.pending, g.currency)} waiting in PayPal` };
  if (s.paybackDue > 0) return { key: "payback", label: "Payback due", tone: "warning", hint: `${fmt(s.paybackDue, g.currency)} to pay back to members who paid more than their share` };
  if (s.collected > 0) return { key: "settled_paypal", label: "Settled", tone: "success", hint: `Everyone has paid. ${fmt(s.collected, g.currency)} collected through PayPal` };
  return { key: "settled_internal", label: "Nothing owed", tone: "success", hint: "Every expense is covered by the person who paid it, so nobody owes anything" };
}

export type ActivityKind = "receipt" | "expense" | "request" | "paid" | "cancelled" | "failed" | "reminder" | "autopilot";
export type Activity = { at: string; groupId: string; groupName: string; text: string; detail?: string; kind: ActivityKind };

/** Real events only, from the ledger, PayPal request statuses and the audit log. */
export function recentActivity(groups: Group[], limit = 10): Activity[] {
  const out: Activity[] = [];
  for (const g of groups) {
    const name = (id: string) => g.members.find((m) => m.id === id)?.name ?? "Someone";
    const base = { groupId: g.id, groupName: g.name };
    for (const e of g.expenses) {
      const amount = fmt(e.totalCents, g.currency);
      out.push(
        e.source === "receipt"
          ? { ...base, at: e.createdAt, kind: "receipt", text: `Receipt scanned and split: ${e.description}`, detail: `${amount} paid by ${name(e.paidBy)} · ${plural(e.shares.length, "person", "people")}` }
          : { ...base, at: e.createdAt, kind: "expense", text: `Expense added: ${e.description}`, detail: `${amount} paid by ${name(e.paidBy)}` },
      );
    }
    for (const r of g.requests) {
      const amount = fmt(r.cents, g.currency);
      if (r.status === "ERROR") {
        out.push({ ...base, at: r.createdAt, kind: "failed", text: `PayPal request to ${name(r.memberId)} failed`, detail: amount });
        continue;
      }
      out.push({ ...base, at: r.createdAt, kind: "request", text: `PayPal invoice sent to ${name(r.memberId)}`, detail: r.label ? `${amount} · ${r.label}` : amount });
      if (PAID_STATUSES.includes(r.status)) out.push({ ...base, at: r.updatedAt, kind: "paid", text: `Payment received from ${name(r.memberId)}`, detail: `${amount} via PayPal` });
      if (r.status === "CANCELLED") out.push({ ...base, at: r.updatedAt, kind: "cancelled", text: `Request to ${name(r.memberId)} cancelled`, detail: amount });
    }
    // Reminders and autopilot hand-offs are only recorded in the audit log.
    for (const a of g.audit ?? []) {
      if (a.kind === "reminder" && a.ok) out.push({ ...base, at: a.at, kind: "reminder", text: a.detail.split(":")[0], detail: a.actor === "autopilot" ? "Sent by autopilot" : undefined });
      if (a.kind === "handoff") out.push({ ...base, at: a.at, kind: "autopilot", text: a.detail });
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
