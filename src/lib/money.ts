import type { Group, Member } from "./types";
import { OPEN_STATUSES, PAID_STATUSES } from "./types";

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

export function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

/**
 * Split `total` cents across weights so the parts always sum exactly to `total`
 * (largest-remainder method — no lost or phantom pennies).
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i] += 1;
    rest -= 1;
  }
  return floors;
}

export type Balance = {
  member: Member;
  /** + means the group owes them, - means they owe. Already nets out paid PayPal requests. */
  netCents: number;
  paidCents: number;
  shareCents: number;
  /** Open (unpaid) PayPal requests already sent to this member. */
  pendingCents: number;
  /** What a new PayPal request to this member should be for (never negative). */
  requestableCents: number;
};

/**
 * Hub model: the organiser fronts the money and collects from everyone through PayPal invoices.
 * A member's net = what they paid - what they owe + PayPal payments they've already made to the organiser.
 */
export function computeBalances(group: Group): Balance[] {
  const organizer = group.members.find((m) => m.isOrganizer);
  return group.members.map((member) => {
    let paid = 0;
    let share = 0;
    for (const e of group.expenses) {
      if (e.paidBy === member.id) paid += e.totalCents;
      share += e.shares.find((s) => s.memberId === member.id)?.cents ?? 0;
    }
    let settled = 0;
    let pending = 0;
    for (const r of group.requests) {
      if (PAID_STATUSES.includes(r.status)) {
        if (r.memberId === member.id) settled += r.cents; // they paid the organiser
        if (organizer && member.id === organizer.id) settled -= r.cents; // organiser received it
      } else if (OPEN_STATUSES.includes(r.status) && r.memberId === member.id) {
        pending += r.cents;
      }
    }
    const net = paid - share + settled;
    const requestable = member.isOrganizer ? 0 : Math.max(0, -net - pending);
    return { member, netCents: net, paidCents: paid, shareCents: share, pendingCents: pending, requestableCents: requestable };
  });
}

export type Transfer = { from: Member; to: Member; cents: number };

/** Minimum set of transfers that settles everyone (greedy: largest debtor pays largest creditor). */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const debtors = balances.filter((b) => b.netCents < 0).map((b) => ({ m: b.member, c: -b.netCents }));
  const creditors = balances.filter((b) => b.netCents > 0).map((b) => ({ m: b.member, c: b.netCents }));
  debtors.sort((a, b) => b.c - a.c);
  creditors.sort((a, b) => b.c - a.c);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    if (amt > 0) out.push({ from: debtors[i].m, to: creditors[j].m, cents: amt });
    debtors[i].c -= amt;
    creditors[j].c -= amt;
    if (debtors[i].c === 0) i++;
    if (creditors[j].c === 0) j++;
  }
  return out;
}

/** "Raj Mehta" -> "RM", "You (Organiser)" -> "YO". Letters only. */
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return (words.map((w) => w[0]).join("").slice(0, 2) || "?").toUpperCase();
}
