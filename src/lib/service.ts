import "server-only";
import { getGroup, newId, updateGroup } from "./db";
import { memberLink } from "./access";
import { computeBalances, fmt } from "./money";
import { cancelInvoice, getInvoiceStatus, remindInvoice, sendInvoice } from "./paypal";
import { computeShares } from "./split";
import type { AuditActor, Expense, Group, PaymentRequest } from "./types";
import { OPEN_STATUSES } from "./types";

/** Guardrail: the app (and the agent) can never request more than this from one person in one invoice. */
export const MAX_REQUEST_CENTS = Number(process.env.MAX_REQUEST_CENTS || 100000);

async function mustGroup(id: string): Promise<Group> {
  const g = await getGroup(id);
  if (!g) throw new Error("Group not found");
  return g;
}

export type ActionLog = { kind: string; detail: string; ok: boolean };

/** Append actions to the group's audit trail (newest first, capped). */
export async function audit(groupId: string, actor: AuditActor, log: ActionLog[]) {
  if (!log.length) return;
  const at = new Date().toISOString();
  await updateGroup(groupId, (g) => {
    const entries = log.map((l) => ({ id: newId("aud"), at, actor, kind: l.kind, detail: l.detail, ok: l.ok }));
    g.audit = [...entries.reverse(), ...(g.audit ?? [])].slice(0, 200);
  });
}

/**
 * Lines for an itemised invoice: this member's share of each expense added since their
 * last active request. Returns null when that can't account exactly for the amount
 * (e.g. they also paid a bill), so the caller falls back to one total line.
 */
export function invoiceLines(group: Group, memberId: string, cents: number) {
  const active = group.requests.filter((r) => r.memberId === memberId && r.status !== "CANCELLED" && r.status !== "ERROR");
  const since = active.reduce((a, r) => (r.createdAt > a ? r.createdAt : a), "");
  const exps = group.expenses.filter((e) => e.createdAt > since);
  if (exps.some((e) => e.paidBy === memberId)) return null;
  const lines = exps.map((e) => ({ name: e.description, cents: e.shares.find((s) => s.memberId === memberId)?.cents ?? 0 })).filter((l) => l.cents > 0);
  return lines.reduce((a, l) => a + l.cents, 0) === cents ? lines : null;
}

/** Send PayPal invoices for whatever each member still owes the organiser. Amounts always come from the ledger. */
export async function requestPayments(
  groupId: string,
  memberIds: string[] | undefined,
  note: string,
  log: ActionLog[] = [],
  capCents: number = MAX_REQUEST_CENTS,
) {
  const cap = Math.min(capCents, MAX_REQUEST_CENTS);
  const group = await mustGroup(groupId);
  const balances = computeBalances(group).filter(
    (b) => b.requestableCents > 0 && (!memberIds || memberIds.length === 0 || memberIds.includes(b.member.id)),
  );
  const created: PaymentRequest[] = [];
  for (const b of balances) {
    const now = new Date().toISOString();
    const req: PaymentRequest = {
      id: newId("req"),
      memberId: b.member.id,
      cents: b.requestableCents,
      status: "DRAFT",
      note,
      remindersSent: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (req.cents > cap) {
      req.status = "ERROR";
      req.error = `Blocked by guardrail: over the ${fmt(cap, group.currency)} limit`;
      log.push({ kind: "request", detail: `${b.member.name}: ${req.error}`, ok: false });
    } else {
      try {
        const lines = invoiceLines(group, b.member.id, req.cents);
        const link = memberLink(b.member);
        const breakdown = lines ? "" : ` Your balance covers every expense in the group, minus anything you paid.`;
        const fullNote = `${note}${breakdown}${link ? ` See every receipt and how it was split: ${link}` : ""}`.slice(0, 3900);
        Object.assign(req, await sendInvoice(group, b.member, req.cents, fullNote, lines));
        log.push({ kind: "request", detail: `Sent ${b.member.name} a PayPal request for ${fmt(req.cents, group.currency)}`, ok: true });
      } catch (e) {
        req.status = "ERROR";
        req.error = (e as Error).message;
        log.push({ kind: "request", detail: `${b.member.name}: ${req.error}`, ok: false });
      }
    }
    created.push(req);
  }
  await updateGroup(groupId, (g) => {
    g.requests.push(...created);
  });
  return created;
}

/** Pull the latest status of every open request from PayPal. */
export async function refreshStatuses(groupId: string, log: ActionLog[] = []) {
  const group = await mustGroup(groupId);
  const open = group.requests.filter((r) => r.invoiceId && OPEN_STATUSES.includes(r.status));
  const updates = new Map<string, PaymentRequest["status"]>();
  await Promise.all(
    open.map(async (r) => {
      try {
        const s = await getInvoiceStatus(r.invoiceId!);
        if (s !== r.status) updates.set(r.id, s);
      } catch {
        /* keep old status */
      }
    }),
  );
  const g = await updateGroup(groupId, (g) => {
    for (const r of g.requests) {
      const s = updates.get(r.id);
      if (s) {
        r.status = s;
        r.updatedAt = new Date().toISOString();
      }
    }
  });
  for (const [id, s] of updates) {
    const r = g.requests.find((x) => x.id === id)!;
    const m = g.members.find((x) => x.id === r.memberId);
    log.push({ kind: "status", detail: `${m?.name}'s request is now ${s}`, ok: true });
  }
  return g;
}

export async function remind(groupId: string, requestId: string, note: string, log: ActionLog[] = [], subject?: string) {
  const group = await mustGroup(groupId);
  const r = group.requests.find((x) => x.id === requestId);
  if (!r?.invoiceId) throw new Error("Request not found");
  if (!OPEN_STATUSES.includes(r.status)) throw new Error(`Request is ${r.status}, nothing to remind`);
  const m = group.members.find((x) => x.id === r.memberId);
  await remindInvoice(r.invoiceId, note, subject ?? `Friendly reminder · ${group.name}`);
  const now = new Date().toISOString();
  await updateGroup(groupId, (g) => {
    const x = g.requests.find((y) => y.id === requestId)!;
    x.remindersSent += 1;
    x.lastReminderAt = now;
    x.updatedAt = now;
  });
  log.push({ kind: "reminder", detail: `Reminded ${m?.name} (${r.remindersSent + 1} so far)`, ok: true });
}

export async function cancelRequest(groupId: string, requestId: string, reason: string, log: ActionLog[] = []) {
  const group = await mustGroup(groupId);
  const r = group.requests.find((x) => x.id === requestId);
  if (!r?.invoiceId) throw new Error("Request not found");
  await cancelInvoice(r.invoiceId, reason);
  await updateGroup(groupId, (g) => {
    const x = g.requests.find((y) => y.id === requestId)!;
    x.status = "CANCELLED";
    x.updatedAt = new Date().toISOString();
  });
  log.push({ kind: "cancel", detail: `Cancelled request ${requestId}`, ok: true });
}

export type NewExpense = {
  description: string;
  paidBy: string;
  items: { name: string; cents: number }[];
  plan: { index: number; member_ids: string[]; weights: number[] }[];
  taxCents: number;
  tipCents: number;
  modes: { tax: "proportional" | "equal"; tip: "proportional" | "equal" };
  splitInstruction?: string;
  aiExplanation?: string;
  source: "receipt" | "manual";
  receiptId?: string;
};

export async function addExpense(groupId: string, input: NewExpense) {
  return updateGroup(groupId, (g) => {
    if (!g.members.some((m) => m.id === input.paidBy)) throw new Error("Unknown payer");
    const { items, shares } = computeShares(input.items, input.plan, input.taxCents, input.tipCents, input.modes, g.members);
    const totalCents = items.reduce((a, b) => a + b.cents, 0) + input.taxCents + input.tipCents;
    const e: Expense = {
      id: newId("exp"),
      description: input.description,
      paidBy: input.paidBy,
      totalCents,
      items,
      taxCents: input.taxCents,
      tipCents: input.tipCents,
      shares,
      modes: input.modes,
      receiptId: input.receiptId && /^[a-f0-9]{32}$/.test(input.receiptId) ? input.receiptId : undefined,
      splitInstruction: input.splitInstruction,
      aiExplanation: input.aiExplanation,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    g.expenses.push(e);
  });
}

export async function deleteExpense(groupId: string, expenseId: string) {
  return updateGroup(groupId, (g) => {
    g.expenses = g.expenses.filter((e) => e.id !== expenseId);
  });
}
