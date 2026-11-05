"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { computeBalances, fmt, initials } from "@/lib/money";
import type { Group } from "@/lib/types";
import { PAID_STATUSES } from "@/lib/types";
import AddExpense from "./AddExpense";
import AgentChat from "./AgentChat";
import { api } from "./api";
import Ledger from "./Ledger";
import MembersEditor from "./MembersEditor";
import SettleUp from "./SettleUp";

export default function GroupView({ id }: { id: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    api<Group>(`/api/groups/${id}`).then(setGroup).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(reload, [reload]);

  if (err) return <p className="card m-6 p-6 text-red-700">{err}</p>;
  if (!group) return <p className="mx-auto max-w-7xl p-6 text-slate-500">Loading…</p>;

  const balances = computeBalances(group);
  const total = group.expenses.reduce((a, e) => a + e.totalCents, 0);
  const owed = balances.reduce((a, b) => a + b.requestableCents + b.pendingCents, 0);
  const paid = group.requests.filter((r) => PAID_STATUSES.includes(r.status)).reduce((a, r) => a + r.cents, 0);
  const progress = paid + owed > 0 ? Math.round((paid / (paid + owed)) * 100) : 0;
  const stage = group.expenses.length === 0 ? 0 : group.requests.length === 0 ? 1 : owed > 0 ? 2 : 3;
  const STAGES = ["Add expenses", "Send PayPal requests", "Collect payments", "Settled"];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-6 text-white">
          <Link href="/app" className="text-sm text-brand-100 hover:text-white">
            ← All groups
          </Link>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {group.members.map((m) => (
                    <span key={m.id} title={m.name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-indigo-600 bg-white text-[11px] font-bold text-brand-700">
                      {initials(m.name)}
                    </span>
                  ))}
                </div>
                <span className="text-sm text-brand-100">{group.members.length} people</span>
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-100">Spent</p>
                <p className="text-2xl font-bold">{fmt(total, group.currency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-100">To collect</p>
                <p className="text-2xl font-bold">{fmt(owed, group.currency)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-100">Collected</p>
                <p className="text-2xl font-bold">{fmt(paid, group.currency)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full ${
                    i < stage ? "bg-emerald-500 text-white" : i === stage ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i < stage ? "✓" : i + 1}
                </span>
                <span className={i <= stage ? "text-slate-800" : "text-slate-400"}>{s}</span>
                {i < STAGES.length - 1 && <span className="mx-1 h-px w-6 bg-slate-200" />}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-3">
            {paid + owed > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
                {progress}% collected
              </div>
            )}
            <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close" : "👥 People & emails"}
            </button>
          </div>
        </div>
      </div>

      {editing && <MembersEditor group={group} onSaved={(g) => (setGroup(g), setEditing(false))} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <div key={b.member.id} className="card p-4">
            <p className="truncate text-sm font-semibold">
              {b.member.name} {b.member.isOrganizer && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] text-brand-700">ORGANISER</span>}
            </p>
            <p className={`mt-1 text-2xl font-bold ${b.netCents < 0 ? "text-rose-600" : b.netCents > 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {b.netCents < 0 ? "owes " : b.netCents > 0 ? "gets " : ""}
              {fmt(Math.abs(b.netCents), group.currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              paid {fmt(b.paidCents, group.currency)} · share {fmt(b.shareCents, group.currency)}
              {b.pendingCents > 0 && <> · {fmt(b.pendingCents, group.currency)} requested</>}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <AddExpense group={group} onAdded={setGroup} />
          <SettleUp group={group} onChange={setGroup} />
          <Ledger group={group} onChange={setGroup} />
        </div>
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <AgentChat group={group} onChange={setGroup} />
        </div>
      </div>
    </div>
  );
}
