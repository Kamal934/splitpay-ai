import { findByToken, memberView } from "@/lib/access";
import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { addExpense, audit, type NewExpense } from "@/lib/service";

/**
 * A member adds a bill *they* paid. The payer is always the member who owns the link,
 * whatever the request body says.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const found = await findByToken((await params).token);
    if (!found) return fail("This link isn't valid any more.", 404);
    const body = (await req.json()) as NewExpense;
    await addExpense(found.group.id, { ...body, paidBy: found.member.id });
    await audit(found.group.id, "member", [{ kind: "expense", detail: `${found.member.name} added “${body.description}” that they paid for`, ok: true }]);
    const g = (await getGroup(found.group.id))!;
    return ok(memberView(g, g.members.find((m) => m.id === found.member.id)!));
  } catch (e) {
    return fail(e);
  }
}
