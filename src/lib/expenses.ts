import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { monthToDate } from "@/lib/rent";

export const RECEIPT_BUCKET = "expense-receipts";

export type ExpenseCategory =
  | "electricity_common"
  | "generator_fuel"
  | "water"
  | "gas"
  | "internet"
  | "security_guard"
  | "cleaner"
  | "caretaker"
  | "maintenance"
  | "repair"
  | "lift"
  | "supplies"
  | "tax"
  | "insurance"
  | "management"
  | "other";

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  electricity_common: "Common electricity",
  generator_fuel: "Generator fuel",
  water: "Water",
  gas: "Gas",
  internet: "Internet",
  security_guard: "Security guard",
  cleaner: "Cleaner",
  caretaker: "Caretaker",
  maintenance: "Maintenance",
  repair: "Repair",
  lift: "Lift",
  supplies: "Supplies",
  tax: "Tax",
  insurance: "Insurance",
  management: "Management",
  other: "Other",
};

export const expenseCategoryOptions = Object.keys(expenseCategoryLabel) as ExpenseCategory[];

export type ExpensePaymentMethod =
  | "cash"
  | "bkash"
  | "nagad"
  | "bank_transfer"
  | "cheque"
  | "other";

export const expenseMethodLabel: Record<ExpensePaymentMethod, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

export const expenseMethodOptions = Object.keys(expenseMethodLabel) as ExpensePaymentMethod[];

/** Digital / bank rails need a traceable reference number. */
export const methodsRequiringReference: ExpensePaymentMethod[] = [
  "bkash",
  "nagad",
  "bank_transfer",
  "cheque",
];

export type ExpenseApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export const expenseStatusLabel: Record<ExpenseApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type BuildingExpense = {
  id: string;
  building_id: string;
  building_name: string;
  expense_date: string;
  accounting_month: string;
  related_month: string | null;
  category: ExpenseCategory;
  description: string;
  vendor_name: string | null;
  amount: number;
  payment_method: ExpensePaymentMethod;
  transaction_reference: string | null;
  receipt_document_url: string | null;
  approval_status: ExpenseApprovalStatus;
  created_by: string;
  creator_name: string;
  approved_by: string | null;
  reviewer_name: string | null;
  approved_at: string | null;
  reviewer_note: string | null;
  cancelled_by: string | null;
  canceller_name: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  replaces_expense_id: string | null;
  replaced_by_expense_id: string | null;
  source_shared_charge_id: string | null;
  created_at: string;
  updated_at: string;
};

const SELECT_COLUMNS =
  "*, buildings(name), creator:profiles!building_expenses_created_by_fkey(full_name), reviewer:profiles!building_expenses_approved_by_fkey(full_name), canceller:profiles!building_expenses_cancelled_by_fkey(full_name)";

type RawExpense = Record<string, unknown> & {
  buildings?: { name: string } | null;
  creator?: { full_name: string } | null;
  reviewer?: { full_name: string } | null;
  canceller?: { full_name: string } | null;
};

function normalize(row: RawExpense): BuildingExpense {
  return {
    ...(row as unknown as BuildingExpense),
    amount: Number(row["amount"] ?? 0),
    building_name: row.buildings?.name ?? "—",
    creator_name: row.creator?.full_name ?? "—",
    reviewer_name: row.reviewer?.full_name ?? null,
    canceller_name: row.canceller?.full_name ?? null,
  };
}

export type ExpenseFilters = {
  buildingId: string; // "all" for every accessible building
  month: string; // "" for every accounting month (yyyy-MM)
  category: ExpenseCategory | "all";
  status: ExpenseApprovalStatus | "all";
  dateFrom: string;
  dateTo: string;
  search: string;
};

export const expensesQueryOptions = (filters: ExpenseFilters) =>
  queryOptions({
    queryKey: ["building-expenses", filters],
    queryFn: async (): Promise<BuildingExpense[]> => {
      let query = supabase
        .from("building_expenses")
        .select(SELECT_COLUMNS)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters.buildingId !== "all") query = query.eq("building_id", filters.buildingId);
      if (filters.month) query = query.eq("accounting_month", monthToDate(filters.month));
      if (filters.category !== "all") query = query.eq("category", filters.category);
      if (filters.status !== "all") query = query.eq("approval_status", filters.status);
      if (filters.dateFrom) query = query.gte("expense_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("expense_date", filters.dateTo);

      const term = filters.search.trim();
      if (term) {
        const escaped = term.replace(/[%,()]/g, " ");
        query = query.or(
          `description.ilike.%${escaped}%,vendor_name.ilike.%${escaped}%,transaction_reference.ilike.%${escaped}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawExpense));
    },
  });

export const expenseQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: ["building-expense", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async (): Promise<BuildingExpense | null> => {
      const { data, error } = await supabase
        .from("building_expenses")
        .select(SELECT_COLUMNS)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalize(data as RawExpense) : null;
    },
  });

export type ExpenseSummary = {
  approvedTotal: number;
  approvedCount: number;
  pendingTotal: number;
  pendingCount: number;
  cancelledTotal: number;
  cancelledCount: number;
  rejectedCount: number;
  byCategory: Array<{ category: ExpenseCategory; total: number }>;
  topCategory: { category: ExpenseCategory; total: number } | null;
};

/** Only approved rows count toward official totals. */
export function summarizeExpenses(rows: BuildingExpense[]): ExpenseSummary {
  const approved = rows.filter((row) => row.approval_status === "approved");
  const pending = rows.filter((row) => row.approval_status === "pending");
  const cancelled = rows.filter((row) => row.approval_status === "cancelled");
  const rejected = rows.filter((row) => row.approval_status === "rejected");

  const totals = new Map<ExpenseCategory, number>();
  for (const row of approved) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
  }
  const byCategory = [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const sum = (list: BuildingExpense[]) => list.reduce((acc, row) => acc + row.amount, 0);

  return {
    approvedTotal: sum(approved),
    approvedCount: approved.length,
    pendingTotal: sum(pending),
    pendingCount: pending.length,
    cancelledTotal: sum(cancelled),
    cancelledCount: cancelled.length,
    rejectedCount: rejected.length,
    byCategory,
    topCategory: byCategory[0] ?? null,
  };
}

export type ExpenseInput = {
  buildingId: string;
  expenseDate: string;
  accountingMonth: string; // yyyy-MM
  relatedMonth: string; // yyyy-MM or ""
  category: ExpenseCategory;
  description: string;
  vendorName: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  transactionReference: string;
  receiptFile: File | null;
  /** Existing receipt path kept when editing without a new upload. */
  receiptPath?: string | null;
  /** Owners are the final financial authority for their own entries. */
  approveImmediately?: boolean;
  replacesExpenseId?: string | null;
};

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateExpenseInput(input: ExpenseInput): string | null {
  if (!input.buildingId) return "Select the building this expense belongs to.";
  if (!input.expenseDate) return "Expense date is required.";
  if (!input.accountingMonth) return "Posted accounting month is required.";
  if (!input.description.trim()) return "Description is required.";
  if (!(Number.isFinite(input.amount) && input.amount > 0)) {
    return "Amount must be greater than zero.";
  }
  if (
    methodsRequiringReference.includes(input.paymentMethod) &&
    !input.transactionReference.trim()
  ) {
    return "A transaction or cheque reference is required for digital and bank payments.";
  }
  if (input.receiptFile) {
    if (!ALLOWED_TYPES.includes(input.receiptFile.type)) {
      return "Receipts must be a PDF, JPG, JPEG or PNG file.";
    }
    if (input.receiptFile.size > MAX_BYTES) {
      return "Receipt files must be 5 MB or smaller.";
    }
  }
  return null;
}

async function uploadReceipt(buildingId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `${buildingId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload the receipt: ${error.message}`);
  return path;
}

export async function createReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the receipt: ${error.message}`);
  return data.signedUrl;
}

export function describeExpenseError(message: string) {
  if (message.includes("month_closed")) {
    return "That accounting month is closed. Post this expense into the next open month and set the related month to the historical one.";
  }
  if (message.includes("expense_locked")) {
    return "Approved accounting values cannot be edited. Cancel this expense with a reason and record a corrected replacement.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to record or change expenses for this building.";
  }
  return message;
}

export async function createExpense(input: ExpenseInput) {
  const invalid = validateExpenseInput(input);
  if (invalid) throw new Error(invalid);

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in.");

  const receiptPath = input.receiptFile
    ? await uploadReceipt(input.buildingId, input.receiptFile)
    : (input.receiptPath ?? null);

  const { data, error } = await supabase
    .from("building_expenses")
    .insert({
      building_id: input.buildingId,
      expense_date: input.expenseDate,
      accounting_month: monthToDate(input.accountingMonth),
      related_month: input.relatedMonth ? monthToDate(input.relatedMonth) : null,
      category: input.category,
      description: input.description.trim(),
      vendor_name: input.vendorName.trim() || null,
      amount: input.amount,
      payment_method: input.paymentMethod,
      transaction_reference: input.transactionReference.trim() || null,
      receipt_document_url: receiptPath,
      created_by: userId,
      ...(input.approveImmediately
        ? {
            approval_status: "approved" as const,
            approved_by: userId,
            approved_at: new Date().toISOString(),
          }
        : {}),
      ...(input.replacesExpenseId ? { replaces_expense_id: input.replacesExpenseId } : {}),
    })
    .select("id")
    .single();
  if (error) throw new Error(describeExpenseError(error.message));
  return data.id as string;
}

/** Only the creator's own still-pending expense can be edited. */
export async function updatePendingExpense(id: string, input: ExpenseInput) {
  const invalid = validateExpenseInput(input);
  if (invalid) throw new Error(invalid);

  const receiptPath = input.receiptFile
    ? await uploadReceipt(input.buildingId, input.receiptFile)
    : (input.receiptPath ?? null);

  const { error } = await supabase
    .from("building_expenses")
    .update({
      expense_date: input.expenseDate,
      accounting_month: monthToDate(input.accountingMonth),
      related_month: input.relatedMonth ? monthToDate(input.relatedMonth) : null,
      category: input.category,
      description: input.description.trim(),
      vendor_name: input.vendorName.trim() || null,
      amount: input.amount,
      payment_method: input.paymentMethod,
      transaction_reference: input.transactionReference.trim() || null,
      receipt_document_url: receiptPath,
    })
    .eq("id", id);
  if (error) throw new Error(describeExpenseError(error.message));
}

export async function reviewExpense(id: string, action: "approve" | "reject", note: string) {
  const trimmed = note.trim();
  if (action === "reject" && !trimmed) {
    throw new Error("A reviewer note is required when rejecting an expense.");
  }
  const { error } = await supabase.rpc("review_building_expense", {
    _expense_id: id,
    _action: action,
    ...(trimmed ? { _note: trimmed } : {}),
  });
  if (error) throw new Error(describeExpenseError(error.message));
}

export async function cancelExpense(id: string, reason: string, replacementId?: string | null) {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  const { error } = await supabase.rpc("cancel_building_expense", {
    _expense_id: id,
    _reason: reason.trim(),
    ...(replacementId ? { _replacement_expense_id: replacementId } : {}),
  });
  if (error) throw new Error(describeExpenseError(error.message));
}

export type BuildingExpenseTotal = {
  buildingId: string;
  buildingName: string;
  approvedTotal: number;
};

export function totalsByBuilding(rows: BuildingExpense[]): BuildingExpenseTotal[] {
  const map = new Map<string, BuildingExpenseTotal>();
  for (const row of rows) {
    if (row.approval_status !== "approved") continue;
    const existing = map.get(row.building_id);
    if (existing) {
      existing.approvedTotal += row.amount;
    } else {
      map.set(row.building_id, {
        buildingId: row.building_id,
        buildingName: row.building_name,
        approvedTotal: row.amount,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.approvedTotal - a.approvedTotal);
}

/** Month-scoped rows across every accessible building, for dashboard panels. */
export const monthExpensesQueryOptions = (month: string) =>
  queryOptions({
    queryKey: ["building-expenses-month", month],
    enabled: Boolean(month),
    queryFn: async (): Promise<BuildingExpense[]> => {
      const { data, error } = await supabase
        .from("building_expenses")
        .select(SELECT_COLUMNS)
        .eq("accounting_month", monthToDate(month))
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawExpense));
    },
  });
