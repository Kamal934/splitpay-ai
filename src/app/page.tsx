"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { fmt } from "@/lib/money";
import type { Group } from "@/lib/types";

const STEPS = [
  { icon: "📸", title: "Snap the bill", text: "Claude reads every line, tax and tip from a receipt photo." },
  { icon: "💬", title: "Say how to split", text: "“Raj didn't drink, Priya had two desserts”. Plain English becomes exact shares." },
  { icon: "📨", title: "AI collects via PayPal", text: "The agent sends PayPal invoices, tracks who paid and sends polite reminders." },
];

export default function Home() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [members, setMembers] = useState([
    { name: "You", email: "" },
    { name: "", email: "" },
  ]);

  useEffect(() => {
    api<Group[]>("/api/groups").then(setGroups).catch(() => {});
  }, []);

  async function demo() {
    setBusy(true);
    try {
      const g = await api<Group>("/api/demo", { method: "POST" });
      router.push(`/groups/${g.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

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

  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 pt-4 lg:grid-cols-2">
        <div>
          <p className="mb-3 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            Built with PayPal Agent Toolkit + Claude
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Snap the bill. <span className="text-brand-600">AI settles it.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            After every trip or dinner, one person pays and then spends a week chasing everyone. SplitPay reads the
            receipt, understands how you want to split it, and has an AI agent collect everyone’s share through PayPal.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={demo} disabled={busy} className="btn-primary px-5 py-3 text-base">
              ▶ Try the demo trip
            </button>
            <a href="#new" className="btn-ghost px-5 py-3 text-base">
              Create your group
            </a>
          </div>
        </div>
        <div className="grid gap-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card flex items-start gap-4 p-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-2xl">{s.icon}</div>
              <div>
                <p className="font-semibold">
                  {i + 1}. {s.title}
                </p>
                <p className="text-sm text-slate-600">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form id="new" onSubmit={create} className="card space-y-4 p-6">
          <h2 className="text-xl font-bold">New group</h2>
          <div>
            <label className="label">Group name</label>
            <input className="input" placeholder="Goa trip, Flat 4B, Friday dinner…" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="label">People (first is you, the organiser who collects)</label>
            {members.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  placeholder={i === 0 ? "Your name" : "Friend's name"}
                  value={m.name}
                  onChange={(e) => setMembers(members.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="input"
                  type="email"
                  placeholder={i === 0 ? "Your PayPal email" : "Their PayPal email"}
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
            Create group
          </button>
        </form>

        <div className="card p-6">
          <h2 className="mb-4 text-xl font-bold">Your groups</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-slate-500">No groups yet. Try the demo trip to see SplitPay in action.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((g) => {
                const total = g.expenses.reduce((a, e) => a + e.totalCents, 0);
                return (
                  <li key={g.id}>
                    <Link href={`/groups/${g.id}`} className="flex items-center justify-between py-3 hover:text-brand-600">
                      <span>
                        <span className="font-semibold">{g.name}</span>
                        <span className="ml-2 text-sm text-slate-500">{g.members.length} people</span>
                      </span>
                      <span className="text-sm font-semibold">{fmt(total, g.currency)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
