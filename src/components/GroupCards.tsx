"use client";

import { Ban, Bell, Bot, ChevronRight, CircleAlert, CircleCheck, Clock, Hand, History, PartyPopper, Receipt, RefreshCw, ScanLine, Send, Settings2, Sparkles, User, Users, Wallet, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { emit } from "@/lib/events";
import { fmt } from "@/lib/money";
import { groupStats, groupStatus, plural, recentActivity, timeAgo, type ActivityKind } from "@/lib/stats";
import type { AuditActor, Group } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/types";
import { Badge, Dialog, SectionHeader } from "./ui";

/* ---------- 1. Next best action, driven by the real group status ---------- */

export function NextAction({ group, onAddExpense }: { group: Group; onAddExpense: () => void }) {
  const s = groupStats(group);
  const st = groupStatus(group);
  const organiser = group.members.find((m) => m.isOrganizer)?.name ?? "The organiser";
  const owing = s.balances.filter((b) => b.requestableCents > 0).length;
  const openCount = group.requests.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const c = group.currency;

  const cfg: { icon: LucideIcon; tone: string; text: React.ReactNode; action?: React.ReactNode } = (() => {
    switch (st.key) {
      case "new":
        return {
          icon: Sparkles,
          tone: "border-brand-100 bg-brand-50/70",
          text: "Add your first expense. Scan a receipt, paste the group chat, or enter it by hand.",
          action: (
            <button className="btn-primary" onClick={onAddExpense}>
              <Receipt className="h-4 w-4" aria-hidden /> Add expense
            </button>
          ),
        };
      case "ready":
        return {
          icon: Sparkles,
          tone: "border-brand-100 bg-brand-50/70",
          text: (
            <>
              Your group is ready. {plural(owing, "person owes", "people owe")} <b className="num">{fmt(s.notRequested, c)}</b> with no PayPal request yet.
            </>
          ),
          action: (
            <button className="btn-primary" onClick={() => emit("request-payments")}>
              <Send className="h-4 w-4" aria-hidden /> Request {fmt(s.notRequested, c)}
            </button>
          ),
        };
      case "collecting":
        return {
          icon: RefreshCw,
          tone: "border-amber-200 bg-amber-50/70",
          text: (
            <>
              <b className="num">{fmt(s.pending, c)}</b> is waiting in PayPal across {plural(openCount, "invoice")}. Check who has paid, or let Autopilot follow up.
            </>
          ),
          action: (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => emit("open-autopilot")}>
                <Zap className="h-4 w-4" aria-hidden /> Autopilot
              </button>
              <button className="btn-primary" onClick={() => emit("check-payments")}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Check payments
              </button>
            </div>
          ),
        };
      case "payback":
        return {
          icon: Wallet,
          tone: "border-amber-200 bg-amber-50/70",
          text: (
            <>
              Everyone has paid in, but {organiser} holds <b className="num">{fmt(s.paybackDue, c)}</b> that belongs to members who paid more than their share. Pay them back to fully settle.
            </>
          ),
        };
      case "settled_paypal":
        return {
          icon: PartyPopper,
          tone: "border-emerald-200 bg-emerald-50/70",
          text: (
            <>
              All settled. <b className="num">{fmt(s.collected, c)}</b> was collected through PayPal and nobody owes anything.
            </>
          ),
        };
      default:
        return { icon: CircleCheck, tone: "border-emerald-200 bg-emerald-50/70", text: "Nothing owed. Every expense is covered by the person who paid it." };
    }
  })();

  const Icon = cfg.icon;
  const viaPayPal = st.key === "ready" || st.key === "collecting" || st.key === "settled_paypal";
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3.5 ${cfg.tone}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm ring-1 ring-line">
        {viaPayPal ? (
          // Official PayPal mark (paypalobjects.com), shown only where PayPal is actually involved
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/paypal-mark-color.svg" alt="PayPal" className="h-6 w-6" />
        ) : (
          <Icon className="h-5 w-5 text-brand-600" aria-hidden />
        )}
      </span>
      <div className="min-w-[200px] flex-1">
        <p className="text-sm text-ink">{cfg.text}</p>
        {st.key === "collecting" && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" aria-hidden /> {group.lastCheckedAt ? `Last checked with PayPal ${timeAgo(group.lastCheckedAt)}` : "Not checked with PayPal yet"}
          </p>
        )}
      </div>
      {cfg.action}
    </div>
  );
}

/* ---------- 2. One-line settlement summary for the Balances header ---------- */

export function SettlementPill({ group }: { group: Group }) {
  const s = groupStats(group);
  const organiser = group.members.find((m) => m.isOrganizer)?.name ?? "the organiser";
  const debtors = s.balances.filter((b) => !b.member.isOrganizer && b.netCents < 0);
  const owed = debtors.reduce((a, b) => a - b.netCents, 0);
  if (debtors.length)
    return (
      <Badge tone="brand">
        {debtors.length} owe {organiser} <span className="num">{fmt(owed, group.currency)}</span>
      </Badge>
    );
  if (s.paybackDue > 0)
    return (
      <Badge tone="warning">
        {organiser} owes members <span className="num">{fmt(s.paybackDue, group.currency)}</span>
      </Badge>
    );
  if (s.spent > 0)
    return (
      <Badge tone="success">
        <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Everyone is square
      </Badge>
    );
  return null;
}

/* ---------- 5a. Recent activity for this group (real events only) ---------- */

const ACT: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  receipt: { icon: ScanLine, tone: "bg-brand-50 text-brand-600" },
  expense: { icon: Receipt, tone: "bg-brand-50 text-brand-600" },
  request: { icon: Send, tone: "bg-amber-50 text-amber-600" },
  reminder: { icon: Bell, tone: "bg-amber-50 text-amber-600" },
  paid: { icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
  cancelled: { icon: Ban, tone: "bg-slate-100 text-slate-500" },
  failed: { icon: CircleAlert, tone: "bg-red-50 text-red-600" },
  autopilot: { icon: Hand, tone: "bg-slate-100 text-slate-500" },
};

const ACTOR: Record<AuditActor, { label: string; icon: LucideIcon; tone: "neutral" | "brand" | "warning" }> = {
  you: { label: "You", icon: User, tone: "neutral" },
  agent: { label: "Agent", icon: Bot, tone: "brand" },
  autopilot: { label: "Autopilot", icon: Zap, tone: "warning" },
  member: { label: "Member", icon: Users, tone: "neutral" },
  paypal: { label: "PayPal", icon: CircleCheck, tone: "brand" },
};

export function GroupActivity({ group }: { group: Group }) {
  const items = recentActivity([group], 5);
  const [open, setOpen] = useState(false);
  const log = group.audit ?? [];
  return (
    <div className="card min-w-0 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <History className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="whitespace-nowrap text-sm font-semibold text-ink">Recent activity</h2>
        </div>
        {log.length > 0 && (
          <button className="btn-ghost h-7 whitespace-nowrap px-2 text-brand-700" onClick={() => setOpen(true)}>
            View all <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Audit log" size="lg" footer={<button className="btn-secondary" onClick={() => setOpen(false)}>Close</button>}>
        <p className="mb-3">Every action on this group by you, the chat agent, autopilot and members, newest first.</p>
        <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {log.slice(0, 200).map((e) => {
            const a = ACTOR[e.actor];
            return (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <Badge tone={a.tone}>
                  <a.icon className="h-3.5 w-3.5" aria-hidden />
                  {a.label}
                </Badge>
                <p className={`min-w-0 flex-1 text-sm ${e.ok ? "text-ink" : "text-danger"}`}>{e.detail}</p>
                <span className="shrink-0 text-xs text-muted">{timeAgo(e.at)}</span>
              </li>
            );
          })}
        </ul>
      </Dialog>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Expenses, PayPal requests and payments will appear here as they happen.</p>
      ) : (
        <ul className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-px before:bg-brand-100">
          {items.map((a, i) => {
            const A = ACT[a.kind];
            return (
              <li key={i} className="relative flex items-start gap-3 pl-4">
                <span className="absolute left-0 top-3 h-[7px] w-[7px] rounded-full bg-brand-500 ring-2 ring-white" aria-hidden />
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${A.tone}`}>
                  <A.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={a.text}>{a.text}</p>
                  <p className="num truncate text-xs text-muted">
                    {new Date(a.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- 5b. Autopilot at a glance (real settings and last run) ---------- */

export function AutopilotSummary({ group }: { group: Group }) {
  const a = group.autopilot;
  const on = !!a?.enabled;
  const every = (m: number) => (m >= 1440 ? plural(Math.round(m / 1440), "day") : m >= 60 ? plural(Math.round(m / 60), "hour") : plural(m, "minute"));
  return (
    <div className="card card-pad flex flex-col">
      <SectionHeader
        icon={Zap}
        title="Autopilot collection"
        actions={
          <Badge tone={on ? "success" : "neutral"}>
            {on ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <Hand className="h-3.5 w-3.5" aria-hidden />}
            {on ? "On" : "Off"}
          </Badge>
        }
      />
      <p className="mt-3 text-sm text-muted">
        {on
          ? `Requests what's owed and reminds people every ${every(a!.repeatEveryMin)}, up to ${plural(a!.maxReminders, "reminder")}, then hands back to you.`
          : "Let SplitPay send requests and polite reminders on a schedule you set."}
      </p>
      <p className="mt-2 text-xs text-muted">{a?.lastRunAt ? <>Last run {timeAgo(a.lastRunAt)}: <span className="text-ink">{a.lastSummary}</span></> : "Hasn't run yet."}</p>
      <div className="mt-auto pt-4">
        <button className="btn-secondary" onClick={() => emit("open-autopilot")}>
          <Settings2 className="h-4 w-4" aria-hidden /> {on ? "View settings" : "Set up Autopilot"} <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
