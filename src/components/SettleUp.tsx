"use client";

import { ArrowRight, CircleAlert, CircleCheck, ExternalLink, RefreshCw, Send } from "lucide-react";
import { useState } from "react";
import { fmt, simplifyDebts } from "@/lib/money";
import { groupStats, timeAgo } from "@/lib/stats";
import type { Group, PaymentRequest } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/types";
import { api } from "./api";
import { Alert, Avatar, Dialog, EmptyState, SectionHeader, Spinner, StatusBadge } from "./ui";

type Log = { kind: string; detail: string; ok: boolean };

export default function SettleUp({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const [err, setErr] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<PaymentRequest | null>(null);

  const s = groupStats(group);
  const transfers = simplifyDebts(s.balances);
  const toRequest = s.balances.filter((b) => b.requestableCents > 0);
  const member = (id: string) => group.members.find((m) => m.id === id);
  const hasOpen = group.requests.some((r) => OPEN_STATUSES.includes(r.status));
  const requests = [...group.requests].reverse();

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setErr("");
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

  return (
    <section className="card">
      <div className="card-pad border-b border-line">
        <SectionHeader
          title="PayPal payments"
          description="Each person gets a PayPal invoice for exactly what the ledger says they owe."
          actions={
            <>
              <button className="btn-secondary" disabled={!!busy || !hasOpen} onClick={() => act("refresh", { action: "refresh" })}>
                {busy === "refresh" ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />} Check payments
              </button>
              <button className="btn-primary" disabled={!!busy || toRequest.length === 0} onClick={() => setConfirmSend(true)}>
                {busy === "send" ? <Spinner /> : <Send className="h-4 w-4" aria-hidden />} Request {toRequest.length > 0 ? fmt(s.notRequested, group.currency) : "payments"}
              </button>
            </>
          }
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
        {[
          ["Requested", s.pending + s.collected, "text-ink"],
          ["Paid", s.collected, "text-success"],
          ["Pending", s.pending, "text-warning"],
          ["Not requested", s.notRequested, "text-ink"],
        ].map(([label, v, c]) => (
          <div key={label as string} className="px-5 py-4 sm:px-6">
            <p className="text-xs text-muted">{label as string}</p>
            <p className={`num mt-0.5 text-lg font-semibold ${c}`}>{fmt(v as number, group.currency)}</p>
          </div>
        ))}
      </div>

      {/* Who owes whom */}
      {transfers.length > 0 && (
        <div className="card-pad border-b border-line">
          <p className="label">Suggested settle-up</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Avatar id={t.from.id} name={t.from.name} size="sm" />
                  <span className="truncate font-medium text-ink">{t.from.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <span className="truncate text-muted">{t.to.name}</span>
                </span>
                <span className="num text-sm font-semibold text-ink">{fmt(t.cents, group.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invoice table */}
      {requests.length === 0 ? (
        <EmptyState
          icon={Send}
          title={transfers.length ? "No PayPal requests yet" : "Nothing to collect"}
          text={transfers.length ? "When you're ready, request payments and each person gets a PayPal invoice." : "Add an expense and anyone who owes you will show up here."}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-line bg-slate-50/70">
              <tr>
                <th className="th">Person</th>
                <th className="th text-right">Amount</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((r) => {
                const m = member(r.memberId);
                const open = OPEN_STATUSES.includes(r.status);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <Avatar id={r.memberId} name={m?.name ?? "?"} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{m?.name}</p>
                          <p className="truncate text-xs text-muted">{m?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td num text-right font-medium text-ink">{fmt(r.cents, group.currency)}</td>
                    <td className="td">
                      <StatusBadge status={r.status} title={r.error} />
                      <p className="mt-1 text-xs text-muted">
                        Updated {timeAgo(r.updatedAt)}
                        {r.remindersSent > 0 && ` · ${r.remindersSent} reminder${r.remindersSent > 1 ? "s" : ""}`}
                      </p>
                      {r.error && <p className="mt-1 max-w-[220px] truncate text-xs text-danger" title={r.error}>{r.error}</p>}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-0.5 whitespace-nowrap">
                        {r.payerUrl && (
                          <a className="btn-ghost px-2" title="Open the PayPal invoice" href={r.payerUrl} target="_blank" rel="noreferrer">
                            Invoice <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </a>
                        )}
                        {open && (
                          <>
                            <button className="btn-ghost px-2" disabled={!!busy} onClick={() => act(r.id, { action: "remind", requestId: r.id })}>
                              {busy === r.id ? <Spinner /> : null} Remind
                            </button>
                            <button className="btn-ghost px-2 hover:text-danger" disabled={!!busy} onClick={() => setConfirmCancel(r)}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(log.length > 0 || err) && (
        <div className="space-y-2 border-t border-line p-4">
          {log.length > 0 && (
            <Alert tone={log.every((l) => l.ok) ? "success" : "warning"}>
              <ul className="space-y-0.5">
                {log.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {l.ok ? <CircleCheck className="h-4 w-4 shrink-0" aria-hidden /> : <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />} {l.detail}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {err && <Alert>{err}</Alert>}
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
            PayPal will cancel the {fmt(confirmCancel.cents, group.currency)} invoice to <b className="text-ink">{member(confirmCancel.memberId)?.name}</b> and let them know.
            Their balance will show as owed again.
          </p>
        )}
      </Dialog>
    </section>
  );
}
