import { createGroup, listGroups, newId } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import type { Group } from "@/lib/types";

export async function GET() {
  return ok(await listGroups());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name: string; currency?: string; members: { name: string; email: string }[] };
    const members = (body.members || []).filter((m) => m.name?.trim() && m.email?.trim());
    if (!body.name?.trim()) throw new Error("Give the group a name");
    if (members.length < 2) throw new Error("Add at least 2 people (you + 1 friend)");
    const group: Group = {
      id: newId("grp"),
      name: body.name.trim(),
      currency: (body.currency || "USD").toUpperCase(),
      members: members.map((m, i) => ({ id: newId("mem"), name: m.name.trim(), email: m.email.trim(), isOrganizer: i === 0 })),
      expenses: [],
      requests: [],
      createdAt: new Date().toISOString(),
    };
    return ok(await createGroup(group), 201);
  } catch (e) {
    return fail(e);
  }
}
