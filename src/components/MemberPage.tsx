"use client";

import { ChevronDown, CircleCheck, Clock, ExternalLink, ImageIcon, Plus, Receipt, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { MemberView } from "@/lib/access";
import { fmt } from "@/lib/money";
import type { Group } from "@/lib/types";
import { OPEN_STATUSES, PAID_STATUSES } from "@/lib/types";
import AddExpense from "./AddExpense";
import { api } from "./api";
import Logo from "./Logo";
import { Alert, Avatar, Badge, EmptyState, Spinner, StatusBadge } from "./ui";

type PayFn = (body: { expenseId?: string; all?: boolean }) => Promise<void>;

/** Payment control for my share of one receipt. Labels only reflect what PayPal/the ledger confirm. */
function ReceiptPay({ e, currency, onPay, busy }: { e: MemberView["expenses"][number]; currency: string; onPay: PayFn; busy: string }) {
  const p = e.pay;
  if (p.state === "none")
    return e.paidByMe ? (
      <Badge tone="brand">You paid this</Badge>
    ) : null;
  if (p.state === "paid")
    return (
      <Badge tone="success">
        <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Paid{p.viaAll ? " (in Pay all)" : ""}
      </Badge>
    );
  if (p.state === "pending")
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {p.viaAll ? "In your Pay all request" : "Payment pending"}
        </Badge>
        {p.payerUrl && !p.viaAll && (
          <a href={p.payerUrl} target="_blank" rel="noreferrer" className="btn-secondary h-8 px-3">
            Open PayPal <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </span>
    );
  if (p.state === "use_all") return <span className="text-xs text-muted">Bills you paid cover part of this, so use Pay all</span>;
  return (
    <button className="btn-primary h-8 px-3" disabled={!!busy} onClick={() => onPay({ expenseId: e.id })}>
      {busy === e.id ? <Spinner /> : <Wallet className="h-4 w-4" aria-hidden />} Pay {fmt(e.myShare, currency)}
    </button>
  );
}

function ReceiptCard({ e, currency, meId, onPay, busy }: { e: MemberView["expenses"][number]; currency: string; meId: string; onPay: PayFn; busy: string }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const date = new Date(e.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60" aria-expanded={open}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          {e.receiptUrl ? <ImageIcon className="h-5 w-5" aria-hidden /> : <Receipt className="h-5 w-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{e.description}</span>
          <span className="block text-xs text-muted">
            {e.paidByMe ? "You paid" : `${e.paidBy} paid`} {fmt(e.totalCents, currency)} · {date}
          </span>
        </span>
        <span className="text-right">
          <span className="num block text-sm font-semibold text-ink">{fmt(e.myShare, currency)}</span>
          <span className="block text-[11px] text-muted">your share</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {(e.pay.state !== "none" || e.paidByMe) && (
        <div className="flex items-center justify-end border-t border-line bg-slate-50/50 px-4 py-2">
          <ReceiptPay e={e} currency={currency} onPay={onPay} busy={busy} />
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {e.receiptUrl && (
            <button onClick={() => setZoom((z) => !z)} className="block" title={zoom ? "Shrink" : "Enlarge"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.receiptUrl} alt={`Receipt for ${e.description}`} className={`rounded-lg border border-line object-contain ${zoom ? "max-h-[80vh] w-full" : "max-h-48"}`} />
            </button>
          )}
          {e.explanation && <p className="rounded-lg bg-brand-50/60 px-3 py-2 text-sm text-ink">{e.explanation}</p>}

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[420px]">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">Price</th>
                  <th className="th">Shared by</th>
                  <th className="th text-right">You</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {e.items.map((it, i) => (
                  <tr key={i} className={it.myPart ? "" : "text-muted"}>
                    <td className="td max-w-[200px] truncate" title={it.name}>{it.name}</td>
                    <td className="td num text-right">{fmt(it.cents, currency)}</td>
                    <td className="td text-xs">{it.sharedBy.length > 3 ? `${it.sharedBy.length} people` : it.sharedBy.join(", ")}</td>
                    <td className="td num text-right font-medium">{it.myPart ? fmt(it.myPart, currency) : "–"}</td>
                  </tr>
                ))}
                {e.taxCents + e.tipCents > 0 && (
                  <tr>
                    <td className="td" colSpan={3}>Tax, service & tip</td>
                    <td className="td num text-right font-medium">{fmt(e.myExtras, currency)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-line bg-slate-50/70">
                <tr>
                  <td className="td font-semibold" colSpan={3}>Your share</td>
                  <td className="td num text-right font-semibold text-ink">{fmt(e.myShare, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <p className="label">Everyone&apos;s share</p>
            <div className="flex flex-wrap gap-2">
              {e.shares.map((s) => (
                <span key={s.name} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${s.isMe ? "border-brand-200 bg-brand-50" : "border-line"}`}>
                  <Avatar name={s.name} id={s.isMe ? meId : undefined} size="sm" />
                  {s.isMe ? "You" : s.name}
                  <b className="num text-ink">{fmt(s.cents, currency)}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MemberPage({ token }: { token: string }) {
  const [view, setView] = useState<MemberView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [payBusy, setPayBusy] = useState("");
  const [payErr, setPayErr] = useState("");

  const pay: PayFn = async (body) => {
    setPayBusy(body.expenseId ?? "all");
    setPayErr("");
    try {
      setView(await api<MemberView>(`/api/me/${token}/pay`, { method: "POST", body }));
    } catch (e) {
      setPayErr((e as Error).message);
    } finally {
      setPayBusy("");
    }
  };

  const load = useCallback(
    async (refresh = false) => {
      setBusy(refresh);
      try {
        setView(await api<MemberView>(`/api/me/${token}${refresh ? "?refresh=1" : ""}`));
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (err && !view)
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Logo />
        <div className="mt-8">
          <Alert>{err}</Alert>
        </div>
      </div>
    );
  if (!view) return <p className="mx-auto max-w-2xl px-4 py-10 text-muted">Loading…</p>;

  const c = view.group.currency;
  const open = view.requests.filter((r) => OPEN_STATUSES.includes(r.status));
  const paid = view.requests.filter((r) => PAID_STATUSES.includes(r.status));
  const owe = view.balance.requestableCents + view.balance.pendingCents;
  const getsBack = view.balance.netCents > 0 ? view.balance.netCents : 0;
  const pseudoGroup: Group = {
    id: view.group.id,
    name: view.group.name,
    currency: c,
    members: view.members.map((m) => ({ ...m, email: "" })),
    expenses: [],
    requests: [],
    createdAt: "",
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Logo href="#" />
          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">PayPal sandbox</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div>
          <p className="text-sm text-muted">{view.group.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Hi {view.me.name.split(" ")[0]}</h1>
        </div>

        {/* Summary + pay */}
        <section className="card card-pad">
          {owe > 0 ? (
            <>
              <p className="text-sm text-muted">You owe {view.organiser}</p>
              <p className="num mt-1 text-4xl font-semibold tracking-tight text-ink">{fmt(owe, c)}</p>
              <p className="mt-1 text-xs text-muted">
                Your share {fmt(view.balance.shareCents, c)}
                {view.balance.paidCents > 0 && <> · minus {fmt(view.balance.paidCents, c)} you paid</>}
                {paid.length > 0 && <> · minus {fmt(paid.reduce((a, r) => a + r.cents, 0), c)} already paid via PayPal</>}
              </p>
            </>
          ) : getsBack > 0 ? (
            <>
              <p className="text-sm text-muted">You paid more than your share</p>
              <p className="num mt-1 text-4xl font-semibold tracking-tight text-success">+{fmt(getsBack, c)}</p>
              <p className="mt-1 text-xs text-muted">{view.organiser} will settle this with you.</p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-success">
                <CircleCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-ink">You&apos;re all settled</p>
                <p className="text-sm text-muted">Nothing to pay right now.</p>
              </div>
            </div>
          )}

          {open.length > 0 && (
            <div className="mt-5 space-y-2">
              {open.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-3">
                  <span className="flex items-center gap-2">
                    <span className="num font-semibold text-ink">{fmt(r.cents, c)}</span>
                    <span className="text-xs text-muted">{r.label ?? "All receipts"}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  {r.payerUrl && (
                    <a href={r.payerUrl} target="_blank" rel="noreferrer" className="btn-primary">
                      <Wallet className="h-4 w-4" aria-hidden /> Pay with PayPal <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              ))}
              <button className="btn-ghost -ml-2.5" onClick={() => load(true)} disabled={busy}>
                {busy ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden />} I&apos;ve paid, check again
              </button>
            </div>
          )}
          {view.balance.requestableCents > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-brand-50/60 p-3">
              <button className="btn-primary" disabled={!!payBusy} onClick={() => pay({ all: true })}>
                {payBusy === "all" ? <Spinner /> : <Wallet className="h-4 w-4" aria-hidden />} Pay all {fmt(view.balance.requestableCents, c)}
              </button>
              <span className="text-xs text-muted">One PayPal invoice with every receipt listed, or pay receipts one by one below.</span>
            </div>
          )}
          {payErr && (
            <div className="mt-3">
              <Alert>{payErr}</Alert>
            </div>
          )}
          {paid.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {paid.map((r) => (
                <Badge key={r.id} tone="success">
                  <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Paid {fmt(r.cents, c)}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Receipts */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">Receipts ({view.expenses.length})</h2>
            {!adding && (
              <button className="btn-secondary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Add a bill you paid
              </button>
            )}
          </div>

          {adding && (
            <div className="space-y-2">
              <AddExpense
                group={pseudoGroup}
                title="Add a bill you paid"
                saveUrl={`/api/me/${token}/expenses`}
                payerId={view.me.id}
                allowChat={false}
                onAdded={(d) => {
                  setView(d as unknown as MemberView);
                  setAdding(false);
                }}
              />
              <button className="btn-ghost" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          )}

          {view.expenses.length === 0 ? (
            <div className="card">
              <EmptyState icon={Receipt} title="No receipts yet" text="Bills added to this group will show up here with your share of each." />
            </div>
          ) : (
            view.expenses.map((e) => <ReceiptCard key={e.id} e={e} currency={c} meId={view.me.id} onPay={pay} busy={payBusy} />)
          )}
        </section>

        <p className="pb-6 text-center text-xs text-muted">This is your private link for {view.group.name}. Don&apos;t share it with others.</p>
      </main>
    </div>
  );
}
