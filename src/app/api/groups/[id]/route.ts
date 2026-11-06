import { deleteGroup, getGroup, newId, updateGroup } from "@/lib/db";
import { ensureTokens, withTokens } from "@/lib/access";
import { fail, ok } from "@/lib/http";
import { memberProblems, type MemberInput } from "@/lib/members";
import { cancelInvoice } from "@/lib/paypal";
import { audit } from "@/lib/service";
import { OPEN_STATUSES } from "@/lib/types";
import { expenseLock, resplitWithNewMembers } from "@/lib/split";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await getGroup((await params).id);
  return g ? ok(await withTokens(g)) : fail("Group not found", 404);
}

/** Edit member names / emails, or add new members (rows without an id). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { members, includeIn = [] } = (await req.json()) as { members: MemberInput[]; includeIn?: string[] };
    const id = (await params).id;
    const log: { kind: string; detail: string; ok: boolean }[] = [];
    const g = await updateGroup(id, (g) => {
      const oldMembers = g.members.map((m) => ({ ...m }));
      // Build the resulting member list first and validate it as a whole.
      const next = g.members.map((x) => {
        const m = members.find((y) => y.id === x.id);
        return { ...x, name: m?.name.trim() || x.name, email: m?.email.trim() || x.email };
      });
      for (const m of members.filter((y) => !y.id)) {
        next.push({ id: newId("mem"), name: m.name.trim(), email: m.email.trim(), isOrganizer: false });
      }
      const problems = memberProblems(next);
      if (problems.length) throw new Error(problems[0]);

      // Optionally re-split chosen existing expenses to include the new people.
      const added = next.filter((m) => !oldMembers.some((o) => o.id === m.id));
      if (includeIn.length && !added.length) throw new Error("Add a new person first");
      for (const expenseId of includeIn) {
        const e = g.expenses.find((x) => x.id === expenseId);
        if (!e) throw new Error("Expense not found");
        const lock = expenseLock(g, e);
        if (lock) throw new Error(`Can't change “${e.description}”: ${lock.charAt(0).toLowerCase() + lock.slice(1)}.`);
        const r = resplitWithNewMembers(e, oldMembers, added);
        if (!r.ok) throw new Error(`Can't re-split “${e.description}”: ${r.reason.charAt(0).toLowerCase() + r.reason.slice(1)}.`);
        e.items = r.items;
        e.shares = r.shares;
        e.modes = r.modes;
        log.push({ kind: "expense", detail: `Re-split “${e.description}” to include ${added.map((m) => m.name).join(", ")}`, ok: true });
      }
      if (added.length) log.unshift({ kind: "member", detail: `Added ${added.map((m) => m.name).join(", ")} to the group`, ok: true });
      g.members = next;
      ensureTokens(g);
    });
    await audit(id, "you", log);
    return ok((await getGroup(id)) ?? g);
  } catch (e) {
    return fail(e);
  }
}

/**
 * Delete a group. Any PayPal invoices still open are cancelled first, so friends
 * can't pay into a group that no longer exists. Body: { confirmName } must match the group name.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const g = await getGroup(id);
    if (!g) return fail("Group not found", 404);
    const { confirmName } = (await req.json().catch(() => ({}))) as { confirmName?: string };
    if ((confirmName ?? "").trim() !== g.name.trim()) throw new Error("Type the group name exactly to confirm.");

    const open = g.requests.filter((r) => r.invoiceId && OPEN_STATUSES.includes(r.status));
    const failed: string[] = [];
    for (const r of open) {
      try {
        await cancelInvoice(r.invoiceId!, `The group "${g.name}" was closed by the organiser, so this request has been cancelled.`);
      } catch {
        failed.push(g.members.find((m) => m.id === r.memberId)?.name ?? r.memberId);
      }
    }
    if (failed.length) throw new Error(`Couldn't cancel the PayPal invoice for ${failed.join(", ")}. Try again, or cancel it in the Payments table first.`);
    await deleteGroup(id);
    return ok({ deleted: true, cancelledInvoices: open.length });
  } catch (e) {
    return fail(e);
  }
}
