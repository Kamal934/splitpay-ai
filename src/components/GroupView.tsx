"use client";

import { CircleCheck, CircleDashed, Clock, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fmt } from "@/lib/money";
import { groupStats, plural } from "@/lib/stats";
import type { Group } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/types";
import AddExpense, { type Incoming } from "./AddExpense";
import { GroupActivity, NextAction } from "./GroupCards";
import GroupHero from "./GroupHero";
import { AutopilotCard, LedgerMini, SettlementOverview } from "./GroupScreen";
import AgentChat from "./AgentChat";
import AutopilotPanel from "./AutopilotPanel";
import { api } from "./api";
import { PageBody } from "./AppShell";
import Ledger from "./Ledger";
import MembersEditor from "./MembersEditor";
import SettleUp from "./SettleUp";
import { Alert, Dialog, StatCard } from "./ui";
import { on } from "@/lib/events";

export default function GroupView({ id, share }: { id: string; share?: string }) {
  const router = useRouter();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [shareErr, setShareErr] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Header button, banner, assistant paperclip → open "Add expense"; ledger card → full ledger.
  useEffect(() => {
    const a = on("add-expense", () => setAddOpen(true));
    const b = on("open-ledger", () => setLedgerOpen(true));
    return () => (a(), b());
  }, []);

  // Arrived from the Android share sheet (or an iOS Shortcut): fetch what was shared.
  useEffect(() => {
    if (!share) return;
    (async () => {
      try {
        const meta = await api<{ kind: "chat" | "image"; text?: string; mime?: string; ext?: string }>(`/api/share/${share}`);
        setAddOpen(true);
        if (meta.kind === "chat") setIncoming({ kind: "chat", text: meta.text ?? "" });
        else {
          const blob = await (await fetch(`/api/share/${share}?file=1`)).blob();
          setIncoming({ kind: "image", file: new File([blob], `shared-receipt.${meta.ext ?? "jpg"}`, { type: meta.mime ?? blob.type }) });
        }
        void fetch(`/api/share/${share}`, { method: "DELETE" });
      } catch (e) {
        setShareErr((e as Error).message);
      } finally {
        router.replace(`/groups/${id}`, { scroll: false });
      }
    })();
  }, [share, id, router]);
  const [group, setGroup] = useState<Group | null>(null);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(false);

  const reload = useCallback(() => {
    api<Group>(`/api/groups/${id}`).then(setGroup).catch((e) => setErr(e.message));
  }, [id]);

  useEffect(reload, [reload]);

  // While autopilot is on, refresh every 20s so its work shows up live.
  const autopilotOn = !!group?.autopilot?.enabled;
  useEffect(() => {
    if (!autopilotOn) return;
    const t = setInterval(reload, 20000);
    return () => clearInterval(t);
  }, [autopilotOn, reload]);

  if (err)
    return (
      <PageBody>
        <Alert>{err}</Alert>
      </PageBody>
    );
  if (!group)
    return (
      <PageBody>
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded-md bg-slate-200" />
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </div>
      </PageBody>
    );

  const s = groupStats(group);
  const owedTotal = s.collected + s.open;
  const openInvoices = group.requests.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const toRequest = s.balances.filter((b) => b.requestableCents > 0).length;

  return (
    <>
      <GroupHero group={group} onChange={setGroup} onPeople={() => setEditing(true)} />

      <PageBody>
        <NextAction group={group} onAddExpense={() => setAddOpen(true)} />
        {shareErr && <Alert>{shareErr}</Alert>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={Wallet} tone="brand" label="Total spent" value={fmt(s.spent, group.currency)} hint={plural(group.expenses.length, "expense")} />
          <StatCard
            icon={CircleCheck}
            tone="success"
            label="Collected via PayPal"
            value={fmt(s.collected, group.currency)}
            hint={owedTotal ? `${Math.round((s.collected / owedTotal) * 100)}% of ${fmt(owedTotal, group.currency)} owed` : "Nothing owed yet"}
          />
          <StatCard icon={Clock} tone="warning" label="Pending in PayPal" value={fmt(s.pending, group.currency)} hint={plural(openInvoices, "open invoice")} />
          <StatCard icon={CircleDashed} tone="neutral" label="Not requested yet" value={fmt(s.notRequested, group.currency)} hint={toRequest ? `${plural(toRequest, "person", "people")} to request` : "Everyone requested"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <SettlementOverview group={group} />

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <GroupActivity group={group} />
              <AutopilotCard group={group} onChange={setGroup} />
              <LedgerMini group={group} />
            </div>

            {/* Dialog-only controllers (no sections of their own) */}
            <SettleUp group={group} onChange={setGroup} />
            <AutopilotPanel group={group} onChange={setGroup} />
          </div>

          <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
            <AgentChat group={group} onChange={setGroup} />
          </div>
        </div>
      </PageBody>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add an expense" size="xl" footer={<button className="btn-secondary" onClick={() => setAddOpen(false)}>Close</button>}>
        <AddExpense
          bare
          group={group}
          incoming={incoming}
          onAdded={(g) => {
            setGroup(g);
            setAddOpen(false);
          }}
        />
      </Dialog>

      <Dialog open={ledgerOpen} onClose={() => setLedgerOpen(false)} title="Group ledger" size="xl" footer={<button className="btn-secondary" onClick={() => setLedgerOpen(false)}>Close</button>}>
        {ledgerOpen && <Ledger bare group={group} onChange={setGroup} />}
      </Dialog>

      <MembersEditor group={group} open={editing} onClose={() => setEditing(false)} onSaved={(g) => (setGroup(g), setEditing(false))} />
    </>
  );
}
