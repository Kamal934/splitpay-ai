"use client";

import { Ban, Bell, ChevronRight, CircleAlert, CircleCheck, CircleDashed, Clock, Hand, Receipt, ScanLine, Send, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { PageBody, PageHeader } from "@/components/AppShell";
import CollectionBar from "@/components/CollectionBar";
import DemoButton from "@/components/DemoButton";
import { Alert, AvatarStack, Badge, EmptyState, SectionHeader, StatCard } from "@/components/ui";
import { duplicateEmailRows } from "@/lib/members";
import { fmt } from "@/lib/money";
import { groupStats, groupStatus, plural, recentActivity, timeAgo, type ActivityKind } from "@/lib/stats";
import type { Group } from "@/lib/types";

const ACTIVITY: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  receipt: { icon: ScanLine, tone: "bg-brand-50 text-brand-600" },
  expense: { icon: Receipt, tone: "bg-brand-50 text-brand-600" },
  request: { icon: Send, tone: "bg-amber-50 text-amber-600" },
  reminder: { icon: Bell, tone: "bg-amber-50 text-amber-600" },
  paid: { icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
  cancelled: { icon: Ban, tone: "bg-slate-100 text-slate-500" },
  failed: { icon: CircleAlert, tone: "bg-red-50 text-red-600" },
  autopilot: { icon: Hand, tone: "bg-slate-100 text-slate-500" },
};

const STATUS_ICON = { new: CircleDashed, ready: Send, collecting: Clock, payback: Wallet, settled_paypal: CircleCheck, settled_internal: CircleCheck } as const;

export default function Dashboard() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [members, setMembers] = useState([
    { name: "", email: "" },
    { name: "", email: "" },
  ]);

  useEffect(() => {
    api<Group[]>("/api/groups").then(setGroups).catch(() => setGroups([]));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const g = await api<Group>("/api/groups", { method: "POST", body: { name, members, currency: "USD" } });
      router.push(`/groups/${g.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const dupRows = duplicateEmailRows(members);
  const all = groups ?? [];
  const stats = all.map((g) => ({ g, s: groupStats(g) }));
  const sum = (k: "spent" | "collected" | "pending" | "notRequested" | "paybackDue") => stats.reduce((a, x) => a + x.s[k], 0);
  const activity = recentActivity(all);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "SplitPay" }, { label: "Dashboard" }]}
        title="Dashboard"
        subtitle="Everything you've paid for and are collecting back, across all your groups."
        actions={<DemoButton label="Load demo trip" />}
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={Receipt} tone="brand" label="Total spent" value={fmt(sum("spent"))} hint={`Across ${plural(all.length, "group")}`} />
          <StatCard icon={CircleCheck} tone="success" label="Collected via PayPal" value={fmt(sum("collected"))} hint="Invoices PayPal reports as paid" />
          <StatCard icon={Clock} tone="warning" label="Pending in PayPal" value={fmt(sum("pending"))} hint="Requests sent, awaiting payment" />
          <StatCard icon={CircleDashed} tone="neutral" label="Not requested yet" value={fmt(sum("notRequested"))} hint="Owed, no PayPal request sent" />
        </div>

        <div className="card card-pad">
          <SectionHeader title="Collection status" description="How much of what you're owed has come back through PayPal." />
          <div className="mt-5">
            <CollectionBar
              parts={{ collected: sum("collected"), pending: sum("pending"), notRequested: sum("notRequested") }}
              emptyText={sum("spent") > 0 ? "Nothing to collect right now. Every expense is either paid back or covered by the person who paid it." : undefined}
            />
          </div>
          {sum("paybackDue") > 0 && (
            <div className="mt-4">
              <Alert tone="warning">
                <span className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                  {fmt(sum("paybackDue"))} belongs to members who paid more than their share. That&apos;s separate from PayPal collection and still needs paying back.
                </span>
              </Alert>
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <div className="card overflow-hidden">
              <div className="card-pad pb-4">
                <SectionHeader title="Groups" description="Trips, flats and dinners you're the organiser for." />
              </div>
              {groups === null ? (
                <p className="px-6 pb-6 text-sm text-muted">Loading…</p>
              ) : all.length === 0 ? (
                <EmptyState icon={Receipt} title="No groups yet" text="Create a group, or load the demo trip to try every feature in about a minute." action={<DemoButton label="Load demo trip" />} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="border-y border-line bg-slate-50/70">
                      <tr>
                        <th className="th min-w-[200px]">Group</th>
                        <th className="th">People</th>
                        <th className="th text-right">Spent</th>
                        <th className="th text-right">Outstanding</th>
                        <th className="th w-40">Collected</th>
                        <th className="th">Status</th>
                        <th className="th w-10"><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {stats.map(({ g, s }) => {
                        const owedTotal = s.collected + s.open;
                        const pct = owedTotal ? Math.round((s.collected / owedTotal) * 100) : 0;
                        const st = groupStatus(g);
                        const StIcon = STATUS_ICON[st.key];
                        return (
                          <tr key={g.id} className="group cursor-pointer transition-colors hover:bg-brand-50/40" onClick={() => router.push(`/groups/${g.id}`)}>
                            <td className="td">
                              <Link href={`/groups/${g.id}`} className="block max-w-[220px] truncate font-medium text-ink group-hover:text-brand-700" title={g.name}>
                                {g.name}
                              </Link>
                              <p className="whitespace-nowrap text-xs text-muted">
                                {plural(g.expenses.length, "expense")} · {plural(g.members.length, "person", "people")}
                              </p>
                            </td>
                            <td className="td">
                              <AvatarStack people={g.members} />
                            </td>
                            <td className="td num text-right text-muted">{fmt(s.spent, g.currency)}</td>
                            <td className={`td num text-right font-semibold ${s.open > 0 ? "text-ink" : "text-slate-400"}`}>{fmt(s.open, g.currency)}</td>
                            <td className="td">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="num w-9 text-right text-xs text-muted">{pct}%</span>
                              </div>
                            </td>
                            <td className="td">
                              <span title={st.hint}>
                                <Badge tone={st.tone}>
                                  <StIcon className="h-3.5 w-3.5" aria-hidden /> {st.label}
                                </Badge>
                              </span>
                            </td>
                            <td className="td pr-4 text-right">
                              <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <form id="new" onSubmit={create} className="card card-pad scroll-mt-20 space-y-4">
              <SectionHeader title="New group" description="You're the organiser: you pay, and SplitPay collects each person's share through PayPal." />
              <div>
                <label className="label" htmlFor="gname">Group name</label>
                <input id="gname" className="input" placeholder="Goa trip, Flat 4B, Friday dinner…" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="label">People (the first person is you)</label>
                {members.map((m, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="input"
                      placeholder={i === 0 ? "Your name" : "Friend's name"}
                      value={m.name}
                      onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                    />
                    <input
                      className={`input ${dupRows.has(i) ? "border-danger ring-3 ring-red-100" : ""}`}
                      aria-invalid={dupRows.has(i)}
                      type="email"
                      placeholder="PayPal email"
                      value={m.email}
                      onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))}
                    />
                  </div>
                ))}
                <button type="button" className="btn-ghost -ml-2.5 text-brand-700" onClick={() => setMembers([...members, { name: "", email: "" }])}>
                  + Add person
                </button>
              </div>
              {dupRows.size > 0 && <Alert tone="warning">Each person needs their own PayPal email. Two rows use the same one.</Alert>}
              {err && <Alert>{err}</Alert>}
              <div className="flex justify-end">
                <button className="btn-primary" disabled={busy || dupRows.size > 0}>
                  {busy ? "Creating…" : "Create group"}
                </button>
              </div>
            </form>
          </div>

          <div className="card h-fit">
            <div className="card-pad pb-3">
              <SectionHeader title="Recent activity" />
            </div>
            {activity.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">Expenses and PayPal updates will show up here.</p>
            ) : (
              <ul className="px-6 pb-5">
                {activity.map((a, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < activity.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden />}
                    {(() => {
                      const A = ACTIVITY[a.kind];
                      return (
                        <span className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full ring-4 ring-white ${A.tone}`}>
                          <A.icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      );
                    })()}
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm text-ink">{a.text}</p>
                      {a.detail && <p className="num text-xs text-ink/70">{a.detail}</p>}
                      <p className="text-xs text-muted">
                        <Link href={`/groups/${a.groupId}`} className="hover:text-ink">
                          {a.groupName}
                        </Link>{" "}
                        · {timeAgo(a.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
