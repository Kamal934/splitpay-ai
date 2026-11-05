"use client";

import { CircleCheck, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fmt } from "@/lib/money";
import { groupStats } from "@/lib/stats";
import type { Group } from "@/lib/types";
import AddExpense from "./AddExpense";
import AgentChat from "./AgentChat";
import { api } from "./api";
import { PageBody, PageHeader } from "./AppShell";
import CollectionBar from "./CollectionBar";
import Ledger from "./Ledger";
import MembersEditor from "./MembersEditor";
import SettleUp from "./SettleUp";
import { Alert, Avatar, AvatarStack, Badge, SectionHeader } from "./ui";

export default function GroupView({ id }: { id: string }) {
  const [group, setGroup] = useState<Group | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    api<Group>(`/api/groups/${id}`).then(setGroup).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(reload, [reload]);

  if (err)
    return (
      <PageBody>
        <Alert>{err}</Alert>
      </PageBody>
    );
  if (!group)
    return (
      <PageBody>
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-md bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </PageBody>
    );

  const s = groupStats(group);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/app" }, { label: "Groups", href: "/app" }, { label: group.name }]}
        title={group.name}
        subtitle={
          <span className="flex items-center gap-2">
            <AvatarStack people={group.members} max={6} />
            {group.members.length} people · {group.expenses.length} expenses
          </span>
        }
        actions={
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            <Users className="h-4 w-4" aria-hidden /> People & emails
          </button>
        }
      />

      <PageBody>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[
            ["Total spent", s.spent, "All expenses in this group"],
            ["Collected via PayPal", s.collected, "Invoices PayPal reports as paid"],
            ["Pending in PayPal", s.pending, "Sent, awaiting payment"],
            ["Not requested yet", s.notRequested, "Owed, no invoice sent"],
          ].map(([label, v, hint]) => (
            <div key={label as string} className="card card-pad">
              <p className="text-sm text-muted">{label as string}</p>
              <p className="num mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{fmt(v as number, group.currency)}</p>
              <p className="mt-1 text-xs text-muted">{hint as string}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-6">
            <div className="card">
              <div className="card-pad">
                <SectionHeader title="Balances" description="What each person paid, their share, and where they stand." />
                <div className="mt-5">
                  <CollectionBar parts={{ collected: s.collected, pending: s.pending, notRequested: s.notRequested }} currency={group.currency} />
                </div>
              </div>
              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className="th">Person</th>
                      <th className="th text-right">Paid</th>
                      <th className="th text-right">Share</th>
                      <th className="th text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.balances.map((b) => (
                      <tr key={b.member.id}>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <Avatar id={b.member.id} name={b.member.name} size="sm" />
                            <span className="font-medium text-ink">{b.member.name}</span>
                            {b.member.isOrganizer && <Badge tone="brand">Organiser</Badge>}
                          </div>
                        </td>
                        <td className="td num text-right text-muted">{fmt(b.paidCents, group.currency)}</td>
                        <td className="td num text-right text-muted">{fmt(b.shareCents, group.currency)}</td>
                        <td className="td text-right">
                          {b.netCents === 0 ? (
                            <Badge tone="success">
                              <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Settled
                            </Badge>
                          ) : b.netCents > 0 ? (
                            <span className="num font-semibold text-success">Gets back {fmt(b.netCents, group.currency)}</span>
                          ) : (
                            <span className="num font-semibold text-danger">
                              Owes {fmt(-b.netCents, group.currency)}
                              {b.pendingCents > 0 && <span className="block text-xs font-normal text-muted">{fmt(b.pendingCents, group.currency)} requested</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <AddExpense group={group} onAdded={setGroup} />
            <SettleUp group={group} onChange={setGroup} />
            <Ledger group={group} onChange={setGroup} />
          </div>

          <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <AgentChat group={group} onChange={setGroup} />
          </div>
        </div>
      </PageBody>

      <MembersEditor group={group} open={editing} onClose={() => setEditing(false)} onSaved={(g) => (setGroup(g), setEditing(false))} />
    </>
  );
}
