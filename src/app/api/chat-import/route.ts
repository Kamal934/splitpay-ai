import { parseChat } from "@/lib/ai";
import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { checkAiLimit } from "@/lib/ratelimit";

export const maxDuration = 120;

/** Reads a pasted group chat and returns candidate expenses for review. Saves nothing. */
export async function POST(req: Request) {
  try {
    checkAiLimit(req);
    const { groupId, text } = (await req.json()) as { groupId: string; text: string };
    if (!text?.trim()) throw new Error("Paste some chat messages first");
    if (text.length > 20000) throw new Error("That's a long chat. Paste up to about 20,000 characters at a time.");
    const g = await getGroup(groupId);
    if (!g) throw new Error("Group not found");
    const out = await parseChat(text, g.members, g.currency);
    // Keep only member IDs that exist, so a bad ID can't slip into the ledger.
    const valid = new Set(g.members.map((m) => m.id));
    for (const e of out.expenses) {
      if (!valid.has(e.paid_by_member_id)) e.paid_by_member_id = "";
      const keep = e.shared_with_member_ids.map((id, i) => [id, e.weights[i] ?? 1] as const).filter(([id]) => valid.has(id));
      e.shared_with_member_ids = keep.map(([id]) => id);
      e.weights = keep.map(([, w]) => (w > 0 ? w : 1));
    }
    return ok(out);
  } catch (e) {
    return fail(e);
  }
}
