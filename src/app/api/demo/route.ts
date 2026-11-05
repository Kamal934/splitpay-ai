import { createGroup, newId } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import type { Group } from "@/lib/types";

/** One-click demo group so judges can try SplitPay instantly. */
export async function POST() {
  try {
    const m = (name: string, email: string, isOrganizer = false) => ({ id: newId("mem"), name, email, isOrganizer });
    const you = m("You (Organiser)", process.env.PAYPAL_SANDBOX_BUSINESS_EMAIL || "organiser@example.com", true);
    const raj = m("Raj Mehta", process.env.DEMO_EMAIL_1 || "raj.demo@example.com");
    const priya = m("Priya Shah", process.env.DEMO_EMAIL_2 || "priya.demo@example.com");
    const sam = m("Sam Lee", process.env.DEMO_EMAIL_3 || "sam.demo@example.com");
    const all = [you, raj, priya, sam];
    const now = new Date().toISOString();
    const group: Group = {
      id: newId("grp"),
      name: "Goa Weekend Trip",
      currency: "USD",
      members: all,
      requests: [],
      createdAt: now,
      expenses: [
        {
          id: newId("exp"),
          description: "Beach villa (2 nights)",
          paidBy: you.id,
          totalCents: 32000,
          items: [{ name: "Beach villa (2 nights)", cents: 32000, memberIds: all.map((x) => x.id) }],
          taxCents: 0,
          tipCents: 0,
          shares: all.map((x) => ({ memberId: x.id, cents: 8000 })),
          splitInstruction: "Split equally",
          aiExplanation: "Everyone stayed both nights, so the villa is split four ways.",
          source: "manual",
          createdAt: now,
        },
      ],
    };
    return ok(await createGroup(group), 201);
  } catch (e) {
    return fail(e);
  }
}
