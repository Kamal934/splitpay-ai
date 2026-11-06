"use client";

import { CircleAlert, CircleCheck, Hand, Play, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { on } from "@/lib/events";
import { fmt } from "@/lib/money";
import { timeAgo } from "@/lib/stats";
import type { AutopilotSettings, Group } from "@/lib/types";
import { api } from "./api";
import { Alert, Badge, Dialog, Spinner } from "./ui";

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

  // Opened from the Autopilot summary card or the banner (no second copy on the page).
  const [open, setOpen] = useState(false);
  useEffect(() => on("open-autopilot", () => setOpen(true)), []);

  const handedBack = group.requests.filter((r) => r.escalated && r.status !== "PAID" && r.status !== "MARKED_AS_PAID" && r.status !== "CANCELLED");

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title="Autopilot collection"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Close
          </button>
          {dirty && (
            <button className="btn-secondary" disabled={!!busy} onClick={() => save({ ...draft, enabled: saved.enabled })}>
              {busy === "save" && <Spinner />} Save rules
            </button>
          )}
          <button className="btn-primary" disabled={!!busy} onClick={runNow}>
            {busy === "run" ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Run now
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
          <p className="text-sm text-muted">Set the rules once. SplitPay checks PayPal on a schedule, requests what&apos;s owed and follows up until everyone has paid.</p>
          <div className="flex items-center gap-3">
            <Badge tone={saved.enabled ? "success" : "neutral"}>
              {saved.enabled ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <Hand className="h-3.5 w-3.5" aria-hidden />}
              {saved.enabled ? "On" : "Off"}
            </Badge>
            <Toggle on={saved.enabled} label="Autopilot" disabled={!!busy} onChange={(v) => save({ ...draft, enabled: v })} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <div className="flex items-start gap-2 rounded-lg border border-line bg-slate-50/60 px-3 py-2.5 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <span>
            The rules decide what happens, and Claude only writes the wording of each reminder, getting firmer each time but always polite. Amounts always come from the ledger. Nobody who
            has paid gets a reminder. After the last reminder, autopilot stops and hands it back to you.
          </span>
        </div>

        <p className="text-xs text-muted">
          {saved.lastRunAt ? (
            <>
              Last run {timeAgo(saved.lastRunAt)}: <span className="text-ink">{saved.lastSummary}</span>
            </>
          ) : (
            "Autopilot hasn't run yet."
          )}
        </p>

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
    </Dialog>
  );
}
