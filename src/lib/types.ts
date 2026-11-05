export type Member = {
  id: string;
  name: string;
  email: string;
  isOrganizer: boolean;
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
};

export type Expense = {
  id: string;
  description: string;
  paidBy: string;
  totalCents: number;
  items: ExpenseItem[];
  taxCents: number;
  tipCents: number;
  shares: ExpenseShare[];
  splitInstruction?: string;
  aiExplanation?: string;
  source: "receipt" | "manual";
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
  createdAt: string;
  updatedAt: string;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  members: Member[];
  expenses: Expense[];
  requests: PaymentRequest[];
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
