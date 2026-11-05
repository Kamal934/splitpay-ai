import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { Member } from "./types";

export const MODEL = "claude-opus-5-5";

let _client: Anthropic | null = null;
export const claude = () => (_client ??= new Anthropic());

/**
 * Server-side refusal fallback: if a request is declined by a safety classifier,
 * the API reroutes it automatically instead of failing the user's action.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

// ---------- 1. Receipt reading (vision + structured output) ----------

export const ReceiptSchema = z.object({
  merchant: z.string().describe("Store or restaurant name, or 'Unknown'"),
  date: z.string().describe("Receipt date as YYYY-MM-DD, or empty string if not visible"),
  currency: z.string().describe("ISO-4217 code inferred from symbols/locale, e.g. USD, INR, EUR"),
  items: z
    .array(
      z.object({
        name: z.string().describe("Line item name, cleaned up and human readable"),
        quantity: z.number().describe("Quantity, 1 if not shown"),
        amount: z.number().describe("LINE TOTAL for this item (quantity already applied), as a plain number"),
      }),
    )
    .describe("Every purchased line item. Exclude subtotal/tax/tip/total/payment lines."),
  tax: z.number().describe("Total tax / VAT / GST / service charge, 0 if none"),
  tip: z.number().describe("Tip / gratuity, 0 if none"),
  total: z.number().describe("Grand total actually charged"),
  confidence: z.enum(["high", "medium", "low"]),
  notes: z.string().describe("Anything unreadable or ambiguous, empty string if none"),
});
export type ParsedReceipt = z.infer<typeof ReceiptSchema>;

export async function readReceipt(base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif") {
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: zodOutputFormat(ReceiptSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text:
              "Extract this receipt so a group can split it. List every purchased line with its line total. " +
              "Put tax, service charges and tip in their own fields, not as items. " +
              "Check that items + tax + tip is close to the total; if it isn't, say why in notes.",
          },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined to read this image.");
  if (!res.parsed_output) throw new Error("Couldn't read the receipt — try a clearer photo.");
  return res.parsed_output;
}

// ---------- 2. Natural-language split rules (structured output) ----------

const SplitSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().describe("Index of the item in the input list"),
      member_ids: z.array(z.string()).describe("IDs of members who share this item"),
      weights: z
        .array(z.number())
        .describe("Relative share for each member_id in the same order. Use all 1s for an equal split."),
    }),
  ),
  tax_mode: z
    .enum(["proportional", "equal"])
    .describe("How tax / service charge is shared: proportional to each person's items (default) or equally"),
  tip_mode: z
    .enum(["proportional", "equal"])
    .describe("How the tip is shared: proportional to each person's items (default) or equally"),
  explanation: z.string().describe("One or two friendly sentences explaining the split, using member names"),
  warnings: z.string().describe("Ambiguities in the instruction you had to guess about, empty string if none"),
  unmatched_names: z
    .array(z.string())
    .describe("People named in the instruction who are NOT in the member list (e.g. a typo or someone not added yet). Empty if all names match."),
});
export type SplitPlan = z.infer<typeof SplitSchema>;

export async function planSplit(
  items: { name: string; amount: number }[],
  members: Member[],
  instruction: string,
  paidByName: string,
): Promise<SplitPlan> {
  const roster = members.map((m) => `- ${m.id}: ${m.name}${m.isOrganizer ? " (organiser)" : ""}`).join("\n");
  const list = items.map((it, i) => `${i}. ${it.name} — ${it.amount.toFixed(2)}`).join("\n");
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: zodOutputFormat(SplitSchema) },
    system:
      "You turn casual instructions about splitting a bill into an exact item-by-item assignment. " +
      "Only use the member IDs given. Match names loosely (nicknames, first names, small typos), but if the instruction " +
      "names someone who clearly isn't a member, never map them onto a different member: list them in unmatched_names " +
      "and assign items as if that sentence weren't there. 'Me'/'I' means the organiser. If the instruction doesn't mention an item, split it equally among everyone. " +
      "Use weights for uneven shares (e.g. 'Priya had two' -> weight 2). Return every item index exactly once. " +
      "Do not do any arithmetic on totals; the app computes amounts from your assignment.",
    messages: [
      {
        role: "user",
        content:
          `Members:\n${roster}\n\nPaid by: ${paidByName}\n\nItems:\n${list}\n\n` +
          `Instruction: ${instruction.trim() || "Split everything equally."}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (!res.parsed_output) throw new Error("Couldn't understand the split instruction.");
  return res.parsed_output;
}

// ---------- 3. Autopilot reminder copy (structured output) ----------

const ReminderSchema = z.object({
  subject: z.string().describe("Email subject line, under 70 characters"),
  note: z.string().describe("The reminder message, 1-3 short sentences, under 400 characters"),
});

/**
 * Writes the text of an autopilot reminder. Tone escalates with each attempt
 * but always stays kind. The amount and names are facts passed in; the model
 * only writes the wording.
 */
export async function writeReminder(p: {
  name: string;
  amount: string;
  groupName: string;
  attempt: number;
  maxAttempts: number;
  organiser: string;
  daysOpen: number;
}) {
  const stage = p.attempt === 1 ? "a light, friendly nudge" : p.attempt < p.maxAttempts ? "a clear but warm follow-up" : "a final, polite but direct reminder";
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low", format: zodOutputFormat(ReminderSchema) },
    system:
      "You write short payment reminders between friends who shared costs. Never guilt-trip, threaten or use pressure tactics. " +
      "Use the exact amount and names given. Address the person by first name. No emojis. Do not invent details.",
    messages: [
      {
        role: "user",
        content:
          `Write ${stage} (reminder ${p.attempt} of ${p.maxAttempts}) to ${p.name} about their ${p.amount} share for "${p.groupName}". ` +
          `It's been open ${p.daysOpen < 1 ? "less than a day" : `${Math.round(p.daysOpen)} day(s)`}. Sign off as ${p.organiser}. ` +
          `They can pay with the PayPal invoice they already received.`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    return {
      subject: `Reminder: your share for ${p.groupName}`,
      note: `Hi ${p.name.split(" ")[0]}, just a reminder about your ${p.amount} share for ${p.groupName}. You can pay with the PayPal invoice you received. Thanks! ${p.organiser}`,
    };
  }
  return res.parsed_output;
}

// ---------- 4. Group-chat import (structured output) ----------

const ChatImportSchema = z.object({
  expenses: z.array(
    z.object({
      description: z.string().describe("Short name for the expense, e.g. 'Petrol', 'Beach snacks'"),
      amount: z.number().describe("Total amount paid, as a plain number"),
      currency: z.string().describe("ISO code if stated or implied by a symbol, else the group currency"),
      paid_by_member_id: z.string().describe("Member ID of who paid. Empty string if it's unclear"),
      shared_with_member_ids: z.array(z.string()).describe("Member IDs who share it. Empty array means everyone in the group"),
      weights: z.array(z.number()).describe("Relative shares matching shared_with_member_ids; empty or all 1s for equal"),
      quote: z.string().describe("The exact chat message(s) this came from"),
      confidence: z.enum(["high", "medium", "low"]),
      note: z.string().describe("Anything you had to assume, empty string if none"),
    }),
  ),
  ignored: z
    .array(z.object({ quote: z.string(), reason: z.string() }))
    .describe("Messages that mention money but are NOT new shared expenses (paybacks between people, plans, questions)"),
  unmatched_names: z.array(z.string()).describe("People mentioned as payers or sharers who are not in the member list"),
});
export type ChatImport = z.infer<typeof ChatImportSchema>;

/** Turns a pasted group chat into candidate expenses for the organiser to review. Nothing is saved here. */
export async function parseChat(text: string, members: Member[], currency: string): Promise<ChatImport> {
  const roster = members.map((m) => `- ${m.id}: ${m.name}${m.isOrganizer ? " (organiser; may appear as 'You' in an exported chat)" : ""}`).join("\n");
  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: zodOutputFormat(ChatImportSchema) },
    system:
      "You read a group chat (WhatsApp/Telegram/iMessage export or copy-paste) and find shared expenses someone paid for the group. " +
      "'I', 'me' and 'my' refer to the sender of that message. Match names loosely (first names, nicknames, small typos) to the member list; " +
      "never map someone who isn't a member onto a different member: put them in unmatched_names. " +
      "Only extract money that was actually spent for the group. A person paying another person back is NOT an expense: list it under ignored. " +
      "Plans, questions and estimates ('should we book?', 'it'll be about 50') are not expenses. " +
      "If a message says who it was for ('for the 3 of us', 'everyone except Sam'), set shared_with_member_ids accordingly; otherwise leave it empty (everyone). " +
      `The group currency is ${currency}. Do no arithmetic beyond reading the amounts.`,
    messages: [{ role: "user", content: `Members:\n${roster}\n\nChat:\n"""\n${text.slice(0, 20000)}\n"""` }],
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined to read this chat.");
  if (!res.parsed_output) throw new Error("Couldn't read any expenses from that chat.");
  return res.parsed_output;
}
