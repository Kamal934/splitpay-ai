"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/lib/types";
import { duplicateEmailRows, memberProblems } from "@/lib/members";
import { api } from "./api";
import { Alert, Avatar, Dialog, Spinner } from "./ui";

type Row = { id?: string; name: string; email: string };

export default function MembersEditor({ group, open, onClose, onSaved }: { group: Group; open: boolean; onClose: () => void; onSaved: (g: Group) => void }) {
  const [rows, setRows] = useState<Row[]>(() => group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setRows(group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
      setErr("");
    }
  }, [open, group.members]);

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
  // Validate exactly what will be saved: existing people plus any filled-in new rows.
  const toSave = rows.filter((r) => r.id || r.name.trim() || r.email.trim());
  const problems = memberProblems(toSave);
  const dupRows = duplicateEmailRows(rows);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="People & emails"
      wide
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || problems.length > 0}>
            {busy && <Spinner />} Save changes
          </button>
        </>
      }
    >
      <p>PayPal invoices go to these emails. For the demo, use your PayPal sandbox personal accounts so you can log in and pay.</p>
      <div className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <div key={r.id ?? `new-${i}`} className="flex items-center gap-2">
            <Avatar id={r.id} name={r.name || "?"} size="sm" />
            <input className="input" placeholder="Name" aria-label="Name" value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            <input
              className={`input ${dupRows.has(i) ? "border-danger ring-3 ring-red-100" : ""}`}
              type="email"
              placeholder="PayPal email"
              aria-label="PayPal email"
              aria-invalid={dupRows.has(i)}
              value={r.email}
              onChange={(e) => set(i, { email: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn-ghost -ml-2.5 mt-2 text-brand-700" onClick={() => setRows([...rows, { name: "", email: "" }])}>
        + Add person
      </button>
      <p className="mt-2 text-xs">New people start with nothing owed. Earlier expenses aren&apos;t re-split, so add people before adding their expenses.</p>
      {problems.length > 0 && (
        <div className="mt-3">
          <Alert tone="warning">
            <ul className="space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      {err && (
        <div className="mt-3">
          <Alert>{err}</Alert>
        </div>
      )}
    </Dialog>
  );
}
