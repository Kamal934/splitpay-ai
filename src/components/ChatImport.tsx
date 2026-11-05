"use client";

import { CircleAlert, ClipboardPaste, EyeOff, FileText, MessageSquareText, Quote, Sparkles } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { fmt, toCents } from "@/lib/money";
import { SAMPLE_CHAT } from "@/lib/samples";
import { computeShares } from "@/lib/split";
import type { Group } from "@/lib/types";
import { api } from "./api";
import { Alert, Avatar, Badge, Spinner } from "./ui";

type Extracted = {
  expenses: {
    description: string;
    amount: number;
    currency: string;
    paid_by_member_id: string;
    shared_with_member_ids: string[];
    weights: number[];
    quote: string;
    confidence: "high" | "medium" | "low";
    note: string;
  }[];
  ignored: { quote: string; reason: string }[];
  unmatched_names: string[];
};

type Row = {
  include: boolean;
  description: string;
  amount: number;
  paidBy: string;
  memberIds: string[];
  weights: number[];
  quote: string;
  confidence: "high" | "medium" | "low";
  note: string;
  currency: string;
};

export default function ChatImport({
  group,
  onDone,
  onCancel,
  initialText = "",
}: {
  group: Group;
  onDone: (g: Group, count: number) => void;
  onCancel: () => void;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pasteClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) setText(t);
      else setErr("Your clipboard is empty. Copy the messages in WhatsApp first.");
    } catch {
      setErr("Couldn't read the clipboard. Long-press in the box below and choose Paste instead.");
    }
  }

  async function openFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return setErr("That file is too big. Export the chat without media.");
    setText((await f.text()).slice(0, 20000));
  }
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ignored, setIgnored] = useState<Extracted["ignored"]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "reading" | "saving">("");
  const [err, setErr] = useState("");
  const everyone = group.members.map((m) => m.id);

  async function read() {
    setErr("");
    setBusy("reading");
    try {
      const r = await api<Extracted>("/api/chat-import", { method: "POST", body: { groupId: group.id, text } });
      setRows(
        r.expenses.map((e) => ({
          include: e.amount > 0,
          description: e.description,
          amount: e.amount,
          paidBy: e.paid_by_member_id,
          memberIds: e.shared_with_member_ids.length ? e.shared_with_member_ids : everyone,
          weights: e.shared_with_member_ids.length ? e.weights : everyone.map(() => 1),
          quote: e.quote,
          confidence: e.confidence,
          note: e.note,
          currency: e.currency,
        })),
      );
      setIgnored(r.ignored);
      setUnmatched(r.unmatched_names);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  function toggleMember(i: number, id: string) {
    const r = rows![i];
    const at = r.memberIds.indexOf(id);
    if (at >= 0) {
      if (r.memberIds.length === 1) return;
      set(i, { memberIds: r.memberIds.filter((_, k) => k !== at), weights: r.weights.filter((_, k) => k !== at) });
    } else set(i, { memberIds: [...r.memberIds, id], weights: [...r.weights, 1] });
  }

  const chosen = (rows ?? []).filter((r) => r.include);
  const invalid = chosen.filter((r) => !r.paidBy || !(r.amount > 0) || !r.description.trim());

  // Live per-person impact using the same deterministic split as everywhere else.
  const impact = useMemo(() => {
    const per = new Map<string, number>();
    for (const r of chosen) {
      if (!r.paidBy || !(r.amount > 0)) continue;
      const { shares } = computeShares(
        [{ name: r.description, cents: toCents(r.amount) }],
        [{ index: 0, member_ids: r.memberIds, weights: r.weights }],
        0,
        0,
        { tax: "proportional", tip: "proportional" },
        group.members,
      );
      for (const s of shares) per.set(s.memberId, (per.get(s.memberId) ?? 0) + s.cents);
    }
    return group.members.map((m) => ({ member: m, cents: per.get(m.id) ?? 0 })).filter((x) => x.cents > 0);
  }, [chosen, group.members]);

  async function save() {
    setBusy("saving");
    setErr("");
    try {
      const g = await api<Group>(`/api/groups/${group.id}/expenses`, {
        method: "POST",
        body: {
          expenses: chosen.map((r) => ({
            description: r.description.trim(),
            paidBy: r.paidBy,
            items: [{ name: r.description.trim(), cents: toCents(r.amount) }],
            plan: [{ index: 0, member_ids: r.memberIds, weights: r.weights }],
            taxCents: 0,
            tipCents: 0,
            modes: { tax: "proportional", tip: "proportional" },
            splitInstruction: `From group chat: ${r.quote}`.slice(0, 500),
            aiExplanation: r.note || "Imported from the group chat",
            source: "manual",
          })),
        },
      });
      onDone(g, chosen.length);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (!rows)
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="label mb-0" htmlFor="chat">
            Paste messages from your group chat
          </label>
          <div className="flex flex-wrap gap-1">
            <button className="btn-ghost" onClick={pasteClipboard}>
              <ClipboardPaste className="h-4 w-4" aria-hidden /> Paste
            </button>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
              <FileText className="h-4 w-4" aria-hidden /> Open .txt
            </button>
            <button className="btn-ghost text-brand-700" onClick={() => setText(SAMPLE_CHAT)}>
              Use sample chat
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => openFile(e.target.files?.[0])} />
        </div>
        <textarea
          id="chat"
          className="textarea num min-h-[180px] font-mono text-xs leading-relaxed"
          placeholder={"[06/11/26, 09:14] Raj: Filled petrol, $40\n[06/11/26, 12:30] Sam: got snacks for everyone, 18"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-xs text-muted">
          WhatsApp: open the chat, then Export chat → Without media. On Android, share it straight to SplitPay; on iPhone, save it to Files and use Open .txt, or copy the messages and tap Paste. Claude finds who paid for what. You review everything before it&apos;s saved.
        </p>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!text.trim() || !!busy} onClick={read}>
            {busy === "reading" ? <Spinner /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {busy === "reading" ? "Reading chat…" : "Find expenses"}
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-white" aria-hidden>
          <MessageSquareText className="h-4 w-4" />
        </span>
        <p className="text-ink">
          Found <b>{rows.length}</b> expense{rows.length === 1 ? "" : "s"}
          {ignored.length > 0 && (
            <>
              {" "}
              and skipped <b>{ignored.length}</b> message{ignored.length === 1 ? "" : "s"} that weren&apos;t shared expenses
            </>
          )}
          . Check each row, then add the ones you want.
        </p>
      </div>

      {unmatched.length > 0 && (
        <Alert tone="warning">
          <span className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
            {unmatched.join(", ")} {unmatched.length > 1 ? "aren't" : "isn't"} in this group. Add them under People &amp; emails if they should share costs.
          </span>
        </Alert>
      )}

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted">No shared expenses found in that chat.</p>}
        {rows.map((r, i) => (
          <div key={i} className={`rounded-lg border p-3 transition-opacity ${r.include ? "border-line bg-white" : "border-dashed border-line bg-slate-50 opacity-60"}`}>
            <div className="flex flex-wrap items-start gap-3">
              <input type="checkbox" className="mt-2.5 h-4 w-4 accent-brand-600" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} aria-label={`Include ${r.description}`} />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_120px_180px]">
                <input className="input" value={r.description} onChange={(e) => set(i, { description: e.target.value })} aria-label="Description" />
                <input
                  className="input num text-right"
                  type="number"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) => set(i, { amount: parseFloat(e.target.value) || 0 })}
                  aria-label="Amount"
                />
                <select className={`input ${r.include && !r.paidBy ? "border-danger" : ""}`} value={r.paidBy} onChange={(e) => set(i, { paidBy: e.target.value })} aria-label="Paid by">
                  <option value="">Who paid?</option>
                  {group.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      Paid by {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 pl-7">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-muted">Shared by</span>
                {group.members.map((m) => {
                  const on = r.memberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMember(i, m.id)}
                      aria-pressed={on}
                      title={`${on ? "Remove" : "Add"} ${m.name}`}
                      className={`rounded-full transition ${on ? "" : "opacity-30 grayscale hover:opacity-60"}`}
                    >
                      <Avatar id={m.id} name={m.name} size="sm" />
                    </button>
                  );
                })}
              </div>
              <Badge tone={r.confidence === "high" ? "success" : r.confidence === "medium" ? "warning" : "danger"}>
                <span className="capitalize">{r.confidence}</span> confidence
              </Badge>
            </div>
            <p className="mt-2 flex gap-1.5 pl-7 text-xs text-muted">
              <Quote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span className="italic">{r.quote}</span>
            </p>
            {r.note && <p className="mt-1 pl-7 text-xs text-muted">Assumed: {r.note}</p>}
            {r.currency && r.currency !== group.currency && (
              <p className="mt-1 pl-7 text-xs text-warning">Written in {r.currency}; it will be recorded as {group.currency}.</p>
            )}
          </div>
        ))}
      </div>

      {ignored.length > 0 && (
        <details className="rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-xs text-muted">
          <summary className="flex cursor-pointer items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" aria-hidden /> Skipped messages ({ignored.length})
          </summary>
          <ul className="mt-2 space-y-1.5">
            {ignored.map((x, i) => (
              <li key={i}>
                <span className="italic">“{x.quote}”</span> · {x.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      {impact.length > 0 && (
        <div>
          <p className="label">What each person&apos;s share goes up by</p>
          <div className="flex flex-wrap gap-2">
            {impact.map((x) => (
              <span key={x.member.id} className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <Avatar id={x.member.id} name={x.member.name} size="sm" />
                {x.member.name}
                <b className="num text-ink">{fmt(x.cents, group.currency)}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {invalid.length > 0 && <Alert tone="warning">Pick who paid for every ticked row before adding.</Alert>}
      {err && <Alert>{err}</Alert>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <button className="btn-secondary" onClick={() => setRows(null)} disabled={!!busy}>
          Back to chat
        </button>
        <button className="btn-primary" onClick={save} disabled={!!busy || chosen.length === 0 || invalid.length > 0}>
          {busy === "saving" && <Spinner />} Add {chosen.length} expense{chosen.length === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
