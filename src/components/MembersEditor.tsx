"use client";

import { Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { duplicateEmailRows, memberProblems } from "@/lib/members";
import { fmt } from "@/lib/money";
import { expenseLock, resplitWithNewMembers } from "@/lib/split";
import type { Group, Member } from "@/lib/types";
import { api } from "./api";
import { Alert, Avatar, Dialog, Spinner } from "./ui";

type Row = { id?: string; name: string; email: string };

export default function MembersEditor({ group, open, onClose, onSaved }: { group: Group; open: boolean; onClose: () => void; onSaved: (g: Group) => void }) {
  const [rows, setRows] = useState<Row[]>(() => group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
  const [includeIn, setIncludeIn] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setRows(group.members.map((m) => ({ id: m.id, name: m.name, email: m.email })));
      setIncludeIn(new Set());
      setErr("");
    }
  }, [open, group.members]);

  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  // Validate exactly what will be saved: existing people plus any filled-in new rows.
  const toSave = rows.filter((r) => r.id || r.name.trim() || r.email.trim());
  const problems = memberProblems(toSave);
  const dupRows = duplicateEmailRows(rows);
  const newRows = toSave.filter((r) => !r.id);

  // Preview of re-splitting each existing expense with the new people (same maths the server runs).
  const options = useMemo(() => {
    if (!newRows.length) return [];
    const tempNew: Member[] = newRows.map((r, i) => ({ id: `new_${i}`, name: r.name || "New person", email: r.email, isOrganizer: false }));
    return [...group.expenses].reverse().map((e) => {
      const lock = expenseLock(group, e);
      const r = lock ? null : resplitWithNewMembers(e, group.members, tempNew);
      const each = r?.ok ? r.shares.filter((s) => s.memberId.startsWith("new_")).map((s) => s.cents) : [];
      return { e, lock, reason: r && !r.ok ? r.reason : null, each };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(newRows), group]);

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const chosen = options.filter((o) => includeIn.has(o.e.id) && !o.lock && !o.reason).map((o) => o.e.id);
      onSaved(await api<Group>(`/api/groups/${group.id}`, { method: "PATCH", body: { members: toSave, includeIn: chosen } }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setIncludeIn((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
        <Plus className="h-4 w-4" aria-hidden /> Add person
      </button>

      {newRows.length > 0 && group.expenses.length > 0 && (
        <div className="mt-4 rounded-lg border border-line">
          <div className="border-b border-line bg-slate-50/70 px-3 py-2.5">
            <p className="text-sm font-medium text-ink">Should {newRows.length > 1 ? "the new people" : newRows[0].name || "the new person"} share any existing expenses?</p>
            <p className="text-xs">Items everyone shared are re-split. Items only some people had stay as they are. Nothing is ticked unless you choose.</p>
          </div>
          <ul className="max-h-56 divide-y divide-line overflow-y-auto">
            {options.map(({ e, lock, reason, each }) => {
              const disabled = !!lock || !!reason;
              return (
                <li key={e.id}>
                  <label className={`flex items-center gap-3 px-3 py-2.5 ${disabled ? "opacity-60" : "cursor-pointer hover:bg-slate-50"}`}>
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" disabled={disabled} checked={includeIn.has(e.id)} onChange={() => toggle(e.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{e.description}</span>
                      <span className="block text-xs">
                        {fmt(e.totalCents, group.currency)} ·{" "}
                        {disabled ? (
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" aria-hidden /> {lock ?? reason}
                          </span>
                        ) : (
                          <>New share: {each.map((c) => fmt(c, group.currency)).join(", ")} each, and everyone else pays a bit less</>
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {newRows.length > 0 && group.expenses.length === 0 && <p className="mt-2 text-xs">New people will share expenses you add from now on.</p>}

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
