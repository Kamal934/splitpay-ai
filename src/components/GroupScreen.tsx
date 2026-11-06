"use client";

import { ArrowDown, ArrowUp, BookOpen, ChevronRight, CircleCheck, Play, Scale, Settings2, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { emit } from "@/lib/events";
import { fmt } from "@/lib/money";
import { groupStats, plural, timeAgo } from "@/lib/stats";
import type { AutopilotSettings, Group } from "@/lib/types";
import { api } from "./api";
import { Toggle } from "./AutopilotPanel";
import CopyLink from "./CopyLink";
import { Alert, Avatar, Badge, Spinner } from "./ui";

/* ---------- Settlement overview: collection progress + balances in one card ---------- */

export function SettlementOverview({ group }: { group: Group }) {
  const s = groupStats(group);
  const c = group.currency;
  const owedTotal = s.collected + s.open;
  const pct = owedTotal ? Math.round((s.collected / owedTotal) * 100) : 100;
  const seg = (v: number) => (owedTotal ? `${(v / owedTotal) * 100}%` : "0%");

  const headline =
    s.open > 0
      ? { amount: fmt(s.open, c), label: "Left to collect", tone: "text-success" }
      : s.paybackDue > 0
        ? { amount: fmt(s.paybackDue, c), label: "To pay back to members", tone: "text-warning" }
        : { amount: fmt(0, c), label: s.spent ? "Everyone is square" : "Nothing yet", tone: "text-ink" };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6 lg:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Scale className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">Settlement overview</h2>
            <p className="text-sm text-muted">See who owes what and track your group&apos;s balances.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className={`num text-3xl font-semibold tracking-tight ${headline.tone}`}>{headline.amount}</p>
            <p className="text-sm text-muted">{headline.label}</p>
          </div>
          {owedTotal > 0 && <Badge tone={pct === 100 ? "success" : "warning"}>{pct}% collected</Badge>}
        </div>
      </div>

      {owedTotal > 0 && (
        <div className="px-5 pb-4 sm:px-6">
          <div
            className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full bg-slate-100"
            role="img"
            aria-label={`Collected ${fmt(s.collected, c)}, pending ${fmt(s.pending, c)}, not requested ${fmt(s.notRequested, c)}`}
          >
            {s.collected > 0 && <div className="h-full bg-success" style={{ width: seg(s.collected) }} title={`Collected ${fmt(s.collected, c)}`} />}
            {s.pending > 0 && <div className="h-full bg-warning" style={{ width: seg(s.pending) }} title={`Pending in PayPal ${fmt(s.pending, c)}`} />}
            {s.notRequested > 0 && <div className="h-full bg-slate-400" style={{ width: seg(s.notRequested) }} title={`Not requested ${fmt(s.notRequested, c)}`} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Collected <b className="num text-ink">{fmt(s.collected, c)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Pending <b className="num text-ink">{fmt(s.pending, c)}</b></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Not requested <b className="num text-ink">{fmt(s.notRequested, c)}</b></span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[560px]">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="th">Person</th>
              <th className="th text-right">Total paid</th>
              <th className="th text-right">Share</th>
              <th className="th text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {s.balances.map((b) => (
              <tr key={b.member.id}>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={b.member.id} name={b.member.name} />
                    <span className="font-medium text-ink">{b.member.name}</span>
                    {b.member.isOrganizer ? <Badge tone="brand">Organiser</Badge> : <CopyLink token={b.member.accessToken} name={b.member.name} />}
                  </div>
                </td>
                <td className="td num text-right font-medium text-ink">{fmt(b.paidCents, c)}</td>
                <td className="td num text-right text-muted">{fmt(b.shareCents, c)}</td>
                <td className="td text-right">
                  {b.netCents === 0 ? (
                    <Badge tone="success">
                      <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Settled
                    </Badge>
                  ) : b.netCents > 0 ? (
                    <span className="num inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden /> Gets back {fmt(b.netCents, c)}
                    </span>
                  ) : (
                    <span className="inline-flex flex-col items-end">
                      <span className="num inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden /> Owes {fmt(-b.netCents, c)}
                      </span>
                      {b.pendingCents > 0 && <span className="num mt-0.5 text-xs text-muted">{fmt(b.pendingCents, c)} requested</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line bg-slate-50/50">
            <tr>
              <td className="td font-semibold text-ink" colSpan={3}>
                Total outstanding
              </td>
              <td className="td num text-right text-base font-semibold text-ink">{fmt(s.open, c)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ---------- Autopilot, inline (real settings; full rules in the dialog) ---------- */

const DEFAULTS: AutopilotSettings = { enabled: false, autoRequest: true, remind: true, firstAfterMin: 2880, repeatEveryMin: 2880, maxReminders: 3, maxRequestCents: 50000 };
const every = (m: number) => (m >= 1440 ? plural(Math.round(m / 1440), "day") : m >= 60 ? plural(Math.round(m / 60), "hour") : plural(m, "minute"));

export function AutopilotCard({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const a: AutopilotSettings = { ...DEFAULTS, ...(group.autopilot ?? {}) };
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(patch: Partial<AutopilotSettings>) {
    setBusy("save");
    setErr("");
    try {
      const r = await api<{ group: Group }>(`/api/groups/${group.id}/autopilot`, { method: "POST", body: { action: "save", settings: { ...a, ...patch } } });
      onChange(r.group);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function run() {
    setBusy("run");
    setErr("");
    setMsg("");
    try {
      const r = await api<{ run: { summary: string }; group: Group }>(`/api/groups/${group.id}/autopilot`, { method: "POST", body: { action: "run" } });
      onChange(r.group);
      setMsg(r.run.summary);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Zap className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="whitespace-nowrap text-sm font-semibold text-ink">Autopilot</h2>
        </div>
        <Toggle on={a.enabled} label="Autopilot" disabled={!!busy} onChange={(v) => save({ enabled: v })} />
      </div>
      <p className="mt-2 text-xs text-muted">Let SplitPay handle PayPal requests and reminders automatically.</p>

      <div className="mt-3 space-y-2 text-sm text-ink">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={a.autoRequest} disabled={!!busy} onChange={(e) => save({ autoRequest: e.target.checked })} />
          Send PayPal requests when someone owes money
        </label>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={a.remind !== false} disabled={!!busy} onChange={(e) => save({ remind: e.target.checked })} />
          <span>
            Send reminders: first after {every(a.firstAfterMin)}, then every {every(a.repeatEveryMin)}, up to {plural(a.maxReminders, "time")}
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-secondary h-8 px-3" disabled={!!busy} onClick={run}>
          {busy === "run" ? <Spinner /> : <Play className="h-3.5 w-3.5" aria-hidden />} Run now
        </button>
        <button className="btn-ghost h-8 px-2" onClick={() => emit("open-autopilot")}>
          <Settings2 className="h-3.5 w-3.5" aria-hidden /> Rules
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">{a.lastRunAt ? <>Last run {timeAgo(a.lastRunAt)}: <span className="text-ink">{a.lastSummary}</span></> : "Hasn't run yet."}</p>
      {msg && <p className="mt-1 text-xs text-success">{msg}</p>}
      {err && (
        <div className="mt-2">
          <Alert>{err}</Alert>
        </div>
      )}

      <p className="mt-auto flex items-center gap-1.5 rounded-lg bg-brand-50/70 px-2.5 py-2 pt-2 text-[11px] text-brand-700">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /> Amounts always come from the ledger. You stay in control.
      </p>
    </section>
  );
}

/* ---------- Group ledger, compact (full AG Grid ledger further down) ---------- */

export function LedgerMini({ group }: { group: Group }) {
  const rows = [...group.expenses].reverse().slice(0, 4);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name.split(" ")[0] ?? "?";
  return (
    <section className="card flex min-w-0 flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="whitespace-nowrap text-sm font-semibold text-ink">Group ledger</h2>
        </div>
        {group.expenses.length > 0 && (
          <button className="btn-ghost h-7 whitespace-nowrap px-2 text-brand-700" onClick={() => document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            View all <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No expenses yet.</p>
      ) : (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Expense</th>
              <th className="pb-2 font-medium">Payer</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap py-2 pr-2 text-muted">{new Date(e.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                <td className="max-w-[90px] truncate py-2 pr-2 text-ink" title={e.description}>{e.description}</td>
                <td className="py-2 pr-2 text-muted">{name(e.paidBy)}</td>
                <td className="num py-2 text-right font-medium text-ink">{fmt(e.totalCents, group.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
