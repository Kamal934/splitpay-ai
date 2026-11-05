"use client";

import { useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";

export default function MembersEditor({ group, onSaved }: { group: Group; onSaved: (g: Group) => void }) {
  const [rows, setRows] = useState(group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      onSaved(await api<Group>(`/api/groups/${group.id}`, { method: "PATCH", body: { members: rows } }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-slate-600">
        Tip for the demo: use your <b>PayPal sandbox personal account</b> emails so you can log in as each friend and pay the invoice.
      </p>
      {rows.map((r, i) => (
        <div key={r.id} className="flex gap-2">
          <input className="input" value={r.name} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
          <input className="input" value={r.email} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))} />
        </div>
      ))}
      <button className="btn-primary" onClick={save} disabled={busy}>
        Save
      </button>
    </div>
  );
}
