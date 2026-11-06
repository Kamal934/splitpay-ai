import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { listGroups, updateGroup } from "./db";
import { coveringRequest } from "./coverage";
import { allocate, computeBalances } from "./money";
import type { Group, Member } from "./types";
import { OPEN_STATUSES, PAID_STATUSES } from "./types";

/* ---------- Private member links ---------- */

export const newToken = () => crypto.randomBytes(18).toString("base64url");

/** Gives every member a private link token if they don't have one yet. Mutates the group. */
export function ensureTokens(g: Group): boolean {
  let changed = false;
  for (const m of g.members) {
    if (!m.accessToken) {
      m.accessToken = newToken();
      changed = true;
    }
  }
  return changed;
}

/** Fill in missing tokens and persist (for groups created before links existed). */
export async function withTokens(g: Group): Promise<Group> {
  if (g.members.every((m) => m.accessToken)) return g;
  return updateGroup(g.id, (x) => {
    ensureTokens(x);
  });
}

const TOKEN_RE = /^[A-Za-z0-9_-]{20,40}$/;

export async function findByToken(token: string): Promise<{ group: Group; member: Member } | null> {
  if (!TOKEN_RE.test(token)) return null;
  for (const group of await listGroups()) {
    const member = group.members.find((m) => m.accessToken && m.accessToken === token);
    if (member) return { group, member };
  }
  return null;
}

/** Public base URL for links in invoices (Render sets RENDER_EXTERNAL_URL automatically). */
export function appUrl() {
  return (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const memberLink = (m: Member) => (m.accessToken ? `${appUrl()}/me/${m.accessToken}` : undefined);

/* ---------- Receipt photos ---------- */

const RECEIPTS = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "receipts");
const RECEIPT_ID = /^[a-f0-9]{32}$/;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export async function saveReceiptImage(bytes: Buffer, mime: string): Promise<string> {
  await fs.mkdir(RECEIPTS, { recursive: true });
  const id = crypto.randomBytes(16).toString("hex");
  await fs.writeFile(path.join(RECEIPTS, `${id}.${EXT[mime] ?? "img"}`), bytes);
  await fs.writeFile(path.join(RECEIPTS, `${id}.json`), JSON.stringify({ mime }));
  return id;
}

export async function readReceiptImage(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!RECEIPT_ID.test(id)) return null;
  try {
    const { mime } = JSON.parse(await fs.readFile(path.join(RECEIPTS, `${id}.json`), "utf8")) as { mime: string };
    return { bytes: await fs.readFile(path.join(RECEIPTS, `${id}.${EXT[mime] ?? "img"}`)), mime };
  } catch {
    return null;
  }
}

/* ---------- What a member sees on their private page ---------- */

export function memberView(g: Group, me: Member) {
  const name = (id: string) => g.members.find((m) => m.id === id)?.name ?? "Someone";
  const bal = computeBalances(g).find((b) => b.member.id === me.id)!;
  const organiser = g.members.find((m) => m.isOrganizer);
  const expenses = [...g.expenses].reverse().map((e) => {
    const items = e.items.map((it) => {
      const w = it.weights ?? it.memberIds.map(() => 1);
      const parts = allocate(it.cents, w);
      const at = it.memberIds.indexOf(me.id);
      return { name: it.name, cents: it.cents, sharedBy: it.memberIds.map(name), myPart: at >= 0 ? parts[at] : 0 };
    });
    const myShare = e.shares.find((s) => s.memberId === me.id)?.cents ?? 0;
    const myItems = items.reduce((a, i) => a + i.myPart, 0);
    // Payment state of *my* share of this receipt.
    const cover = coveringRequest(g, me.id, e);
    const pay =
      e.paidBy === me.id || myShare <= 0
        ? { state: "none" as const }
        : cover && PAID_STATUSES.includes(cover.status)
          ? { state: "paid" as const, viaAll: !cover.expenseIds || cover.expenseIds.length > 1 }
          : cover && OPEN_STATUSES.includes(cover.status)
            ? { state: "pending" as const, viaAll: !cover.expenseIds || cover.expenseIds.length > 1, payerUrl: cover.payerUrl ?? null }
            : cover
              ? { state: "pending" as const, viaAll: true, payerUrl: null }
              : myShare <= bal.requestableCents
                ? { state: "payable" as const }
                : { state: "use_all" as const };
    return {
      id: e.id,
      description: e.description,
      paidBy: name(e.paidBy),
      paidByMe: e.paidBy === me.id,
      totalCents: e.totalCents,
      taxCents: e.taxCents,
      tipCents: e.tipCents,
      createdAt: e.createdAt,
      source: e.source,
      receiptUrl: e.receiptId ? `/api/receipts/${e.receiptId}` : null,
      explanation: e.aiExplanation ?? "",
      items,
      myShare,
      myExtras: myShare - myItems,
      pay,
      shares: e.shares.map((s) => ({ name: name(s.memberId), cents: s.cents, isMe: s.memberId === me.id })),
    };
  });
  return {
    group: { id: g.id, name: g.name, currency: g.currency },
    me: { id: me.id, name: me.name, isOrganizer: me.isOrganizer },
    organiser: organiser?.name ?? "the organiser",
    members: g.members.map((m) => ({ id: m.id, name: m.name, isOrganizer: m.isOrganizer })),
    balance: { netCents: bal.netCents, paidCents: bal.paidCents, shareCents: bal.shareCents, pendingCents: bal.pendingCents, requestableCents: bal.requestableCents },
    requests: g.requests
      .filter((r) => r.memberId === me.id)
      .reverse()
      .map((r) => ({ id: r.id, cents: r.cents, status: r.status, payerUrl: r.payerUrl ?? null, label: r.label ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt })),
    expenses,
  };
}
export type MemberView = ReturnType<typeof memberView>;
