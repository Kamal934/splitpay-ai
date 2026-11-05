"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmt } from "@/lib/money";
import type { Group } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/types";
import { api } from "./api";
import { Alert, Dialog, Spinner } from "./ui";

/** Organiser-only action: delete the group, cancelling any open PayPal invoices first. */
export default function DeleteGroup({ group }: { group: Group }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const openInvoices = group.requests.filter((r) => r.invoiceId && OPEN_STATUSES.includes(r.status));
  const openCents = openInvoices.reduce((a, r) => a + r.cents, 0);
  const matches = typed.trim() === group.name.trim();

  async function remove() {
    setBusy(true);
    setErr("");
    try {
      await api(`/api/groups/${group.id}`, { method: "DELETE", body: { confirmName: typed } });
      router.push("/app");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn-secondary text-danger hover:bg-red-50" onClick={() => (setTyped(""), setErr(""), setOpen(true))}>
        <Trash2 className="h-4 w-4" aria-hidden /> Delete group
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete “${group.name}”?`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Keep group
            </button>
            <button className="btn-danger" disabled={!matches || busy} onClick={remove}>
              {busy && <Spinner />} Delete group
            </button>
          </>
        }
      >
        <p>This permanently removes the group, its {group.expenses.length} expense{group.expenses.length === 1 ? "" : "s"} and its history. It can&apos;t be undone.</p>
        {openInvoices.length > 0 && (
          <div className="mt-3">
            <Alert tone="warning">
              {openInvoices.length} PayPal invoice{openInvoices.length === 1 ? "" : "s"} ({fmt(openCents, group.currency)}) still open will be <b>cancelled</b>, and PayPal will let those people know. Payments
              already made are not refunded.
            </Alert>
          </div>
        )}
        <label className="label mt-4" htmlFor="confirm-name">
          Type <b className="text-ink">{group.name}</b> to confirm
        </label>
        <input id="confirm-name" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        {err && (
          <div className="mt-3">
            <Alert>{err}</Alert>
          </div>
        )}
      </Dialog>
    </>
  );
}
