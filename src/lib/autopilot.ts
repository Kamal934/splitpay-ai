import "server-only";
import { writeReminder } from "./ai";
import { getGroup, listGroups, updateGroup } from "./db";
import { fmt } from "./money";
import { audit, refreshStatuses, remind, requestPayments, type ActionLog } from "./service";
import type { AutopilotSettings, Group } from "./types";
import { OPEN_STATUSES, PAID_STATUSES } from "./types";

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  autoRequest: true,
  firstAfterMin: 2 * 24 * 60,
  repeatEveryMin: 2 * 24 * 60,
  maxReminders: 3,
  maxRequestCents: 50000,
};

export function settingsOf(g: Group): AutopilotSettings {
  return { ...DEFAULT_AUTOPILOT, ...(g.autopilot ?? {}) };
}

/** How often a group gets checked: often enough for its fastest rule, never more than every 15 minutes. */
export function checkEveryMin(s: AutopilotSettings) {
  return Math.max(1, Math.min(15, Math.floor(Math.min(s.firstAfterMin, s.repeatEveryMin) / 2)));
}

const minutesSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60000;

const running = new Set<string>();

export type AutopilotRun = { ran: boolean; summary: string; log: ActionLog[] };

/**
 * One autopilot pass over a group. The rules decide what happens; Claude only
 * writes the wording of reminders. Amounts always come from the ledger.
 *   1. Sync every open invoice with PayPal (so nobody who paid gets nagged).
 *   2. If enabled, send PayPal requests for anything owed but not requested.
 *   3. Remind people whose invoice is due a reminder under the rules.
 *   4. Once someone hits the reminder limit, stop and hand it back to the organiser.
 */
export async function runAutopilot(groupId: string): Promise<AutopilotRun> {
  if (running.has(groupId)) return { ran: false, summary: "Autopilot is already running for this group.", log: [] };
  running.add(groupId);
  const log: ActionLog[] = [];
  try {
    const start = await getGroup(groupId);
    if (!start) throw new Error("Group not found");
    const s = settingsOf(start);
    const organiser = start.members.find((m) => m.isOrganizer)?.name ?? "the organiser";
    const paidBefore = new Set(start.requests.filter((r) => PAID_STATUSES.includes(r.status)).map((r) => r.id));

    // 1. Sync with PayPal
    let g = await refreshStatuses(groupId, log);
    const newlyPaid = g.requests.filter((r) => PAID_STATUSES.includes(r.status) && !paidBefore.has(r.id)).length;

    // 2. Request anything outstanding
    let requested = 0;
    if (s.autoRequest) {
      const created = await requestPayments(groupId, undefined, `Your share for ${g.name}, sent automatically by SplitPay on behalf of ${organiser}.`, log, s.maxRequestCents);
      requested = created.filter((r) => r.status === "SENT").length;
      g = (await getGroup(groupId))!;
    }

    // 3 + 4. Reminders under the rules
    let reminded = 0;
    const handedBack: string[] = [];
    for (const r of g.requests) {
      if (!r.invoiceId || !OPEN_STATUSES.includes(r.status)) continue;
      const m = g.members.find((x) => x.id === r.memberId);
      if (!m) continue;
      if (r.remindersSent >= s.maxReminders) {
        if (!r.escalated) {
          handedBack.push(m.name);
          await updateGroup(groupId, (gg) => {
            const x = gg.requests.find((y) => y.id === r.id);
            if (x) x.escalated = true;
          });
          log.push({ kind: "handoff", detail: `${m.name} hasn't paid after ${s.maxReminders} reminders, so autopilot stopped and handed it back to you`, ok: true });
        }
        continue;
      }
      if (s.remind === false) continue;
      const wait = r.remindersSent === 0 ? s.firstAfterMin : s.repeatEveryMin;
      const since = minutesSince(r.lastReminderAt ?? r.createdAt);
      if (since < wait - 0.25) continue;
      try {
        const copy = await writeReminder({
          name: m.name,
          amount: fmt(r.cents, g.currency),
          groupName: g.name,
          attempt: r.remindersSent + 1,
          maxAttempts: s.maxReminders,
          organiser,
          daysOpen: minutesSince(r.createdAt) / 1440,
        });
        await remind(groupId, r.id, copy.note, log, copy.subject);
        const last = log[log.length - 1];
        if (last?.kind === "reminder") last.detail = `Reminder ${r.remindersSent + 1} of ${s.maxReminders} to ${m.name}: “${copy.note}”`;
        reminded++;
      } catch (e) {
        log.push({ kind: "reminder", detail: `Couldn't remind ${m.name}: ${(e as Error).message}`, ok: false });
      }
    }

    const final = (await getGroup(groupId))!;
    const open = final.requests.filter((r) => OPEN_STATUSES.includes(r.status));
    const openCents = open.reduce((a, r) => a + r.cents, 0);
    const parts = [
      newlyPaid ? `${newlyPaid} new payment${newlyPaid > 1 ? "s" : ""} received` : null,
      requested ? `${requested} request${requested > 1 ? "s" : ""} sent` : null,
      reminded ? `${reminded} reminder${reminded > 1 ? "s" : ""} sent` : null,
      handedBack.length ? `${handedBack.join(", ")} handed back to you` : null,
    ].filter(Boolean);
    const summary =
      (parts.length ? parts.join(" · ") : "Checked PayPal, nothing needed doing") +
      (open.length ? `. ${fmt(openCents, final.currency)} still open across ${open.length} invoice${open.length > 1 ? "s" : ""}.` : ". Everyone has paid.");

    await updateGroup(groupId, (gg) => {
      gg.autopilot = { ...settingsOf(gg), lastRunAt: new Date().toISOString(), lastSummary: summary };
    });
    // Quiet passes only update lastSummary; the audit log records real actions.
    await audit(groupId, "autopilot", log);
    return { ran: true, summary, log };
  } finally {
    running.delete(groupId);
  }
}

/** Called by the scheduler: run every enabled group that's due a check. */
export async function tickAll() {
  const groups = await listGroups();
  for (const g of groups) {
    const s = settingsOf(g);
    if (!s.enabled) continue;
    // Small allowance so scheduler jitter doesn't skip a whole interval.
    if (s.lastRunAt && minutesSince(s.lastRunAt) < checkEveryMin(s) - 0.25) continue;
    try {
      await runAutopilot(g.id);
    } catch (e) {
      console.error("[autopilot]", g.id, (e as Error).message);
    }
  }
}
