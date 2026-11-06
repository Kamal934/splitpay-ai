import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { claude, FALLBACK, MODEL } from "./ai";
import { runAutopilot, settingsOf } from "./autopilot";
import { getGroup, updateGroup } from "./db";
import { computeBalances, fmt, simplifyDebts, toCents } from "./money";
import { addExpense, cancelRequest, MAX_REQUEST_CENTS, refreshStatuses, remind, requestPayments, type ActionLog } from "./service";

export type ChatTurn = { role: "user" | "assistant"; text: string };

async function summary(groupId: string) {
  const g = await getGroup(groupId);
  if (!g) throw new Error("Group not found");
  const b = computeBalances(g);
  const name = (id: string) => g.members.find((m) => m.id === id)?.name ?? id;
  return {
    group: g.name,
    currency: g.currency,
    members: g.members.map((m) => ({ id: m.id, name: m.name, email: m.email, organiser: m.isOrganizer })),
    balances: b.map((x) => ({
      member_id: x.member.id,
      name: x.member.name,
      net: fmt(x.netCents, g.currency),
      owes_organiser_unrequested: fmt(x.requestableCents, g.currency),
      pending_paypal_requests: fmt(x.pendingCents, g.currency),
    })),
    suggested_transfers: simplifyDebts(b).map((t) => `${t.from.name} -> ${t.to.name}: ${fmt(t.cents, g.currency)}`),
    expenses: g.expenses.map((e) => ({
      description: e.description,
      added: e.createdAt,
      total: fmt(e.totalCents, g.currency),
      paid_by: name(e.paidBy),
      how_it_was_split: e.aiExplanation || e.splitInstruction || "Split equally",
      shares: e.shares.map((x) => `${name(x.memberId)} ${fmt(x.cents, g.currency)}`),
    })),
    paypal_requests: g.requests.map((r) => ({
      request_id: r.id,
      member: name(r.memberId),
      amount: fmt(r.cents, g.currency),
      status: r.status,
      invoice_id: r.invoiceId,
      reminders_sent: r.remindersSent,
      error: r.error,
    })),
    autopilot: (() => {
      const s = settingsOf(g);
      return {
        enabled: s.enabled,
        auto_request: s.autoRequest,
        first_reminder_after_minutes: s.firstAfterMin,
        repeat_every_minutes: s.repeatEveryMin,
        max_reminders: s.maxReminders,
        last_run: s.lastRunAt,
        last_summary: s.lastSummary,
      };
    })(),
  };
}

function tools(groupId: string, log: ActionLog[]) {
  return [
    betaZodTool({
      name: "get_group_summary",
      description:
        "Get the group's members (with IDs), balances, suggested transfers, expenses and every PayPal payment request with its status. Call this first.",
      inputSchema: z.object({}),
      run: async () => JSON.stringify(await summary(groupId)),
    }),
    betaZodTool({
      name: "refresh_payment_status",
      description: "Ask PayPal for the latest status of every open payment request (e.g. to see who has paid).",
      inputSchema: z.object({}),
      run: async () => {
        await refreshStatuses(groupId, log);
        return JSON.stringify((await summary(groupId)).paypal_requests);
      },
    }),
    betaZodTool({
      name: "request_payments",
      description:
        "Create and send PayPal invoices to members for what they currently owe the organiser. Amounts are taken from the ledger, you cannot set them. " +
        `Requests over ${MAX_REQUEST_CENTS / 100} are blocked. Leave member_ids empty to request from everyone who owes.`,
      inputSchema: z.object({
        member_ids: z.array(z.string()).describe("Member IDs to request from; empty array = everyone who owes"),
        note: z.string().describe("Short friendly note shown on the PayPal invoice"),
      }),
      run: async ({ member_ids, note }) => {
        const out = await requestPayments(groupId, member_ids, note, log);
        if (out.length === 0) return "Nobody currently owes anything that hasn't already been requested.";
        return JSON.stringify(out.map((r) => ({ member_id: r.memberId, cents: r.cents, status: r.status, error: r.error })));
      },
    }),
    betaZodTool({
      name: "send_reminder",
      description: "Send a PayPal reminder email for one open payment request.",
      inputSchema: z.object({
        request_id: z.string(),
        note: z.string().describe("Warm, short, non-pushy reminder message"),
      }),
      run: async ({ request_id, note }) => {
        await remind(groupId, request_id, note, log);
        return "Reminder sent.";
      },
    }),
    betaZodTool({
      name: "cancel_request",
      description: "Cancel a sent PayPal payment request (e.g. if it was wrong or they paid in cash). Only do this when the user explicitly asks.",
      inputSchema: z.object({ request_id: z.string(), reason: z.string() }),
      run: async ({ request_id, reason }) => {
        await cancelRequest(groupId, request_id, reason, log);
        return "Cancelled.";
      },
    }),
    betaZodTool({
      name: "add_expense",
      description:
        "Record a new shared expense the user describes in chat (e.g. 'I paid 60 for the cab, split with Raj and Priya').",
      inputSchema: z.object({
        description: z.string(),
        amount: z.number().describe("Total amount paid"),
        paid_by_member_id: z.string(),
        member_ids: z.array(z.string()).describe("Who shares it; empty = everyone"),
        weights: z.array(z.number()).describe("Relative shares in the same order as member_ids; empty = equal"),
      }),
      run: async (i) => {
        const g = await getGroup(groupId);
        const ids = i.member_ids.length ? i.member_ids : g!.members.map((m) => m.id);
        await addExpense(groupId, {
          description: i.description,
          paidBy: i.paid_by_member_id,
          items: [{ name: i.description, cents: toCents(i.amount) }],
          plan: [{ index: 0, member_ids: ids, weights: i.weights.length ? i.weights : ids.map(() => 1) }],
          taxCents: 0,
          tipCents: 0,
          modes: { tax: "proportional", tip: "proportional" },
          source: "manual",
          splitInstruction: "Added by SplitPay agent",
        });
        log.push({ kind: "expense", detail: `Added "${i.description}" (${i.amount})`, ok: true });
        return "Expense added.";
      },
    }),
    betaZodTool({
      name: "configure_autopilot",
      description:
        "Turn autopilot collection on or off and set its rules. Autopilot runs on a schedule: it syncs PayPal, sends requests for anything owed, " +
        "and sends reminders spaced by the rules until the reminder limit, then hands back to the organiser. Only change it when the user asks.",
      inputSchema: z.object({
        enabled: z.boolean(),
        first_reminder_after_minutes: z.number().describe("Minutes after a request before the first reminder (1440 = 1 day)"),
        repeat_every_minutes: z.number().describe("Minutes between later reminders"),
        max_reminders: z.number().describe("1 to 5"),
        auto_request: z.boolean().describe("Also send PayPal requests automatically for anything owed"),
      }),
      run: async (i) => {
        const g = await getGroup(groupId);
        const before = settingsOf(g!);
        await updateGroup(groupId, (gg) => {
          gg.autopilot = {
            ...before,
            enabled: i.enabled,
            autoRequest: i.auto_request,
            firstAfterMin: Math.max(1, Math.round(i.first_reminder_after_minutes)),
            repeatEveryMin: Math.max(1, Math.round(i.repeat_every_minutes)),
            maxReminders: Math.min(5, Math.max(1, Math.round(i.max_reminders))),
          };
        });
        log.push({ kind: "autopilot", detail: i.enabled ? `Autopilot on: first reminder after ${i.first_reminder_after_minutes} min, then every ${i.repeat_every_minutes} min, max ${i.max_reminders}` : "Autopilot off", ok: true });
        return "Saved.";
      },
    }),
    betaZodTool({
      name: "run_autopilot_now",
      description: "Run one autopilot pass immediately (sync PayPal, send due requests and reminders under the current rules) and report what it did.",
      inputSchema: z.object({}),
      run: async () => {
        const r = await runAutopilot(groupId);
        log.push(...r.log);
        return r.summary;
      },
    }),
  ];
}

const SYSTEM = `You are SplitPay, a friendly money assistant for a group of friends sharing expenses.
You help the organiser see who owes what, add expenses, and collect money through PayPal.
- Start by calling get_group_summary so you work from real data. Never invent amounts, names or statuses.
- Sending, reminding and cancelling PayPal requests moves real (sandbox) money. Do it when the user asks for it.
  If the user only asks a question, answer it and offer the action instead of taking it.
- Before reminding someone, refresh_payment_status so you don't nag people who already paid.
- Refer to people by name (or "they"), never guess gendered pronouns.
- Keep replies short and warm, use names, show amounts with currency. Use simple bullet lists for breakdowns.`;

export async function runAgent(groupId: string, history: ChatTurn[]) {
  const log: ActionLog[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));
  const final = await claude().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium" },
    system: SYSTEM,
    tools: tools(groupId, log),
    messages,
  });
  const text =
    final.stop_reason === "refusal"
      ? "Sorry, I can't help with that one."
      : final.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
  return { reply: text || "Done.", actions: log };
}
