export type Member = {
  id: string;
  name: string;
  email: string;
  isOrganizer: boolean;
  /** Secret for this person's private link (/me/<token>). Lets them see receipts and pay without an account. */
  accessToken?: string;
};

export type ExpenseShare = {
  memberId: string;
  /** Amount in cents this member owes for the expense. */
  cents: number;
};

export type ExpenseItem = {
  name: string;
  /** Line total in cents (quantity already applied). */
  cents: number;
  /** Members who share this line. */
  memberIds: string[];
  /** Relative share per member, same order as memberIds (missing on older data = equal). */
  weights?: number[];
};

export type SplitModes = { tax: "proportional" | "equal"; tip: "proportional" | "equal" };

export type Expense = {
  id: string;
  description: string;
  paidBy: string;
  totalCents: number;
  items: ExpenseItem[];
  taxCents: number;
  tipCents: number;
  shares: ExpenseShare[];
  /** How tax and tip were shared (missing on older data). */
  modes?: SplitModes;
  splitInstruction?: string;
  aiExplanation?: string;
  source: "receipt" | "manual";
  /** Stored receipt photo, if this came from a scan. */
  receiptId?: string;
  createdAt: string;
};

export type RequestStatus =
  | "DRAFT"
  | "SENT"
  | "SCHEDULED"
  | "PAID"
  | "MARKED_AS_PAID"
  | "PARTIALLY_PAID"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "MARKED_AS_REFUNDED"
  | "UNPAID"
  | "PAYMENT_PENDING"
  | "ERROR";

export type PaymentRequest = {
  id: string;
  memberId: string;
  cents: number;
  invoiceId?: string;
  payerUrl?: string;
  status: RequestStatus;
  note?: string;
  error?: string;
  remindersSent: number;
  /** Receipts this request covers. Missing = a "pay all" request covering everything added before it. */
  expenseIds?: string[];
  /** Short label, e.g. the receipt name for a per-receipt payment. */
  label?: string;
  /** When the last reminder went out (autopilot uses this for spacing). */
  lastReminderAt?: string;
  /** Set once autopilot has used up its reminders and handed this back to the organiser. */
  escalated?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Rules the organiser sets once; autopilot follows them on a schedule. */
export type AutopilotSettings = {
  enabled: boolean;
  /** Automatically send PayPal requests for anything owed but not yet requested. */
  autoRequest: boolean;
  /** Send reminders at all (default on). Off = autopilot only syncs and requests. */
  remind?: boolean;
  /** Minutes after the request before the first reminder. */
  firstAfterMin: number;
  /** Minutes between later reminders. */
  repeatEveryMin: number;
  /** Stop after this many reminders and hand back to the organiser. */
  maxReminders: number;
  /** Autopilot never sends a single request above this. */
  maxRequestCents: number;
  lastRunAt?: string;
  lastSummary?: string;
};

export type AuditActor = "you" | "agent" | "autopilot" | "member";

export type AuditEntry = {
  id: string;
  at: string;
  actor: AuditActor;
  kind: string;
  detail: string;
  ok: boolean;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  members: Member[];
  expenses: Expense[];
  requests: PaymentRequest[];
  autopilot?: AutopilotSettings;
  /** Optional cover photo (stored like receipt photos). */
  coverId?: string;
  /** When PayPal statuses were last synced for this group. */
  lastCheckedAt?: string;
  audit?: AuditEntry[];
  createdAt: string;
};

export const PAID_STATUSES: RequestStatus[] = ["PAID", "MARKED_AS_PAID"];
export const OPEN_STATUSES: RequestStatus[] = [
  "SENT",
  "SCHEDULED",
  "UNPAID",
  "PAYMENT_PENDING",
  "PARTIALLY_PAID",
];
