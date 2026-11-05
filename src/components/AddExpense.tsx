"use client";

import { useRef, useState } from "react";
import { fmt, toCents } from "@/lib/money";
import type { ExpenseItem, ExpenseShare, Group } from "@/lib/types";
import { api } from "./api";

type Item = { name: string; amount: number };
type Receipt = {
  merchant: string;
  date: string;
  currency: string;
  items: { name: string; quantity: number; amount: number }[];
  tax: number;
  tip: number;
  total: number;
  confidence: string;
  notes: string;
};
type Plan = { items: { index: number; member_ids: string[]; weights: number[] }[]; tax_mode: "proportional" | "equal"; tip_mode: "proportional" | "equal"; explanation: string; warnings: string };
type Preview = { items: ExpenseItem[]; shares: ExpenseShare[] };

const EXAMPLES = ["Split everything equally", "Raj didn't drink, so no beer or wine for him", "Priya had two desserts, Sam skipped starters, tip split equally"];

export default function AddExpense({ group, onAdded }: { group: Group; onAdded: (g: Group) => void }) {
  const organizer = group.members.find((m) => m.isOrganizer) ?? group.members[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState<string>("");
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState(organizer.id);
  const [items, setItems] = useState<Item[]>([]);
  const [tax, setTax] = useState(0);
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState("");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"" | "reading" | "splitting" | "saving">("");
  const [err, setErr] = useState("");

  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";
  const subtotal = items.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  function reset() {
    setImg("");
    setDescription("");
    setItems([]);
    setTax(0);
    setTip(0);
    setNotes("");
    setInstruction("");
    setPlan(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr("");
    setPlan(null);
    setPreview(null);
    setImg(URL.createObjectURL(f));
    setBusy("reading");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api<Receipt>("/api/receipt", { method: "POST", form: fd });
      setDescription(r.merchant && r.merchant !== "Unknown" ? r.merchant : "Receipt");
      setItems(r.items.map((i) => ({ name: i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name, amount: i.amount })));
      setTax(r.tax);
      setTip(r.tip);
      setNotes(
        [r.notes, r.currency && r.currency !== group.currency ? `Receipt looks like ${r.currency}; amounts are recorded in ${group.currency}.` : ""]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function split() {
    setErr("");
    setBusy("splitting");
    try {
      const r = await api<{ plan: Plan; preview: Preview }>("/api/split", {
        method: "POST",
        body: { groupId: group.id, paidBy, instruction, items: items.filter((i) => i.name && i.amount), tax, tip },
      });
      setPlan(r.plan);
      setPreview(r.preview);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!plan) return;
    setBusy("saving");
    try {
      const valid = items.filter((i) => i.name && i.amount);
      const g = await api<Group>(`/api/groups/${group.id}/expenses`, {
        method: "POST",
        body: {
          description: description || "Shared expense",
          paidBy,
          items: valid.map((i) => ({ name: i.name, cents: toCents(i.amount) })),
          plan: plan.items,
          taxCents: toCents(tax),
          tipCents: toCents(tip),
          modes: { tax: plan.tax_mode, tip: plan.tip_mode },
          splitInstruction: instruction,
          aiExplanation: plan.explanation,
          source: img ? "receipt" : "manual",
        },
      });
      onAdded(g);
      reset();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Add an expense</h2>
        {(items.length > 0 || img) && (
          <button className="text-sm text-slate-500 hover:text-slate-800" onClick={reset}>
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[180px_1fr]">
        <div>
          <label
            className={`flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center text-sm ${
              img ? "border-slate-200" : "border-brand-500/40 bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="Receipt" className="h-full w-full object-cover" />
            ) : (
              <>
                <span className="text-3xl">📸</span>
                <span className="mt-2 font-semibold">Snap / upload receipt</span>
                <span className="text-xs opacity-70">AI reads every line</span>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {busy === "reading" && <p className="mt-2 animate-pulse text-center text-sm text-brand-700">Claude is reading the receipt…</p>}
          {!img && items.length === 0 && (
            <button className="mt-2 w-full text-xs font-semibold text-slate-500 hover:text-brand-600" onClick={() => setItems([{ name: "", amount: 0 }])}>
              or enter items manually
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">What was it?</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="label">Paid by</label>
                <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                  {group.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Items</label>
              <div className="max-h-64 space-y-1 overflow-auto pr-1">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="w-6 pt-2 text-right text-xs text-slate-400">{i}</span>
                    <input className="input" value={it.name} placeholder="Item" onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                    <input
                      className="input w-28 text-right"
                      type="number"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))}
                    />
                    <button className="px-2 text-slate-400 hover:text-rose-600" onClick={() => setItems(items.filter((_, k) => k !== i))}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-1 text-xs font-semibold text-brand-600" onClick={() => setItems([...items, { name: "", amount: 0 }])}>
                + item
              </button>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-sm">
                <span className="text-slate-500">Subtotal {subtotal.toFixed(2)}</span>
                <label className="flex items-center gap-1">
                  Tax <input className="input w-24 text-right" type="number" step="0.01" value={tax} onChange={(e) => setTax(parseFloat(e.target.value) || 0)} />
                </label>
                <label className="flex items-center gap-1">
                  Tip <input className="input w-24 text-right" type="number" step="0.01" value={tip} onChange={(e) => setTip(parseFloat(e.target.value) || 0)} />
                </label>
                <span className="font-bold">Total {(subtotal + tax + tip).toFixed(2)}</span>
              </div>
              {notes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">⚠ {notes}</p>}
            </div>

            <div>
              <label className="label">How should we split it? (plain English)</label>
              <textarea
                className="input min-h-[70px]"
                placeholder="e.g. Raj didn't drink, Priya pays double for dessert, tip split equally"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <div className="mt-1 flex flex-wrap gap-1">
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200" onClick={() => setInstruction(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-primary" onClick={split} disabled={!!busy || subtotal <= 0}>
              {busy === "splitting" ? "Working out the split…" : "✨ Split with AI"}
            </button>

            {plan && preview && (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <p className="text-sm">🤖 {plan.explanation}</p>
                {plan.warnings && <p className="mt-1 text-xs text-amber-700">Assumed: {plan.warnings}</p>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {preview.shares.map((s) => (
                    <div key={s.memberId} className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm">
                      <span>{name(s.memberId)}</span>
                      <b>{fmt(s.cents, group.currency)}</b>
                    </div>
                  ))}
                </div>
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer">Who shares each item</summary>
                  <ul className="mt-1 space-y-0.5">
                    {preview.items.map((it, i) => (
                      <li key={i}>
                        {it.name} ({fmt(it.cents, group.currency)}): {it.memberIds.map(name).join(", ")}
                      </li>
                    ))}
                  </ul>
                </details>
                <button className="btn-primary mt-3" onClick={save} disabled={!!busy}>
                  {busy === "saving" ? "Saving…" : "Save expense"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid place-items-center rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            Upload a receipt photo and Claude extracts the items, tax and tip. Then describe the split in your own words.
          </div>
        )}
      </div>
      {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
    </section>
  );
}
