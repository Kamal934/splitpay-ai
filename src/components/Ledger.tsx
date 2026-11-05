"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/money";
import type { Group } from "@/lib/types";
import { api } from "./api";
import { Dialog, Spinner } from "./ui";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#7c3aed",
  borderColor: "#e5e7eb",
  borderRadius: 8,
  wrapperBorderRadius: 8,
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#64748b",
  headerFontWeight: 500,
  headerFontSize: 12,
  fontSize: 13,
  foregroundColor: "#111827",
  rowHoverColor: "#f5f3ff",
  fontFamily: "inherit",
});

type Row = {
  id: string;
  date: string;
  description: string;
  paidBy: string;
  total: number;
  source: string;
  split: string;
  [member: string]: string | number;
};

export default function Ledger({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const rows: Row[] = useMemo(
    () =>
      group.expenses.map((e) => {
        const r: Row = {
          id: e.id,
          date: e.createdAt.slice(0, 10),
          description: e.description,
          paidBy: name(e.paidBy),
          total: e.totalCents,
          source: e.source === "receipt" ? "Receipt scan" : "Manual",
          split: e.aiExplanation || e.splitInstruction || "",
        };
        for (const m of group.members) r[`m_${m.id}`] = e.shares.find((s) => s.memberId === m.id)?.cents ?? 0;
        return r;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group],
  );

  const money = (p: { value: number }) => (p.value ? fmt(p.value, group.currency) : "–");

  const cols: ColDef<Row>[] = useMemo(
    () => [
      { field: "date", headerName: "Date", width: 110, sort: "desc" },
      { field: "description", headerName: "Expense", flex: 1, minWidth: 160, tooltipField: "split" },
      { field: "paidBy", headerName: "Paid by", width: 140, enableRowGroup: true },
      { field: "total", headerName: "Total", width: 110, type: "rightAligned", valueFormatter: money, aggFunc: "sum" },
      ...group.members.map(
        (m): ColDef<Row> => ({
          field: `m_${m.id}`,
          headerName: m.name.split(" ")[0],
          width: 110,
          type: "rightAligned",
          valueFormatter: money,
        }),
      ),
      { field: "source", headerName: "Source", width: 120 },
      {
        headerName: "",
        width: 70,
        sortable: false,
        filter: false,
        cellRenderer: (p: { data: Row }) =>
          p.data.id === "total" ? null : (
          <button
            className="text-xs font-medium text-muted hover:text-danger"
            onClick={() => setToDelete(p.data)}
          >
            Delete
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group],
  );

  const totals = useMemo(() => {
    const t: Row = { id: "total", date: "", description: "Total", paidBy: "", total: 0, source: "", split: "" };
    for (const r of rows) {
      t.total = (t.total as number) + r.total;
      for (const m of group.members) t[`m_${m.id}`] = ((t[`m_${m.id}`] as number) || 0) + ((r[`m_${m.id}`] as number) || 0);
    }
    return [t];
  }, [rows, group.members]);

  return (
    <section className="card card-pad">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-ink">Group ledger</h2>
        <p className="mt-0.5 text-sm text-muted">Each person&apos;s share of every expense. Hover an expense to see how the AI split it.</p>
      </div>
      <div>
        <AgGridReact<Row>
          theme={theme}
          domLayout="autoHeight"
          rowData={rows}
          columnDefs={cols}
          pinnedBottomRowData={rows.length ? totals : []}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          tooltipShowDelay={200}
          getRowId={(p) => p.data.id}
          overlayNoRowsTemplate="No expenses yet. Snap a receipt to get started."
        />
      </div>
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete this expense?"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setToDelete(null)}>
              Keep it
            </button>
            <button
              className="btn-danger"
              disabled={deleting}
              onClick={async () => {
                if (!toDelete) return;
                setDeleting(true);
                try {
                  onChange(await api<Group>(`/api/groups/${group.id}/expenses?expenseId=${toDelete.id}`, { method: "DELETE" }));
                  setToDelete(null);
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting && <Spinner />} Delete
            </button>
          </>
        }
      >
        <p>
          “{toDelete?.description}” will be removed and everyone&apos;s balance recalculated. PayPal requests that were already sent are not changed.
        </p>
      </Dialog>
    </section>
  );
}
