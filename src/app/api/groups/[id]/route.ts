import { getGroup, updateGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await getGroup((await params).id);
  return g ? ok(g) : fail("Group not found", 404);
}

/** Edit member names / emails (e.g. point them at PayPal sandbox buyer accounts). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { members } = (await req.json()) as { members: { id: string; name: string; email: string }[] };
    const g = await updateGroup((await params).id, (g) => {
      for (const m of members) {
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
