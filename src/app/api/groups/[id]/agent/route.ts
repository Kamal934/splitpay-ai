import { runAgent, type ChatTurn } from "@/lib/agent";
import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { audit } from "@/lib/service";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const { history } = (await req.json()) as { history: ChatTurn[] };
    const clean = (history || []).filter((t) => t.text?.trim()).slice(-20);
    if (!clean.length || clean[clean.length - 1].role !== "user") throw new Error("Send a message");
    while (clean[0]?.role !== "user") clean.shift();
    const out = await runAgent(id, clean);
    await audit(id, "agent", out.actions);
    return ok({ ...out, group: await getGroup(id) });
  } catch (e) {
    return fail(e, 500);
  }
}
