"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import DemoButton from "@/components/DemoButton";
import { computeBalances, fmt, initials } from "@/lib/money";
import type { Group } from "@/lib/types";
import { PAID_STATUSES } from "@/lib/types";

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
  const toCollect = all.reduce((a, g) => a + computeBalances(g).reduce((x, b) => x + b.requestableCents + b.pendingCents, 0), 0);
  const collected = all.reduce((a, g) => a + g.requests.filter((r) => PAID_STATUSES.includes(r.status)).reduce((x, r) => x + r.cents, 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your groups</h1>
          <p className="text-sm text-slate-500">Trips, flats and dinners you&apos;re collecting for.</p>
        </div>
        <DemoButton label="▶ Load demo trip" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Groups", String(all.length), "text-slate-900"],
          ["Still to collect", fmt(toCollect), "text-rose-600"],
          ["Collected via PayPal", fmt(collected), "text-emerald-600"],
        ].map(([label, value, color]) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-3xl font-extrabold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section>
          {groups === null ? (
            <p className="text-slate-500">Loading…</p>
          ) : all.length === 0 ? (
            <div className="card grid place-items-center p-12 text-center">
              <p className="text-4xl">🧾</p>
              <p className="mt-3 font-semibold">No groups yet</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Create a group on the right, or load the demo trip to try everything in a minute.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {all.map((g) => {
                const total = g.expenses.reduce((a, e) => a + e.totalCents, 0);
                const open = computeBalances(g).reduce((x, b) => x + b.requestableCents + b.pendingCents, 0);
                const settled = total > 0 && open === 0;
                return (
                  <Link key={g.id} href={`/groups/${g.id}`} className="card group block p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-lg font-bold group-hover:text-brand-600">{g.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          settled ? "bg-emerald-100 text-emerald-800" : open > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {settled ? "SETTLED" : open > 0 ? `${fmt(open, g.currency)} OPEN` : "NEW"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {g.expenses.length} expenses · {fmt(total, g.currency)} spent
                    </p>
                    <div className="mt-4 flex -space-x-2">
                      {g.members.slice(0, 6).map((m) => (
                        <span key={m.id} title={m.name} className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-brand-100 text-[11px] font-bold text-brand-700">
                          {initials(m.name)}
                        </span>
                      ))}
                      {g.members.length > 6 && (
                        <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-[11px] font-bold text-slate-600">
                          +{g.members.length - 6}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <form onSubmit={create} className="card h-fit space-y-4 p-6">
          <div>
            <h2 className="text-lg font-bold">New group</h2>
            <p className="text-sm text-slate-500">You&apos;re the organiser: you pay, and SplitPay collects from everyone.</p>
          </div>
          <div>
            <label className="label">Group name</label>
            <input className="input" placeholder="Goa trip, Flat 4B, Friday dinner…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="label">People</label>
            {members.map((m, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
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
            <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setMembers([...members, { name: "", email: "" }])}>
              + Add person
            </button>
          </div>
          {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}
