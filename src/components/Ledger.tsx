"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { fmt } from "@/lib/money";
import type { Group } from "@/lib/types";
import { api } from "./api";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#1d4ed8",
  borderRadius: 10,
  headerFontWeight: 600,
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
          source: e.source === "receipt" ? "📸 Receipt" : "✍️ Manual",
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
        cellRenderer: (p: { data: Row }) => (
          <button
            className="text-xs text-slate-400 hover:text-rose-600"
            onClick={async () => {
              if (!confirm(`Delete "${p.data.description}"?`)) return;
              onChange(await api<Group>(`/api/groups/${group.id}/expenses?expenseId=${p.data.id}`, { method: "DELETE" }));
            }}
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
    <section className="card p-5">
      <h2 className="mb-1 text-lg font-bold">Group ledger</h2>
      <p className="mb-3 text-xs text-slate-500">Each person’s share of every expense. Hover an expense to see how the AI split it.</p>
      <div style={{ height: Math.min(140 + rows.length * 42, 460) }}>
        <AgGridReact<Row>
          theme={theme}
          rowData={rows}
          columnDefs={cols}
          pinnedBottomRowData={rows.length ? totals : []}
          defaultColDef={{ sortable: true, filter: true, resizable: true }}
          tooltipShowDelay={200}
          getRowId={(p) => p.data.id}
          overlayNoRowsTemplate="No expenses yet. Snap a receipt to get started."
        />
      </div>
    </section>
  );
}
