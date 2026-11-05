"use client";

import { ChevronRight, ImageIcon, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";
import { PageBody, PageHeader } from "./AppShell";
import { Alert, Avatar, AvatarStack, EmptyState } from "./ui";

type Meta = { token: string; kind: "chat" | "image"; text?: string };

const ERRORS: Record<string, string> = {
  "too-large": "That image is over 5 MB. Try a smaller photo.",
  empty: "Nothing came through from the share. Try sharing again.",
  failed: "Something went wrong receiving that share. Try again.",
};

export default function ShareInbox({ token, error }: { token?: string; error?: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [err, setErr] = useState(error ? ERRORS[error] ?? ERRORS.failed : "");

  useEffect(() => {
    api<Group[]>("/api/groups").then(setGroups).catch(() => setGroups([]));
    if (token) api<Meta>(`/api/share/${token}`).then(setMeta).catch((e) => setErr(e.message));
  }, [token]);

  const lines = meta?.text?.split("\n").filter(Boolean) ?? [];

  return (
    <>
      <PageHeader crumbs={[{ label: "Dashboard", href: "/app" }, { label: "Shared to SplitPay" }]} title="Add to which group?" subtitle="Pick the group this belongs to and SplitPay will open it ready to import." />
      <PageBody>
        {err && <Alert>{err}</Alert>}

        {meta && (
          <div className="card card-pad">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                {meta.kind === "image" ? <ImageIcon className="h-5 w-5" aria-hidden /> : <MessageSquareText className="h-5 w-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{meta.kind === "image" ? "Receipt photo" : `Group chat · ${lines.length} line${lines.length === 1 ? "" : "s"}`}</p>
                {meta.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/share/${meta.token}?file=1`} alt="Shared receipt" className="mt-3 max-h-56 rounded-lg border border-line" />
                ) : (
                  <pre className="mt-2 max-h-40 overflow-hidden whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs text-muted">{lines.slice(0, 8).join("\n")}{lines.length > 8 ? "\n…" : ""}</pre>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card overflow-hidden">
          {groups === null ? (
            <p className="card-pad text-sm text-muted">Loading groups…</p>
          ) : groups.length === 0 ? (
            <EmptyState icon={Plus} title="No groups yet" text="Create a group first, then share again." action={<Link href="/app#new" className="btn-primary">Create a group</Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    disabled={!meta}
                    onClick={() => router.push(`/groups/${g.id}?share=${meta!.token}`)}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Avatar id={g.id} name={g.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{g.name}</span>
                      <span className="text-xs text-muted">{g.members.length} people</span>
                    </span>
                    <AvatarStack people={g.members} max={4} />
                    <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageBody>
    </>
  );
}
