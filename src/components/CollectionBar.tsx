"use client";

import { CircleCheck, CircleDashed, Clock } from "lucide-react";
import { useState } from "react";
import { fmt } from "@/lib/money";

/**
 * Part-to-whole of money owed to the organiser: collected (PayPal says paid),
 * pending (invoice sent, not paid) and not yet requested. Status colours carry
 * an icon + label in the legend; segments are separated by a 2px gap and show a tooltip on hover.
 */
export type CollectionParts = { collected: number; pending: number; notRequested: number };

const PARTS = [
  { key: "collected", label: "Collected", icon: CircleCheck, color: "#059669" },
  { key: "pending", label: "Pending in PayPal", icon: Clock, color: "#D97706" },
  { key: "notRequested", label: "Not requested yet", icon: CircleDashed, color: "#94A3B8" },
] as const;

export default function CollectionBar({
  parts,
  currency = "USD",
  emptyText = "Nothing to collect yet. Add an expense and anyone who owes you will show up here.",
}: {
  parts: CollectionParts;
  currency?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.collected + parts.pending + parts.notRequested;
  const pct = total ? Math.round((parts.collected / total) * 100) : 0;
  const shown = PARTS.filter((p) => parts[p.key] > 0);

  if (total === 0)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4">
        <CircleDashed className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <p className="text-sm text-muted">{emptyText}</p>
      </div>
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-muted">
          <span className="num text-2xl font-semibold tracking-tight text-ink">{pct}%</span> collected
        </p>
        <p className="num text-sm text-muted">
          {fmt(parts.collected, currency)} of {fmt(total, currency)}
        </p>
      </div>
      <div
        className="relative flex h-3 w-full gap-[2px] overflow-visible rounded-full bg-slate-100"
        role="img"
        aria-label={PARTS.map((p) => `${p.label} ${fmt(parts[p.key], currency)}`).join(", ")}
      >
        {shown.map((p) => {
          const w = (parts[p.key] / total) * 100;
          return (
            <div
              key={p.key}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              className="relative h-full transition-[opacity,width] duration-500 first:rounded-l-full last:rounded-r-full"
              style={{ width: `${w}%`, background: p.color, opacity: hover && hover !== p.key ? 0.4 : 1 }}
            >
              {hover === p.key && (
                <div className="num pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow">
                  {p.label}: {fmt(parts[p.key], currency)} ({Math.round(w)}%)
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <p.icon className="h-3.5 w-3.5" aria-hidden />
            {p.label}
            <span className="num font-medium text-ink">{fmt(parts[p.key], currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
