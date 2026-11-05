import { getGroup, newId, updateGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await getGroup((await params).id);
  return g ? ok(g) : fail("Group not found", 404);
}

/** Edit member names / emails, or add new members (rows without an id). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { members } = (await req.json()) as { members: { id?: string; name: string; email: string }[] };
    const g = await updateGroup((await params).id, (g) => {
      for (const m of members) {
        if (!m.id) {
          if (!m.name?.trim() || !m.email?.trim()) throw new Error("New people need a name and an email");
          g.members.push({ id: newId("mem"), name: m.name.trim(), email: m.email.trim(), isOrganizer: false });
          continue;
        }
        const x = g.members.find((y) => y.id === m.id);
        if (x) {
          x.name = m.name.trim() || x.name;
          x.email = m.email.trim() || x.email;
        }
      }
    });
    return ok(g);
  } catch (e) {
    return fail(e);
  }
}
