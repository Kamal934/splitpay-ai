import { planSplit } from "@/lib/ai";
import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { checkAiLimit } from "@/lib/ratelimit";
import { toCents } from "@/lib/money";
import { computeShares } from "@/lib/split";

export const maxDuration = 120;

/** The AI decides who shares what; computeShares does the exact cents. */
export async function POST(req: Request) {
  try {
    checkAiLimit(req);
    const b = (await req.json()) as {
      groupId: string;
      paidBy: string;
      instruction: string;
      items: { name: string; amount: number }[];
      tax: number;
      tip: number;
    };
    const g = await getGroup(b.groupId);
    if (!g) throw new Error("Group not found");
    if (!b.items?.length) throw new Error("No items to split");
    const payer = g.members.find((m) => m.id === b.paidBy)?.name ?? "the organiser";
    const plan = await planSplit(b.items, g.members, b.instruction, payer);
    const cents = b.items.map((i) => ({ name: i.name, cents: toCents(i.amount) }));
    const preview = computeShares(cents, plan.items, toCents(b.tax), toCents(b.tip), { tax: plan.tax_mode, tip: plan.tip_mode }, g.members);
    return ok({ plan, preview });
  } catch (e) {
    return fail(e);
  }
}
