"use client";

import { ArrowUp, Ban, Bell, CircleAlert, CircleCheck, Receipt, RefreshCw, Send, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";
import { Spinner } from "./ui";

type Action = { kind: string; detail: string; ok: boolean };
type Turn = { role: "user" | "assistant"; text: string; actions?: Action[]; error?: boolean };

const SUGGESTIONS = ["Who still owes me money?", "Send PayPal requests to everyone who owes", "Has anyone paid? Remind whoever hasn't", "I paid $48 for the cab, split with everyone"];

/** Labels describe what the backend confirmed, never more. */
const ACTION_META: Record<string, { label: string; icon: LucideIcon; paypal: boolean }> = {
  request: { label: "PayPal request", icon: Send, paypal: true },
  reminder: { label: "PayPal reminder", icon: Bell, paypal: true },
  status: { label: "PayPal status update", icon: RefreshCw, paypal: true },
  cancel: { label: "PayPal cancellation", icon: Ban, paypal: true },
  expense: { label: "Ledger", icon: Receipt, paypal: false },
};

/** Minimal markdown: **bold** and "- " bullets. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return null;
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = line.replace(/^\s*[-*•]\s+/, "").split(/(\*\*[^*]+\*\*)/g);
        const content = parts.map((p, k) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <b key={k} className="font-semibold text-ink">
              {p.slice(2, -2)}
            </b>
          ) : (
            <span key={k}>{p}</span>
          ),
        );
        return bullet ? (
          <div key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            <span>{content}</span>
          </div>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

function ActionCard({ a }: { a: Action }) {
  const meta = ACTION_META[a.kind] ?? { label: "Action", icon: CircleCheck, paypal: false };
  const Icon = meta.icon;
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs ${a.ok ? "border-line bg-white" : "border-red-200 bg-red-50"}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${meta.paypal ? "bg-[#003087] text-white" : "bg-slate-100 text-muted"}`} aria-hidden>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-medium text-ink">
          {meta.label}
          <span className={`ml-1.5 inline-flex items-center gap-1 ${a.ok ? "text-success" : "text-danger"}`}>
            {a.ok ? <CircleCheck className="h-3 w-3" aria-hidden /> : <CircleAlert className="h-3 w-3" aria-hidden />}
            {a.ok ? "Done" : "Failed"}
          </span>
        </p>
        <p className="text-muted">{a.detail}</p>
      </div>
    </div>
  );
}

export default function AgentChat({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "assistant",
      text: `Hi! I'm your SplitPay agent for **${group.name}**. I can explain balances, add expenses, send PayPal requests and follow up with reminders.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Scroll only the chat panel, never the page.
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string, base?: Turn[]) {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...(base ?? turns), { role: "user", text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ reply: string; actions: Action[]; group: Group }>(`/api/groups/${group.id}/agent`, {
        method: "POST",
        body: { history: next.filter((t) => !t.error).map(({ role, text }) => ({ role, text })) },
      });
      setTurns([...next, { role: "assistant", text: r.reply, actions: r.actions }]);
      onChange(r.group);
    } catch (e) {
      setTurns([...next, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    const idx = turns.map((t) => t.role).lastIndexOf("user");
    if (idx < 0) return;
    send(turns[idx].text, turns.slice(0, idx));
  }

  return (
    <section className="card flex h-[620px] flex-col overflow-hidden xl:h-full">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white" aria-hidden>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">SplitPay Agent</h2>
          <p className="truncate text-xs text-muted">Claude · PayPal Agent Toolkit</p>
        </div>
      </div>

      <div ref={box} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-white">{t.text}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600" aria-hidden>
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {t.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                    <p className="font-medium">Something went wrong</p>
                    <p className="text-xs">{t.text}</p>
                    {i === turns.length - 1 && (
                      <button className="mt-2 text-xs font-medium underline" onClick={retry} disabled={busy}>
                        Try again
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-700">
                    <Rich text={t.text} />
                  </div>
                )}
                {t.actions && t.actions.length > 0 && (
                  <div className="space-y-1.5">
                    {t.actions.map((a, k) => (
                      <ActionCard key={k} a={a} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex gap-2.5">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600" aria-hidden>
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-xs text-muted">
              <Spinner className="h-3.5 w-3.5 text-brand-600" />
              Working with your group&apos;s ledger and PayPal…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {turns.length <= 1 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => send(s)}
                className="rounded-md border border-line bg-white px-2 py-1 text-xs text-muted transition-colors hover:border-brand-200 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-end gap-2 rounded-xl border border-line bg-white p-1.5 shadow-sm focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="h-8 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-400"
            placeholder="Ask about balances or tell the agent what to do…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Message the SplitPay agent"
          />
          <button className="btn-primary h-8 px-3" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </form>
        <p className="mt-2 px-1 text-[11px] text-muted">The agent only sends PayPal requests when you ask, and always uses the ledger amounts.</p>
      </div>
    </section>
  );
}
