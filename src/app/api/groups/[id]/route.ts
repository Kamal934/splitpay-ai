import { getGroup, newId, updateGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { memberProblems, type MemberInput } from "@/lib/members";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await getGroup((await params).id);
  return g ? ok(g) : fail("Group not found", 404);
}

/** Edit member names / emails, or add new members (rows without an id). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { members } = (await req.json()) as { members: MemberInput[] };
    const g = await updateGroup((await params).id, (g) => {
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
      g.members = next;
    });
    return ok(g);
  } catch (e) {
    return fail(e);
  }
}
