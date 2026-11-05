"use client";

import { useEffect, useRef, useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";

type Turn = { role: "user" | "assistant"; text: string; actions?: { kind: string; detail: string; ok: boolean }[] };

const SUGGESTIONS = [
  "Who still owes me money?",
  "Send PayPal requests to everyone who owes",
  "Has anyone paid yet? Remind whoever hasn't",
  "I paid $48 for the cab, split between me, Raj and Priya",
];

/** Minimal markdown: **bold** and "- " bullets, so replies read nicely without a library. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-*•]\s+/.test(line);
        const parts = line.replace(/^\s*[-*•]\s+/, "").split(/(\*\*[^*]+\*\*)/g);
        const content = parts.map((p, k) => (p.startsWith("**") && p.endsWith("**") ? <b key={k}>{p.slice(2, -2)}</b> : <span key={k}>{p}</span>));
        if (!line.trim()) return <div key={i} className="h-1" />;
        return bullet ? (
          <div key={i} className="flex gap-2 pl-1">
            <span>•</span>
            <span>{content}</span>
          </div>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </div>
  );
}

export default function AgentChat({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const [turns, setTurns] = useState<Turn[]>([
    { role: "assistant", text: `Hi! I'm your SplitPay agent for **${group.name}**. I can check balances, add expenses, and collect money through PayPal. What do you need?` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Turn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ reply: string; actions: Turn["actions"]; group: Group }>(`/api/groups/${group.id}/agent`, {
        method: "POST",
        body: { history: next.map(({ role, text }) => ({ role, text })) },
      });
      setTurns([...next, { role: "assistant", text: r.reply, actions: r.actions }]);
      onChange(r.group);
    } catch (e) {
      setTurns([...next, { role: "assistant", text: `⚠ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card flex h-[600px] flex-col lg:h-full">
      <div className="border-b border-slate-100 p-4">
        <h2 className="font-bold">🤖 SplitPay Agent</h2>
        <p className="text-xs text-slate-500">Claude + PayPal Agent Toolkit · acts on your group in real time</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[90%] rounded-2xl px-3 py-2 ${t.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100"}`}>
              <Rich text={t.text} />
              {t.actions && t.actions.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
                  {t.actions.map((a, k) => (
                    <li key={k} className={a.ok ? "text-emerald-700" : "text-rose-700"}>
                      {a.ok ? "✓" : "✗"} {a.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        {busy && <div className="w-fit animate-pulse rounded-2xl bg-slate-100 px-3 py-2 text-slate-500">Thinking and working with PayPal…</div>}
        <div ref={end} />
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {SUGGESTIONS.map((s) => (
            <button key={s} disabled={busy} onClick={() => send(s)} className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700 hover:bg-brand-100">
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input className="input" placeholder="Ask or tell the agent…" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn-primary" disabled={busy || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
