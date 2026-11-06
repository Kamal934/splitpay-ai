import { findByToken, memberView } from "@/lib/access";
import { fail, ok } from "@/lib/http";
import { refreshStatuses } from "@/lib/service";

/** A member's private view of their group: every receipt, their share of each, and their PayPal requests. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const found = await findByToken((await params).token);
  if (!found) return fail("This link isn't valid any more. Ask the organiser for a new one.", 404);
  // ?refresh=1: ask PayPal for the latest status first (e.g. right after paying).
  if (new URL(req.url).searchParams.get("refresh")) {
    try {
      const g = await refreshStatuses(found.group.id);
      return ok(memberView(g, found.member));
    } catch {
      /* fall through with cached statuses */
    }
  }
  return ok(memberView(found.group, found.member));
}
