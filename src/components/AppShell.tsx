"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Group } from "@/lib/types";
import { api } from "./api";
import Logo, { REPO } from "./Logo";
import { Avatar } from "./ui";

function NavLink({ href, active, children, onClick }: { href: string; active: boolean; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
        active ? "bg-brand-50 font-medium text-brand-700" : "text-muted hover:bg-slate-100 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-[18px] w-[18px] shrink-0" aria-hidden>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ICONS = {
  dashboard: "M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z",
  plus: "M10 4v12M4 10h12",
  home: "M3 9l7-6 7 6v8H3z",
  code: "M7 6l-4 4 4 4M13 6l4 4-4 4",
};

function Sidebar({ groups, pathname, onNavigate }: { groups: Group[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/app" />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          <NavLink href="/app" active={pathname === "/app"} onClick={onNavigate}>
            <Icon d={ICONS.dashboard} /> Dashboard
          </NavLink>
          <NavLink href="/app#new" active={false} onClick={onNavigate}>
            <Icon d={ICONS.plus} /> New group
          </NavLink>
        </div>
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">Groups</p>
          <div className="space-y-0.5">
            {groups.length === 0 && <p className="px-2.5 text-xs text-muted">No groups yet</p>}
            {groups.map((g) => (
              <NavLink key={g.id} href={`/groups/${g.id}`} active={pathname === `/groups/${g.id}`} onClick={onNavigate}>
                <Avatar name={g.name} id={g.id} size="sm" />
                <span className="truncate">{g.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
      <div className="space-y-0.5 border-t border-line px-3 py-3">
        <NavLink href="/" active={false} onClick={onNavigate}>
          <Icon d={ICONS.home} /> Product site
        </NavLink>
        <a href={REPO} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted hover:bg-slate-100 hover:text-ink">
          <Icon d={ICONS.code} /> Source code
        </a>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" /> PayPal sandbox · test money only
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);

  // Refresh the group list whenever the route changes (e.g. after creating a group).
  useEffect(() => {
    api<Group[]>("/api/groups").then(setGroups).catch(() => {});
  }, [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-line bg-white lg:block">
        <Sidebar groups={groups} pathname={pathname} />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Logo href="/app" />
        <button className="btn-ghost" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">
            <Sidebar groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">{children}</div>
    </div>
  );
}

/** Page header with breadcrumbs, used at the top of every app page. */
export function PageHeader({
  crumbs,
  title,
  subtitle,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              {c.href ? (
                <Link href={c.href} className="hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1280px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">{children}</div>;
}
