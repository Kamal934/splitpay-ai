"use client";

import { ArrowLeft, Camera, CircleCheck, CircleDashed, Clock, Pencil, Send, Upload, Users, Wallet } from "lucide-react";
import { emit } from "@/lib/events";
import Link from "next/link";
import { useRef, useState } from "react";
import { initials } from "@/lib/money";
import { groupStatus, plural } from "@/lib/stats";
import type { Group } from "@/lib/types";
import { api } from "./api";
import DeleteGroup from "./DeleteGroup";
import { Alert, AvatarStack, Badge, Dialog, Spinner } from "./ui";

const STATUS_ICON = { new: CircleDashed, ready: Send, collecting: Clock, payback: Wallet, settled_paypal: CircleCheck, settled_internal: CircleCheck } as const;

/** Group page header: cover photo, name (editable), members, status and actions. */
export default function GroupHero({ group, onChange, onPeople }: { group: Group; onChange: (g: Group) => void; onPeople: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const st = groupStatus(group);
  const StIcon = STATUS_ICON[st.key];

  async function upload(f?: File) {
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      onChange(await api<Group>(`/api/groups/${group.id}/cover`, { method: "POST", form: fd }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function rename() {
    setBusy(true);
    setErr("");
    try {
      onChange(await api<Group>(`/api/groups/${group.id}`, { method: "PATCH", body: { name } }));
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-line bg-white">
      {/* soft brand wash, decorative only */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-[36rem] rounded-full bg-brand-100/50 blur-3xl" aria-hidden />
      <div className="relative mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/app" className="inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-ink">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-white">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            </span>
            Back to groups
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={() => emit("add-expense")}>
              <Upload className="h-4 w-4" aria-hidden /> Add expense
            </button>
            <button className="btn-secondary" onClick={onPeople}>
              <Users className="h-4 w-4" aria-hidden /> People &amp; emails
            </button>
            <button className="btn-secondary" onClick={() => (setName(group.name), setErr(""), setEditing(true))}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit group
            </button>
            <DeleteGroup group={group} />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-line sm:h-24 sm:w-28"
            title={group.coverId ? "Change cover photo" : "Add a cover photo"}
          >
            {group.coverId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/receipts/${group.coverId}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-semibold text-white">{initials(group.name)}</span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-ink/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? <Spinner className="h-5 w-5" /> : <Camera className="h-5 w-5" aria-hidden />}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{group.name}</h1>
              <button className="btn-ghost h-7 px-1.5" aria-label="Rename group" onClick={() => (setName(group.name), setErr(""), setEditing(true))}>
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              <AvatarStack people={group.members} max={6} size="md" />
              <span>
                {plural(group.members.length, "member")} · {plural(group.expenses.length, "expense")}
              </span>
              <span title={st.hint}>
                <Badge tone={st.tone}>
                  <StIcon className="h-3.5 w-3.5" aria-hidden /> {st.label}
                </Badge>
              </span>
            </div>
          </div>
        </div>
        {err && !editing && (
          <div className="mt-3">
            <Alert>{err}</Alert>
          </div>
        )}
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit group"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={busy || !name.trim()} onClick={rename}>
              {busy && <Spinner />} Save
            </button>
          </>
        }
      >
        <label className="label" htmlFor="gname-edit">
          Group name
        </label>
        <input id="gname-edit" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && rename()} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" aria-hidden /> {group.coverId ? "Change cover photo" : "Add cover photo"}
          </button>
          {group.coverId && (
            <button className="btn-ghost hover:text-danger" onClick={async () => onChange(await api<Group>(`/api/groups/${group.id}/cover`, { method: "DELETE" }))}>
              Remove photo
            </button>
          )}
        </div>
        {err && (
          <div className="mt-3">
            <Alert>{err}</Alert>
          </div>
        )}
      </Dialog>
    </div>
  );
}
