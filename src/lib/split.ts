import { allocate } from "./money";
import type { Expense, ExpenseItem, ExpenseShare, Group, Member, SplitModes } from "./types";

export type PlanItem = { index: number; member_ids: string[]; weights: number[] };

/**
 * Deterministic money math. The AI only decides *who* shares *what*;
 * this function turns that into exact cents that always add up to the total.
 */
export function computeShares(
  items: { name: string; cents: number }[],
  plan: PlanItem[],
  taxCents: number,
  tipCents: number,
  modes: SplitModes,
  members: Member[],
): { items: ExpenseItem[]; shares: ExpenseShare[] } {
  const valid = new Set(members.map((m) => m.id));
  const everyone = members.map((m) => m.id);
  const perMember = new Map<string, number>(everyone.map((id) => [id, 0]));

  const outItems: ExpenseItem[] = items.map((it, i) => {
    const p = plan.find((x) => x.index === i);
    const pairs = (p?.member_ids ?? []).map((id, k) => [id, p?.weights?.[k]] as const).filter(([id]) => valid.has(id));
    let ids = pairs.map(([id]) => id);
    let weights = pairs.map(([, w]) => w);
    if (ids.length === 0) {
      ids = everyone;
      weights = [];
    }
    const w = ids.map((_, k) => (weights[k] && weights[k]! > 0 ? weights[k]! : 1));
    allocate(it.cents, w).forEach((c, k) => perMember.set(ids[k], (perMember.get(ids[k]) ?? 0) + c));
    return { name: it.name, cents: it.cents, memberIds: ids, weights: w };
  });

  // Item subtotals per person, captured before extras are added.
  const base = everyone.map((id) => perMember.get(id) ?? 0);
  const anyItems = base.some((b) => b > 0);
  for (const [cents, mode] of [
    [taxCents, modes.tax],
    [tipCents, modes.tip],
  ] as const) {
    if (cents === 0) continue;
    const weights = mode === "equal" || !anyItems ? everyone.map(() => 1) : base;
    allocate(cents, weights).forEach((c, k) => perMember.set(everyone[k], (perMember.get(everyone[k]) ?? 0) + c));
  }

  const shares = everyone.map((id) => ({ memberId: id, cents: perMember.get(id) ?? 0 })).filter((s) => s.cents !== 0);
  return { items: outItems, shares };
}

/* ---------- Adding people to existing expenses ---------- */

const ALL_MODES: SplitModes[] = [
  { tax: "proportional", tip: "proportional" },
  { tax: "proportional", tip: "equal" },
  { tax: "equal", tip: "proportional" },
  { tax: "equal", tip: "equal" },
];

const sameShares = (a: ExpenseShare[], b: ExpenseShare[]) => {
  const m = new Map(a.filter((s) => s.cents).map((s) => [s.memberId, s.cents]));
  const n = b.filter((s) => s.cents);
  return m.size === n.length && n.every((s) => m.get(s.memberId) === s.cents);
};

/**
 * An expense is locked once a PayPal request has gone out after it was added:
 * that request's amount included this expense, so re-splitting it would make
 * already-requested (or already-paid) amounts wrong.
 */
export function expenseLock(group: Group, e: Expense): string | null {
  const active = group.requests.filter((r) => r.status !== "CANCELLED" && r.status !== "ERROR" && r.createdAt >= e.createdAt);
  if (!active.length) return null;
  return active.some((r) => r.status === "PAID" || r.status === "MARKED_AS_PAID") ? "Already paid through PayPal" : "Already requested through PayPal";
}

export type Resplit = { ok: true; items: ExpenseItem[]; shares: ExpenseShare[]; modes: SplitModes } | { ok: false; reason: string };

/**
 * Re-splits an existing expense so new people share the items that *everyone*
 * shared. Items only some people had stay as they were. Refuses unless the
 * original shares can be rebuilt exactly first, so nothing is silently changed.
 */
export function resplitWithNewMembers(e: Expense, oldMembers: Member[], newMembers: Member[]): Resplit {
  if (!newMembers.length) return { ok: false, reason: "No new people" };
  const plan: PlanItem[] = e.items.map((it, i) => ({ index: i, member_ids: it.memberIds, weights: it.weights ?? it.memberIds.map(() => 1) }));
  const cents = e.items.map((it) => ({ name: it.name, cents: it.cents }));
  const modes = (e.modes ? [e.modes] : ALL_MODES).find((m) => sameShares(computeShares(cents, plan, e.taxCents, e.tipCents, m, oldMembers).shares, e.shares));
  if (!modes) return { ok: false, reason: "Has custom shares, so edit it by hand" };

  const oldIds = new Set(oldMembers.map((m) => m.id));
  const isEveryone = (ids: string[]) => ids.length === oldIds.size && ids.every((id) => oldIds.has(id));
  if (!e.items.some((it) => isEveryone(it.memberIds))) return { ok: false, reason: "Nothing in it was shared by everyone" };

  const newPlan = plan.map((p, i) =>
    isEveryone(e.items[i].memberIds) ? { ...p, member_ids: [...p.member_ids, ...newMembers.map((m) => m.id)], weights: [...p.weights, ...newMembers.map(() => 1)] } : p,
  );
  const out = computeShares(cents, newPlan, e.taxCents, e.tipCents, modes, [...oldMembers, ...newMembers]);
  return { ok: true, items: out.items, shares: out.shares, modes };
}
