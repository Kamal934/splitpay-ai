import { fail, ok } from "@/lib/http";
import { addExpense, deleteExpense, type NewExpense } from "@/lib/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return ok(await addExpense((await params).id, (await req.json()) as NewExpense));
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
