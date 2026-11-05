"use client";

import { useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";

type Row = { id?: string; name: string; email: string };

export default function MembersEditor({ group, onSaved }: { group: Group; onSaved: (g: Group) => void }) {
  const [rows, setRows] = useState<Row[]>(group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const members = rows.filter((r) => r.id || (r.name.trim() && r.email.trim()));
      onSaved(await api<Group>(`/api/groups/${group.id}`, { method: "PATCH", body: { members } }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-slate-600">
        Tip for the demo: use your <b>PayPal sandbox personal account</b> emails so you can log in as each friend and pay the invoice.
      </p>
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex gap-2">
          <input className="input" placeholder="Name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input className="input" type="email" placeholder="PayPal email" value={r.email} onChange={(e) => set(i, { email: e.target.value })} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setRows([...rows, { name: "", email: "" }])}>
          + Add person
        </button>
      </div>
      <p className="text-xs text-slate-400">New people start with nothing owed. Earlier expenses aren&apos;t re-split, so add them before adding their expenses.</p>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
    </div>
  );
}
