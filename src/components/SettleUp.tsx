"use client";

import { useState } from "react";
import { computeBalances, fmt, simplifyDebts } from "@/lib/money";
import type { Group, PaymentRequest } from "@/lib/types";
import { OPEN_STATUSES, PAID_STATUSES } from "@/lib/types";
import { api } from "./api";

type Log = { kind: string; detail: string; ok: boolean };

const badge = (s: PaymentRequest["status"]) =>
  PAID_STATUSES.includes(s)
    ? "bg-emerald-100 text-emerald-800"
    : s === "ERROR" || s === "CANCELLED"
      ? "bg-rose-100 text-rose-800"
      : "bg-amber-100 text-amber-800";

export default function SettleUp({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<Log[]>([]);
  const [err, setErr] = useState("");
  const balances = computeBalances(group);
  const transfers = simplifyDebts(balances);
  const toRequest = balances.filter((b) => b.requestableCents > 0);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  async function act(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setErr("");
    try {
      const r = await api<{ group: Group; log: Log[] }>(`/api/groups/${group.id}/requests`, { method: "POST", body });
      onChange(r.group);
      setLog(r.log.length ? r.log : [{ kind: "info", detail: "No changes", ok: true }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const requests = [...group.requests].reverse();

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Settle up with PayPal</h2>
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!!busy || !group.requests.some((r) => OPEN_STATUSES.includes(r.status))} onClick={() => act("refresh", { action: "refresh" })}>
            {busy === "refresh" ? "Checking…" : "↻ Check payments"}
          </button>
          <button className="btn-primary" disabled={!!busy || toRequest.length === 0} onClick={() => act("send", { action: "send" })}>
            {busy === "send" ? "Sending invoices…" : `Send PayPal requests (${toRequest.length})`}
          </button>
        </div>
      </div>

      {transfers.length === 0 ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">🎉 Everyone is settled up.</p>
      ) : (
        <ul className="mb-4 grid gap-2 sm:grid-cols-2">
          {transfers.map((t, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span>
                <b>{t.from.name}</b> → {t.to.name}
              </span>
              <b>{fmt(t.cents, group.currency)}</b>
            </li>
          ))}
        </ul>
      )}

      {requests.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Person</th>
                <th>Amount</th>
                <th>PayPal status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 font-medium">{name(r.memberId)}</td>
                  <td>{fmt(r.cents, group.currency)}</td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge(r.status)}`} title={r.error}>
                      {r.status.replaceAll("_", " ")}
                    </span>
                    {r.remindersSent > 0 && <span className="ml-1 text-xs text-slate-400">· {r.remindersSent} reminder(s)</span>}
                    {r.error && <p className="max-w-xs truncate text-xs text-rose-600">{r.error}</p>}
                  </td>
                  <td className="space-x-2 text-right whitespace-nowrap">
                    {r.payerUrl && (
                      <a className="text-xs font-semibold text-brand-600 hover:underline" href={r.payerUrl} target="_blank" rel="noreferrer">
                        Payer link ↗
                      </a>
                    )}
                    {OPEN_STATUSES.includes(r.status) && (
                      <>
                        <button className="text-xs font-semibold text-slate-600 hover:text-brand-600" disabled={!!busy} onClick={() => act(r.id, { action: "remind", requestId: r.id })}>
                          Remind
                        </button>
                        <button className="text-xs font-semibold text-slate-400 hover:text-rose-600" disabled={!!busy} onClick={() => act(r.id, { action: "cancel", requestId: r.id })}>
                          Cancel
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {log.map((l, i) => (
            <li key={i} className={l.ok ? "text-emerald-700" : "text-rose-700"}>
              {l.ok ? "✓" : "✗"} {l.detail}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      <p className="mt-3 text-xs text-slate-400">
        Each person gets a PayPal invoice from the organiser for exactly what the ledger says they owe. Amounts can’t be changed by the AI.
      </p>
    </section>
  );
}
