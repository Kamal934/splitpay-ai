"use client";

import { useMemo, useRef, useState } from "react";
import { fmt, toCents } from "@/lib/money";
import { computeShares, type PlanItem } from "@/lib/split";
import type { Group } from "@/lib/types";
import { api } from "./api";
import { Alert, Avatar, Badge, SectionHeader, Spinner } from "./ui";

type Item = { name: string; amount: number };
type Receipt = {
  merchant: string;
  date: string;
  currency: string;
  items: { name: string; quantity: number; amount: number }[];
  tax: number;
  tip: number;
  total: number;
  confidence: "high" | "medium" | "low";
  notes: string;
};
type Mode = "proportional" | "equal";
type Plan = { items: PlanItem[]; tax_mode: Mode; tip_mode: Mode; explanation: string; warnings: string; unmatched_names: string[] };

const EXAMPLES = ["Split everything equally", "Raj didn't drink, so no beer or wine for him", "Priya had both desserts, tip split equally"];
const READ_STEPS = ["Uploading image", "Reading line items", "Checking totals"];

export default function AddExpense({ group, onAdded }: { group: Group; onAdded: (g: Group) => void }) {
  const organizer = group.members.find((m) => m.isOrganizer) ?? group.members[0];
  const fileRef = useRef<HTMLInputElement>(null);
  const [img, setImg] = useState("");
  const [drag, setDrag] = useState(false);
  const [readStep, setReadStep] = useState(0);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [description, setDescription] = useState("");
  const [paidBy, setPaidBy] = useState(organizer.id);
  const [items, setItems] = useState<Item[]>([]);
  const [tax, setTax] = useState(0);
  const [tip, setTip] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<"" | "reading" | "splitting" | "saving">("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");

  const valid = useMemo(() => items.filter((i) => i.name.trim() && i.amount), [items]);
  const subtotal = valid.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const computedTotal = subtotal + tax + tip;
  const totalMatches = receipt ? Math.abs(computedTotal - receipt.total) < 0.015 : null;

  // Live, deterministic share calculation (the same function the server uses).
  const preview = useMemo(() => {
    if (!plan) return null;
    const cents = valid.map((i) => ({ name: i.name, cents: toCents(i.amount) }));
    const modes = { tax: plan.tax_mode, tip: plan.tip_mode };
    const full = computeShares(cents, plan.items, toCents(tax), toCents(tip), modes, group.members);
    const itemsOnly = computeShares(cents, plan.items, 0, 0, modes, group.members);
    const withTax = computeShares(cents, plan.items, toCents(tax), 0, modes, group.members);
    const get = (arr: { memberId: string; cents: number }[], id: string) => arr.find((s) => s.memberId === id)?.cents ?? 0;
    const rows = group.members.map((m) => {
      const i = get(itemsOnly.shares, m.id);
      const t = get(withTax.shares, m.id) - i;
      const total = get(full.shares, m.id);
      return { member: m, items: i, tax: t, tip: total - i - t, total };
    });
    return { items: full.items, rows, sum: rows.reduce((a, r) => a + r.total, 0) };
  }, [plan, valid, tax, tip, group.members]);

  function reset() {
    setImg("");
    setReceipt(null);
    setDescription("");
    setItems([]);
    setTax(0);
    setTip(0);
    setInstruction("");
    setPlan(null);
    setErr("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Please choose an image file (JPG, PNG or WEBP).");
    reset();
    setSaved("");
    setImg(URL.createObjectURL(f));
    setBusy("reading");
    setReadStep(0);
    const t1 = setTimeout(() => setReadStep(1), 700);
    const t2 = setTimeout(() => setReadStep(2), 5000);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api<Receipt>("/api/receipt", { method: "POST", form: fd });
      setReceipt(r);
      setDescription(r.merchant && r.merchant !== "Unknown" ? r.merchant : "Receipt");
      setItems(r.items.map((i) => ({ name: i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name, amount: i.amount })));
      setTax(r.tax);
      setTip(r.tip);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      setBusy("");
    }
  }

  async function split() {
    setErr("");
    setBusy("splitting");
    try {
      const r = await api<{ plan: Plan }>("/api/split", {
        method: "POST",
        body: { groupId: group.id, paidBy, instruction, items: valid, tax, tip },
      });
      setPlan(r.plan);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  /** Toggle a member on an item. Keeps at least one person on every item. */
  function toggle(index: number, memberId: string) {
    if (!plan) return;
    const everyone = group.members.map((m) => m.id);
    const items = plan.items.some((p) => p.index === index) ? plan.items : [...plan.items, { index, member_ids: everyone, weights: everyone.map(() => 1) }];
    setPlan({
      ...plan,
      items: items.map((p) => {
        if (p.index !== index) return p;
        const at = p.member_ids.indexOf(memberId);
        if (at >= 0) {
          if (p.member_ids.length === 1) return p;
          return { ...p, member_ids: p.member_ids.filter((_, k) => k !== at), weights: p.weights.filter((_, k) => k !== at) };
        }
        return { ...p, member_ids: [...p.member_ids, memberId], weights: [...p.weights, 1] };
      }),
    });
  }

  async function save() {
    if (!plan || !preview) return;
    setBusy("saving");
    try {
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
      setSaved(`“${description || "Expense"}” saved · ${fmt(preview.sum, group.currency)} split between ${preview.rows.filter((r) => r.total).length} people`);
      reset();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const editItems = (fn: (x: Item[]) => Item[]) => {
    setItems(fn);
    setPlan(null); // items changed, so the old assignment no longer applies
  };

  const hasDraft = items.length > 0 || !!img;

  return (
    <section className="card">
      <div className="card-pad border-b border-line">
        <SectionHeader
          title="Add an expense"
          description="Scan a receipt or enter items, then describe the split in plain English."
          actions={
            hasDraft && (
              <button className="btn-ghost" onClick={reset}>
                Discard
              </button>
            )
          }
        />
      </div>

      <div className="card-pad space-y-6">
        {saved && !hasDraft && <Alert tone="success">✓ {saved}</Alert>}

        {/* Step 1: receipt */}
        {!hasDraft ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors ${
              drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
            }`}
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-line">🧾</div>
            <p className="mt-3 text-sm font-medium text-ink">Drop a receipt photo here</p>
            <p className="mt-1 text-xs text-muted">JPG, PNG or WEBP, up to 5 MB. Claude reads every line, tax and tip.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn-primary" onClick={() => fileRef.current?.click()}>
                Upload receipt
              </button>
              <button className="btn-secondary" onClick={() => setItems([{ name: "", amount: 0 }])}>
                Enter manually
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[160px_1fr]">
            <div>
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="Receipt preview" className="aspect-[3/4] w-full rounded-lg border border-line object-cover" />
              ) : (
                <div className="grid aspect-[3/4] place-items-center rounded-lg border border-dashed border-line text-xs text-muted">Manual entry</div>
              )}
              {receipt && (
                <div className="mt-2">
                  <Badge tone={receipt.confidence === "high" ? "success" : receipt.confidence === "medium" ? "warning" : "danger"}>
                    {receipt.confidence === "high" ? "✓" : "!"} {receipt.confidence} confidence
                  </Badge>
                </div>
              )}
            </div>

            {busy === "reading" ? (
              <div className="space-y-4 py-2">
                <ol className="space-y-2.5">
                  {READ_STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5 text-sm">
                      {i < readStep ? (
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-success text-[11px] text-white">✓</span>
                      ) : i === readStep ? (
                        <Spinner className="h-5 w-5 text-brand-600" />
                      ) : (
                        <span className="h-5 w-5 rounded-full border border-line" />
                      )}
                      <span className={i <= readStep ? "text-ink" : "text-muted"}>{s}</span>
                    </li>
                  ))}
                </ol>
                <div className="space-y-2">
                  {[80, 64, 72, 56].map((w) => (
                    <div key={w} className="h-8 animate-pulse rounded-md bg-slate-100" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="min-w-0 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="desc">
                      Expense
                    </label>
                    <input id="desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Dinner at…" />
                  </div>
                  <div>
                    <label className="label" htmlFor="payer">
                      Paid by
                    </label>
                    <select id="payer" className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                      {group.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full">
                    <thead className="bg-slate-50/70">
                      <tr>
                        <th className="th">Item</th>
                        <th className="th w-32 text-right">Amount</th>
                        <th className="th w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((it, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <input
                              className="input h-8 border-transparent shadow-none hover:border-line"
                              value={it.name}
                              placeholder="Item name"
                              onChange={(e) => editItems((x) => x.map((y, k) => (k === i ? { ...y, name: e.target.value } : y)))}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              className="input num h-8 border-transparent text-right shadow-none hover:border-line"
                              type="number"
                              step="0.01"
                              value={it.amount}
                              onChange={(e) => editItems((x) => x.map((y, k) => (k === i ? { ...y, amount: parseFloat(e.target.value) || 0 } : y)))}
                            />
                          </td>
                          <td className="pr-2 text-right">
                            <button
                              className="btn-ghost h-7 px-2 text-slate-400 hover:text-danger"
                              aria-label={`Remove ${it.name || "item"}`}
                              onClick={() => editItems((x) => x.filter((_, k) => k !== i))}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t border-line px-2 py-1.5">
                    <button className="btn-ghost text-brand-700" onClick={() => editItems((x) => [...x, { name: "", amount: 0 }])}>
                      + Add item
                    </button>
                  </div>
                </div>

                <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal</span>
                    <span className="num">{fmt(toCents(subtotal), group.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-muted">
                    <label htmlFor="tax">Tax & service</label>
                    <input id="tax" className="input num h-8 w-24 text-right" type="number" step="0.01" value={tax} onChange={(e) => setTax(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-muted">
                    <label htmlFor="tip">Tip</label>
                    <input id="tip" className="input num h-8 w-24 text-right" type="number" step="0.01" value={tip} onChange={(e) => setTip(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                    <span>Total</span>
                    <span className="num">{fmt(toCents(computedTotal), group.currency)}</span>
                  </div>
                  {receipt && (
                    <p className={`text-xs ${totalMatches ? "text-success" : "text-warning"}`}>
                      {totalMatches
                        ? `✓ Matches the receipt total of ${fmt(toCents(receipt.total), group.currency)}`
                        : `! Receipt says ${fmt(toCents(receipt.total), group.currency)}, so check the items above`}
                    </p>
                  )}
                </div>
                {receipt?.notes && <Alert tone="info">{receipt.notes}</Alert>}
              </div>
            )}
          </div>
        )}

        {/* Step 2: AI split instruction */}
        {items.length > 0 && busy !== "reading" && (
          <div className="rounded-xl border border-line bg-slate-50/50 p-4">
            <label className="label" htmlFor="instr">
              How should it be split?
            </label>
            <div className="relative">
              <textarea
                id="instr"
                className="textarea min-h-[84px] pb-12"
                placeholder="e.g. Raj didn't drink, Priya pays for both desserts, tip split equally"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && subtotal > 0) split();
                }}
              />
              <button className="btn-primary absolute bottom-2 right-2 h-8 px-3" onClick={split} disabled={!!busy || subtotal <= 0}>
                {busy === "splitting" ? <Spinner /> : <span aria-hidden>✦</span>}
                {busy === "splitting" ? "Splitting…" : "Split with AI"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  className="rounded-md border border-line bg-white px-2 py-1 text-xs text-muted transition-colors hover:border-brand-200 hover:text-brand-700"
                  onClick={() => setInstruction(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: assignment + shares */}
        {plan && preview && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs text-white" aria-hidden>
                ✦
              </span>
              <div className="text-sm">
                <p className="text-ink">{plan.explanation}</p>
                {plan.warnings && <p className="mt-1 text-xs text-muted">Assumed: {plan.warnings}</p>}
              </div>
            </div>

            {plan.unmatched_names.length > 0 && (
              <Alert tone="danger">
                <b>{plan.unmatched_names.join(", ")}</b> {plan.unmatched_names.length > 1 ? "aren't" : "isn't"} in this group, so nothing was assigned to them. Add them under{" "}
                <b>People & emails</b>, then split again.
              </Alert>
            )}

            <div>
              <p className="label">Who shares each item (click an avatar to include or exclude someone)</p>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-slate-50/70">
                    <tr>
                      <th className="th">Item</th>
                      <th className="th text-right">Amount</th>
                      <th className="th">Shared by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.items.map((it, i) => {
                      const p = plan.items.find((x) => x.index === i);
                      return (
                        <tr key={i}>
                          <td className="td max-w-[240px] truncate text-ink" title={it.name}>
                            {it.name}
                          </td>
                          <td className="td num text-right text-muted">{fmt(it.cents, group.currency)}</td>
                          <td className="td">
                            <div className="flex flex-wrap gap-1.5">
                              {group.members.map((m) => {
                                const on = it.memberIds.includes(m.id);
                                const w = p ? p.weights[p.member_ids.indexOf(m.id)] : 1;
                                return (
                                  <button
                                    key={m.id}
                                    onClick={() => toggle(i, m.id)}
                                    aria-pressed={on}
                                    title={`${on ? "Remove" : "Add"} ${m.name}`}
                                    className={`relative rounded-full transition ${on ? "" : "opacity-30 grayscale hover:opacity-60"}`}
                                  >
                                    <Avatar id={m.id} name={m.name} size="sm" />
                                    {on && w > 1 && <span className="absolute -right-1 -top-1 rounded-full bg-ink px-1 text-[9px] font-semibold text-white">×{w}</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              {(["tax", "tip"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-muted">
                  {k === "tax" ? "Tax & service" : "Tip"} split
                  <select
                    className="input h-8 w-auto"
                    value={k === "tax" ? plan.tax_mode : plan.tip_mode}
                    onChange={(e) => setPlan({ ...plan, [k === "tax" ? "tax_mode" : "tip_mode"]: e.target.value as Mode })}
                  >
                    <option value="proportional">by what each person had</option>
                    <option value="equal">equally</option>
                  </select>
                </label>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {preview.rows
                .filter((r) => r.total > 0)
                .map((r) => (
                  <div key={r.member.id} className="rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar id={r.member.id} name={r.member.name} size="sm" />
                        <span className="truncate text-sm font-medium text-ink">{r.member.name}</span>
                      </span>
                      <span className="num text-base font-semibold text-ink">{fmt(r.total, group.currency)}</span>
                    </div>
                    <p className="num mt-1.5 text-xs text-muted">
                      Items {fmt(r.items, group.currency)} · Tax {fmt(r.tax, group.currency)} · Tip {fmt(r.tip, group.currency)}
                    </p>
                  </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className={`text-sm ${preview.sum === toCents(computedTotal) ? "text-success" : "text-danger"}`}>
                {preview.sum === toCents(computedTotal)
                  ? `✓ Shares add up to exactly ${fmt(preview.sum, group.currency)}`
                  : `Shares total ${fmt(preview.sum, group.currency)}, which doesn't match ${fmt(toCents(computedTotal), group.currency)}`}
              </p>
              <button className="btn-primary" onClick={save} disabled={!!busy || plan.unmatched_names.length > 0}>
                {busy === "saving" && <Spinner />} Save expense
              </button>
            </div>
          </div>
        )}

        {err && <Alert>{err}</Alert>}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </section>
  );
}
