"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { computeBalances, fmt } from "@/lib/money";
import type { Group } from "@/lib/types";
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

  if (err) return <p className="card p-6 text-red-700">{err}</p>;
  if (!group) return <p className="p-6 text-slate-500">Loading…</p>;

  const balances = computeBalances(group);
  const total = group.expenses.reduce((a, e) => a + e.totalCents, 0);
  const owed = balances.reduce((a, b) => a + b.requestableCents + b.pendingCents, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-brand-600">
            ← All groups
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">{group.name}</h1>
          <p className="text-sm text-slate-500">
            {group.members.length} people · {fmt(total, group.currency)} spent · {fmt(owed, group.currency)} still to collect
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? "Close" : "Edit people & emails"}
        </button>
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
