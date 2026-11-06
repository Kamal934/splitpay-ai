"use client";

import { Ban, CircleAlert, CircleCheck, CircleDashed, Clock, RotateCcw, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { initials } from "@/lib/money";
import type { RequestStatus } from "@/lib/types";

/* ---------- Avatar ---------- */
const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-slate-200 text-slate-700",
];

/** Stable tone per member id, so a person keeps their colour everywhere. */
function tone(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ name, id, size = "md", ring = false }: { name: string; id?: string; size?: "sm" | "md" | "lg"; ring?: boolean }) {
  const s = size === "sm" ? "h-7 w-7 text-[10px] tracking-tight" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <span title={name} className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${s} ${tone(id ?? name)} ${ring ? "ring-2 ring-white" : ""}`}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 5, size = "sm" }: { people: { id: string; name: string }[]; max?: number; size?: "sm" | "md" }) {
  return (
    <div className="flex -space-x-1">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} id={p.id} name={p.name} size={size} ring />
      ))}
      {people.length > max && (
        <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-semibold text-muted ring-2 ring-white">
          +{people.length - max}
        </span>
      )}
    </div>
  );
}

/* ---------- Status badge (one source of truth for payment status styling) ---------- */
type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

const TONE: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  neutral: "bg-slate-50 text-slate-600 ring-slate-500/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
      {children}
    </span>
  );
}

/** Maps a real PayPal invoice status to label + tone. Never shows "Paid" unless PayPal says so. */
export function paymentStatus(s: RequestStatus): { label: string; tone: Tone; icon: LucideIcon } {
  switch (s) {
    case "PAID":
      return { label: "Paid", tone: "success", icon: CircleCheck };
    case "MARKED_AS_PAID":
      return { label: "Marked paid", tone: "success", icon: CircleCheck };
    case "PARTIALLY_PAID":
      return { label: "Partly paid", tone: "warning", icon: Clock };
    case "SENT":
    case "UNPAID":
    case "SCHEDULED":
    case "PAYMENT_PENDING":
      return { label: "Pending", tone: "warning", icon: Clock };
    case "DRAFT":
      return { label: "Draft", tone: "neutral", icon: CircleDashed };
    case "CANCELLED":
      return { label: "Cancelled", tone: "neutral", icon: Ban };
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
    case "MARKED_AS_REFUNDED":
      return { label: "Refunded", tone: "neutral", icon: RotateCcw };
    case "ERROR":
    default:
      return { label: "Failed", tone: "danger", icon: CircleAlert };
  }
}

export function StatusBadge({ status, title }: { status: RequestStatus; title?: string }) {
  const p = paymentStatus(status);
  const Icon = p.icon;
  return (
    <Badge tone={p.tone} title={title ?? `PayPal status: ${status}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {p.label}
    </Badge>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

/* ---------- Alert ---------- */
export function Alert({ tone = "danger", children }: { tone?: "danger" | "warning" | "success" | "info"; children: React.ReactNode }) {
  const t = {
    danger: "border-red-200 bg-red-50 text-red-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-brand-200 bg-brand-50 text-brand-700",
  }[tone];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${t}`}>{children}</div>;
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Dialog (native <dialog>, accessible, no dependency) ---------- */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  size,
}: {
  wide?: boolean;
  size?: "md" | "lg";
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${size === "lg" ? "max-w-2xl" : wide ? "max-w-xl" : "max-w-md"} rounded-xl border border-line bg-white p-0 shadow-xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]`}
    >
      <div className="p-5">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-3 text-sm text-muted">{children}</div>
      </div>
      {footer && <div className="flex justify-end gap-2 border-t border-line bg-slate-50/60 px-5 py-3">{footer}</div>}
    </dialog>
  );
}

/* ---------- Section header ---------- */
export function SectionHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Stat card (dashboard + group summaries) ---------- */
const STAT_TONE = {
  brand: "bg-brand-50 text-brand-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  neutral: "bg-slate-100 text-slate-500",
} as const;

const STAT_WASH = { brand: "bg-brand-200/40", success: "bg-emerald-200/40", warning: "bg-amber-200/50", neutral: "bg-slate-200/50" } as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof STAT_TONE;
  emphasis?: boolean;
}) {
  return (
    <div className="card relative overflow-hidden p-5 transition-shadow hover:shadow-[0_6px_16px_rgba(16,24,40,0.06)]">
      {/* decorative wash in the card's tone */}
      <span className={`pointer-events-none absolute -bottom-10 -right-8 h-28 w-40 rounded-full blur-2xl ${STAT_WASH[tone]}`} aria-hidden />
      <div className="relative flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${STAT_TONE[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="num mt-0.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
