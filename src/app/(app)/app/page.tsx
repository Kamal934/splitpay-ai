"use client";

import { CircleCheck, Clock, Receipt, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { PageBody, PageHeader } from "@/components/AppShell";
import CollectionBar from "@/components/CollectionBar";
import DemoButton from "@/components/DemoButton";
import { Alert, AvatarStack, Badge, EmptyState, SectionHeader } from "@/components/ui";
import { fmt } from "@/lib/money";
import { groupStats, recentActivity, timeAgo } from "@/lib/stats";
import type { Group } from "@/lib/types";

const ACTIVITY_DOT: Record<string, string> = {
  expense: "bg-brand-500",
  request: "bg-warning",
  paid: "bg-success",
  cancelled: "bg-slate-400",
  failed: "bg-danger",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card card-pad">
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

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

  const all = groups ?? [];
  const stats = all.map((g) => ({ g, s: groupStats(g) }));
  const sum = (k: "spent" | "collected" | "pending" | "notRequested") => stats.reduce((a, x) => a + x.s[k], 0);
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
          <Stat label="Total spent" value={fmt(sum("spent"))} hint={`${all.length} group${all.length === 1 ? "" : "s"}`} />
          <Stat label="Collected via PayPal" value={fmt(sum("collected"))} hint="Invoices PayPal reports as paid" />
          <Stat label="Pending in PayPal" value={fmt(sum("pending"))} hint="Requests sent, awaiting payment" />
          <Stat label="Not requested yet" value={fmt(sum("notRequested"))} hint="Owed but no PayPal request sent" />
        </div>

        <div className="card card-pad">
          <SectionHeader title="Collection status" description="How much of what you're owed has come back through PayPal." />
          <div className="mt-5">
            <CollectionBar parts={{ collected: sum("collected"), pending: sum("pending"), notRequested: sum("notRequested") }} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
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
                  <table className="w-full min-w-[640px]">
                    <thead className="border-y border-line bg-slate-50/70">
                      <tr>
                        <th className="th">Group</th>
                        <th className="th">People</th>
                        <th className="th text-right">Spent</th>
                        <th className="th text-right">Outstanding</th>
                        <th className="th w-40">Collected</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {stats.map(({ g, s }) => {
                        const owedTotal = s.collected + s.open;
                        const pct = owedTotal ? Math.round((s.collected / owedTotal) * 100) : 0;
                        const status =
                          s.spent === 0 ? <Badge>New</Badge> : s.open === 0 ? <Badge tone="success"><CircleCheck className="h-3.5 w-3.5" aria-hidden /> Settled</Badge> : s.pending > 0 ? <Badge tone="warning"><Clock className="h-3.5 w-3.5" aria-hidden /> Collecting</Badge> : <Badge tone="brand"><Send className="h-3.5 w-3.5" aria-hidden /> Ready to request</Badge>;
                        return (
                          <tr key={g.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => router.push(`/groups/${g.id}`)}>
                            <td className="td">
                              <Link href={`/groups/${g.id}`} className="font-medium text-ink hover:text-brand-700">
                                {g.name}
                              </Link>
                              <p className="text-xs text-muted">{g.expenses.length} expenses</p>
                            </td>
                            <td className="td">
                              <AvatarStack people={g.members} />
                            </td>
                            <td className="td num text-right">{fmt(s.spent, g.currency)}</td>
                            <td className="td num text-right font-medium">{fmt(s.open, g.currency)}</td>
                            <td className="td">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="num w-9 text-right text-xs text-muted">{pct}%</span>
                              </div>
                            </td>
                            <td className="td">{status}</td>
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
                      className="input"
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
              {err && <Alert>{err}</Alert>}
              <div className="flex justify-end">
                <button className="btn-primary" disabled={busy}>
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
                    {i < activity.length - 1 && <span className="absolute left-[4px] top-3 h-full w-px bg-line" aria-hidden />}
                    <span className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${ACTIVITY_DOT[a.kind]}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{a.text}</p>
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
