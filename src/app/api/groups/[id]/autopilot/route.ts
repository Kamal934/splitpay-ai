import { runAutopilot, settingsOf } from "@/lib/autopilot";
import { getGroup, updateGroup } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { audit } from "@/lib/service";
import type { AutopilotSettings } from "@/lib/types";

export const maxDuration = 120;

const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
};

type Body = { action: "save"; settings: Partial<AutopilotSettings> } | { action: "run" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const b = (await req.json()) as Body;
    if (b.action === "save") {
      const before = settingsOf((await getGroup(id))!);
      const s = b.settings;
      const next: AutopilotSettings = {
        ...before,
        enabled: !!s.enabled,
        autoRequest: s.autoRequest ?? before.autoRequest,
        firstAfterMin: clamp(s.firstAfterMin, 1, 30 * 1440, before.firstAfterMin),
        repeatEveryMin: clamp(s.repeatEveryMin, 1, 30 * 1440, before.repeatEveryMin),
        maxReminders: clamp(s.maxReminders, 1, 5, before.maxReminders),
        maxRequestCents: clamp(s.maxRequestCents, 100, 100000, before.maxRequestCents),
      };
      await updateGroup(id, (g) => {
        g.autopilot = next;
      });
      if (before.enabled !== next.enabled) {
        await audit(id, "you", [{ kind: "autopilot", detail: next.enabled ? "Turned autopilot on" : "Turned autopilot off", ok: true }]);
      }
      return ok({ group: await getGroup(id) });
    }
    if (b.action === "run") {
      const run = await runAutopilot(id);
      return ok({ run, group: await getGroup(id) });
    }
    throw new Error("Unknown action");
  } catch (e) {
    return fail(e);
  }
}
