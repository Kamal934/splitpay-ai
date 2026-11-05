import { allocate } from "./money";
import type { ExpenseItem, ExpenseShare, Member } from "./types";

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
  modes: { tax: "proportional" | "equal"; tip: "proportional" | "equal" },
  members: Member[],
): { items: ExpenseItem[]; shares: ExpenseShare[] } {
  const valid = new Set(members.map((m) => m.id));
  const everyone = members.map((m) => m.id);
  const perMember = new Map<string, number>(everyone.map((id) => [id, 0]));

  const outItems: ExpenseItem[] = items.map((it, i) => {
    const p = plan.find((x) => x.index === i);
    let ids = (p?.member_ids ?? []).filter((id) => valid.has(id));
    let weights = p?.weights ?? [];
    if (ids.length === 0) {
      ids = everyone;
      weights = [];
    }
    const w = ids.map((_, k) => (weights[k] && weights[k] > 0 ? weights[k] : 1));
    allocate(it.cents, w).forEach((c, k) => perMember.set(ids[k], (perMember.get(ids[k]) ?? 0) + c));
    return { name: it.name, cents: it.cents, memberIds: ids };
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
