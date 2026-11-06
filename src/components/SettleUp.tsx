"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { on } from "@/lib/events";
import { fmt } from "@/lib/money";
import { groupStats } from "@/lib/stats";
import type { Group, PaymentRequest } from "@/lib/types";
import { api } from "./api";
import { Avatar, Dialog, Spinner } from "./ui";

type Log = { kind: string; detail: string; ok: boolean };

/**
 * Owns every PayPal payment action on the group screen (request, check, remind, cancel)
 * and their confirmation dialogs. It has no section of its own: the buttons live in the
 * banner and in each person's row of the Settlement overview, and trigger these via events.
 */
export default function SettleUp({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const [err, setErr] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<PaymentRequest | null>(null);

  const s = groupStats(group);
  const toRequest = s.balances.filter((b) => b.requestableCents > 0);
  const member = (id: string) => group.members.find((m) => m.id === id);

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setErr("");
    setLog([]);
    try {
      const r = await api<{ group: Group; log: Log[] }>(`/api/groups/${group.id}/requests`, { method: "POST", body });
      onChange(r.group);
      setLog(r.log.length ? r.log : [{ kind: "info", detail: "Everything is up to date. No status changed in PayPal.", ok: true }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  // Auto-hide the result notification.
  useEffect(() => {
    if (!log.length && !err) return;
    const t = setTimeout(() => (setLog([]), setErr("")), 7000);
    return () => clearTimeout(t);
  }, [log, err]);

  const latest = useRef({ canSend: toRequest.length > 0, act, group });
  latest.current = { canSend: toRequest.length > 0, act, group };
  useEffect(() => {
    const offs = [
      on("request-payments", () => latest.current.canSend && setConfirmSend(true)),
      on("check-payments", () => void latest.current.act("refresh", { action: "refresh" })),
      on("remind-request", (id) => id && void latest.current.act(id, { action: "remind", requestId: id })),
      on("cancel-request", (id) => {
        const r = latest.current.group.requests.find((x) => x.id === id);
        if (r) setConfirmCancel(r);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const label = busy === "send" ? "Sending PayPal invoices…" : busy === "refresh" ? "Checking PayPal…" : busy ? "Talking to PayPal…" : "";

  return (
    <>
      {/* Result / progress notification */}
      {(label || log.length > 0 || err) && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0" role="status" aria-live="polite">
          <div className={`flex items-start gap-3 rounded-xl border bg-white p-3.5 text-sm shadow-lg ${err ? "border-red-200" : log.some((l) => !l.ok) ? "border-amber-200" : "border-line"}`}>
            {label ? (
              <>
                <Spinner className="mt-0.5 h-4 w-4 text-brand-600" />
                <p className="flex-1 text-ink">{label}</p>
              </>
            ) : (
              <>
                <ul className="flex-1 space-y-1">
                  {err && (
                    <li className="flex items-start gap-2 text-red-700">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {err}
                    </li>
                  )}
                  {log.map((l, i) => (
                    <li key={i} className={`flex items-start gap-2 ${l.ok ? "text-ink" : "text-amber-800"}`}>
                      {l.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />} {l.detail}
                    </li>
                  ))}
                </ul>
                <button className="text-slate-400 hover:text-ink" aria-label="Dismiss" onClick={() => (setLog([]), setErr(""))}>
                  <X className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        title="Send PayPal requests?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmSend(false)}>
              Not now
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setConfirmSend(false);
                act("send", { action: "send" });
              }}
            >
              Send {toRequest.length} invoice{toRequest.length === 1 ? "" : "s"}
            </button>
          </>
        }
      >
        <p>Each person gets a PayPal invoice from you for their share:</p>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {toRequest.map((b) => (
            <li key={b.member.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar id={b.member.id} name={b.member.name} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{b.member.name}</span>
                  <span className="block truncate text-xs">{b.member.email}</span>
                </span>
              </span>
              <span className="num text-sm font-semibold text-ink">{fmt(b.requestableCents, group.currency)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs">These amounts come from the ledger. The AI can&apos;t change them.</p>
      </Dialog>

      <Dialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        title="Cancel this PayPal request?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmCancel(null)}>
              Keep it
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                const r = confirmCancel!;
                setConfirmCancel(null);
                act(r.id, { action: "cancel", requestId: r.id });
              }}
            >
              Cancel request
            </button>
          </>
        }
      >
        {confirmCancel && (
          <p>
            PayPal will cancel the {fmt(confirmCancel.cents, group.currency)} invoice to <b className="text-ink">{member(confirmCancel.memberId)?.name}</b> and let them know. Their
            balance will show as owed again.
          </p>
        )}
      </Dialog>
    </>
  );
}
