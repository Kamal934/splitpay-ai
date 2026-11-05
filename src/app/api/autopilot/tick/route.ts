import { tickAll } from "@/lib/autopilot";
import { fail, ok } from "@/lib/http";

export const maxDuration = 300;

/**
 * External cron hook (e.g. a Render Cron Job) for hosts that don't keep a long-running process.
 * Protected by CRON_SECRET when it's set: send `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Unauthorized", 401);
  try {
    await tickAll();
    return ok({ ok: true });
  } catch (e) {
    return fail(e, 500);
  }
}
