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

export default function CollectionBar({ parts, currency = "USD", tall = true }: { parts: CollectionParts; currency?: string; tall?: boolean }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = parts.collected + parts.pending + parts.notRequested;
  const shown = PARTS.filter((p) => parts[p.key] > 0);

  return (
    <div>
      <div className={`relative flex w-full gap-[2px] overflow-hidden rounded-[4px] bg-slate-100 ${tall ? "h-8" : "h-2"}`} role="img" aria-label={PARTS.map((p) => `${p.label} ${fmt(parts[p.key], currency)}`).join(", ")}>
        {total === 0 ? null : (
          shown.map((p) => {
            const pct = (parts[p.key] / total) * 100;
            return (
              <div
                key={p.key}
                onMouseEnter={() => setHover(p.key)}
                onMouseLeave={() => setHover(null)}
                className="relative h-full transition-opacity first:rounded-l-[4px] last:rounded-r-[4px]"
                style={{ width: `${pct}%`, background: p.color, opacity: hover && hover !== p.key ? 0.45 : 1 }}
              >
                {tall && pct > 14 && <span className="num absolute inset-0 grid place-items-center text-xs font-medium text-white">{Math.round(pct)}%</span>}
                {hover === p.key && (
                  <div className="num pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow">
                    {p.label}: {fmt(parts[p.key], currency)} ({Math.round(pct)}%)
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <p.icon className="h-3.5 w-3.5" aria-hidden />
            {p.label}
            <span className="num font-medium text-ink">{fmt(parts[p.key], currency)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
