import { getGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { audit, cancelRequest, refreshStatuses, remind, requestPayments, type ActionLog } from "@/lib/service";

export const maxDuration = 60;

type Body =
  | { action: "send"; memberIds?: string[]; note?: string }
  | { action: "refresh" }
  | { action: "remind"; requestId: string; note?: string }
  | { action: "cancel"; requestId: string; reason?: string };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const b = (await req.json()) as Body;
    const log: ActionLog[] = [];
    if (b.action === "send") await requestPayments(id, b.memberIds, b.note || "Your share from SplitPay. Thanks!", log);
    else if (b.action === "refresh") await refreshStatuses(id, log);
    else if (b.action === "remind") await remind(id, b.requestId, b.note || "Just a friendly nudge about your share. Thanks!", log);
    else if (b.action === "cancel") await cancelRequest(id, b.requestId, b.reason || "Cancelled by organiser", log);
    else throw new Error("Unknown action");
    await audit(id, "you", log);
    return ok({ group: await getGroup(id), log });
  } catch (e) {
    return fail(e);
  }
}
