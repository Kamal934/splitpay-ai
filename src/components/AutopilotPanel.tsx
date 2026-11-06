"use client";

import { Bot, CircleAlert, CircleCheck, Hand, Play, ShieldCheck, User, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/money";
import { timeAgo } from "@/lib/stats";
import type { AuditActor, AutopilotSettings, Group } from "@/lib/types";
import { api } from "./api";
import { Alert, Badge, SectionHeader, Spinner } from "./ui";

const DEFAULTS: AutopilotSettings = {
  enabled: false,
  autoRequest: true,
  firstAfterMin: 2880,
  repeatEveryMin: 2880,
  maxReminders: 3,
  maxRequestCents: 50000,
};

const TIMES = [
  { label: "2 minutes (demo)", v: 2 },
  { label: "1 hour", v: 60 },
  { label: "1 day", v: 1440 },
  { label: "2 days", v: 2880 },
  { label: "3 days", v: 4320 },
  { label: "1 week", v: 10080 },
];

const ACTOR: Record<AuditActor, { label: string; icon: typeof User; tone: "neutral" | "brand" | "warning" }> = {
  you: { label: "You", icon: User, tone: "neutral" },
  agent: { label: "Agent", icon: Bot, tone: "brand" },
  autopilot: { label: "Autopilot", icon: Zap, tone: "warning" },
  member: { label: "Member", icon: Users, tone: "neutral" },
};

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function TimeSelect({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  const known = TIMES.some((t) => t.v === value);
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {!known && <option value={value}>{value} minutes</option>}
      {TIMES.map((t) => (
        <option key={t.v} value={t.v}>
          {t.label}
        </option>
      ))}
    </select>
  );
}

export default function AutopilotPanel({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const saved: AutopilotSettings = { ...DEFAULTS, ...(group.autopilot ?? {}) };
  const [draft, setDraft] = useState<AutopilotSettings>(saved);
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState("");

  // Keep the form in sync when the group changes underneath (polling, agent changes).
  const savedKey = JSON.stringify([saved.enabled, saved.autoRequest, saved.firstAfterMin, saved.repeatEveryMin, saved.maxReminders, saved.maxRequestCents]);
  useEffect(() => {
    setDraft((d) => ({ ...d, ...JSON.parse(JSON.stringify(saved)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dirty =
    draft.autoRequest !== saved.autoRequest ||
    draft.firstAfterMin !== saved.firstAfterMin ||
    draft.repeatEveryMin !== saved.repeatEveryMin ||
    draft.maxReminders !== saved.maxReminders ||
    draft.maxRequestCents !== saved.maxRequestCents;

  async function save(next: AutopilotSettings) {
    setBusy("save");
    setErr("");
    try {
      const r = await api<{ group: Group }>(`/api/groups/${group.id}/autopilot`, { method: "POST", body: { action: "save", settings: next } });
      onChange(r.group);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function runNow() {
    setBusy("run");
    setErr("");
    setResult("");
    try {
      const r = await api<{ run: { summary: string }; group: Group }>(`/api/groups/${group.id}/autopilot`, { method: "POST", body: { action: "run" } });
      onChange(r.group);
      setResult(r.run.summary);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const log = group.audit ?? [];
  const handedBack = group.requests.filter((r) => r.escalated && r.status !== "PAID" && r.status !== "MARKED_AS_PAID" && r.status !== "CANCELLED");

  return (
    <section className="card">
      <div className="card-pad border-b border-line">
        <SectionHeader
          title="Autopilot collection"
          description="Set the rules once. SplitPay checks PayPal on a schedule, requests what's owed and follows up until everyone has paid."
          actions={
            <div className="flex items-center gap-3">
              <Badge tone={saved.enabled ? "success" : "neutral"}>
                {saved.enabled ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <Hand className="h-3.5 w-3.5" aria-hidden />}
                {saved.enabled ? "On" : "Off"}
              </Badge>
              <Toggle on={saved.enabled} label="Autopilot" disabled={!!busy} onChange={(v) => save({ ...draft, enabled: v })} />
            </div>
          }
        />
      </div>

      <div className="card-pad space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="ap-first">First reminder after</label>
            <TimeSelect id="ap-first" value={draft.firstAfterMin} onChange={(v) => setDraft({ ...draft, firstAfterMin: v })} />
          </div>
          <div>
            <label className="label" htmlFor="ap-repeat">Then remind every</label>
            <TimeSelect id="ap-repeat" value={draft.repeatEveryMin} onChange={(v) => setDraft({ ...draft, repeatEveryMin: v })} />
          </div>
          <div>
            <label className="label" htmlFor="ap-max">Stop after</label>
            <select id="ap-max" className="input" value={draft.maxReminders} onChange={(e) => setDraft({ ...draft, maxReminders: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} reminder{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ap-cap">Never request more than</label>
            <select id="ap-cap" className="input" value={draft.maxRequestCents} onChange={(e) => setDraft({ ...draft, maxRequestCents: Number(e.target.value) })}>
              {[5000, 10000, 25000, 50000, 100000].map((c) => (
                <option key={c} value={c}>
                  {fmt(c, group.currency)} per person
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm text-ink">
          <Toggle on={draft.autoRequest} label="Send requests automatically" onChange={(v) => setDraft({ ...draft, autoRequest: v })} />
          Send PayPal requests automatically when someone owes money
        </label>

        <div className="flex flex-wrap items-start gap-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <span>
            The rules decide what happens, and Claude only writes the wording of each reminder, getting firmer each time but always polite. Amounts always come from the
            ledger. Nobody who has paid gets a reminder. After the last reminder, autopilot stops and hands it back to you.
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {saved.lastRunAt ? (
              <>
                Last run {timeAgo(saved.lastRunAt)}: <span className="text-ink">{saved.lastSummary}</span>
              </>
            ) : (
              "Autopilot hasn't run yet."
            )}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <button className="btn-secondary" disabled={!!busy} onClick={() => save({ ...draft, enabled: saved.enabled })}>
                {busy === "save" && <Spinner />} Save rules
              </button>
            )}
            <button className="btn-primary" disabled={!!busy} onClick={runNow}>
              {busy === "run" ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Run now
            </button>
          </div>
        </div>

        {result && <Alert tone="success">{result}</Alert>}
        {handedBack.length > 0 && (
          <Alert tone="warning">
            <span className="flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
              Over to you: {handedBack.map((r) => group.members.find((m) => m.id === r.memberId)?.name).join(", ")} still {handedBack.length > 1 ? "haven't" : "hasn't"} paid
              after every reminder.
            </span>
          </Alert>
        )}
        {err && <Alert>{err}</Alert>}
      </div>

      <div className="border-t border-line">
        <div className="flex items-center justify-between px-5 pt-4 sm:px-6">
          <h3 className="text-sm font-semibold text-ink">Audit log</h3>
          <span className="text-xs text-muted">Every action by you, the agent and autopilot</span>
        </div>
        {log.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted sm:px-6">Nothing yet. Actions on this group will be recorded here.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto px-5 py-2 sm:px-6">
            {log.slice(0, 50).map((e) => {
              const a = ACTOR[e.actor];
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <Badge tone={a.tone}>
                    <a.icon className="h-3.5 w-3.5" aria-hidden />
                    {a.label}
                  </Badge>
                  <p className={`min-w-0 flex-1 text-sm ${e.ok ? "text-ink" : "text-danger"}`}>{e.detail}</p>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(e.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
