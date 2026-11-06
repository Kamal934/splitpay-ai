import { findByToken, memberView } from "@/lib/access";
import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { audit, requestForExpense, requestPayments, type ActionLog } from "@/lib/service";

export const maxDuration = 60;

/**
 * A member creates their own PayPal request:
 *   { expenseId } → pay their share of one receipt
 *   { all: true } → pay everything they currently owe in one invoice
 * Amounts always come from the ledger; nothing can be asked for twice.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const found = await findByToken((await params).token);
    if (!found) return fail("This link isn't valid any more.", 404);
    const { expenseId, all } = (await req.json()) as { expenseId?: string; all?: boolean };
    const log: ActionLog[] = [];
    if (expenseId) {
      await requestForExpense(found.group.id, found.member.id, expenseId, log);
    } else if (all) {
      const created = await requestPayments(found.group.id, [found.member.id], `Your share for ${found.group.name}. Thanks!`, log);
      if (!created.length) throw new Error("There's nothing left to request. Everything is already covered.");
      const failed = created.find((r) => r.status === "ERROR");
      if (failed) throw new Error(failed.error ?? "PayPal couldn't create the request.");
      log[log.length - 1] = { ...log[log.length - 1], detail: `${found.member.name} chose to pay everything at once through PayPal` };
    } else throw new Error("Choose a receipt or Pay all");
    await audit(found.group.id, "member", log);
    const g = (await getGroup(found.group.id))!;
    return ok(memberView(g, g.members.find((m) => m.id === found.member.id)!));
  } catch (e) {
    return fail(e);
  }
}
