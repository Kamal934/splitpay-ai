import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { addExpense, audit, deleteExpense, type NewExpense } from "@/lib/service";

/** Add one expense (body = NewExpense) or several at once (body = { expenses: NewExpense[] }). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const body = (await req.json()) as NewExpense | { expenses: NewExpense[] };
    if ("expenses" in body) {
      if (!body.expenses.length) throw new Error("Nothing to add");
      for (const e of body.expenses) await addExpense(id, e);
      await audit(id, "you", [{ kind: "expense", detail: `Imported ${body.expenses.length} expense${body.expenses.length > 1 ? "s" : ""} from a group chat`, ok: true }]);
      return ok(await getGroup(id));
    }
    return ok(await addExpense(id, body));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const expenseId = new URL(req.url).searchParams.get("expenseId");
    if (!expenseId) throw new Error("expenseId required");
    return ok(await deleteExpense((await params).id, expenseId));
  } catch (e) {
    return fail(e);
  }
}
