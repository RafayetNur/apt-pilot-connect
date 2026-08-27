import { useCallback, useEffect } from "react";
import * as Crypto from "expo-crypto";
import type { ImagePickerAsset } from "expo-image-picker";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDate, useAsyncState } from "@/lib/manager/shared";

/**
 * Manager building-expense entries for assigned buildings. Mirrors the web
 * app's src/lib/expenses.ts: same `building_expenses` table, same
 * `expense-receipts` storage bucket, and the same rule that a manager's new
 * expense always lands as `approval_status = "pending"` (only an owner
 * approves/rejects through `review_building_expense`) — this module never
 * sets `approval_status` to "approved" itself.
 */

export const RECEIPT_BUCKET = "expense-receipts";

export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];
export type ExpensePaymentMethod = Database["public"]["Enums"]["expense_payment_method"];
export type ExpenseApprovalStatus = Database["public"]["Enums"]["expense_approval_status"];

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

export const expenseMethodLabel: Record<ExpensePaymentMethod, string> = {
  cash: "Cash",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};
export const expenseMethodOptions = Object.keys(expenseMethodLabel) as ExpensePaymentMethod[];
export const methodsRequiringReference: ExpensePaymentMethod[] = ["bkash", "nagad", "bank_transfer", "cheque"];

export const expenseStatusLabel: Record<ExpenseApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type ManagerExpense = {
  id: string;
  building_id: string;
  building_name: string;
  expense_date: string;
  accounting_month: string;
  category: ExpenseCategory;
  description: string;
  vendor_name: string | null;
  amount: number;
  payment_method: ExpensePaymentMethod;
  approval_status: ExpenseApprovalStatus;
  reviewer_note: string | null;
  receipt_document_url: string | null;
};

const SELECT_COLUMNS =
  "id, building_id, expense_date, accounting_month, category, description, vendor_name, amount, payment_method, approval_status, reviewer_note, receipt_document_url, buildings(name)";

function normalize(raw: unknown): ManagerExpense {
  const row = raw as Record<string, unknown> & { buildings?: { name: string } | null };
  return {
    id: row["id"] as string,
    building_id: row["building_id"] as string,
    building_name: row.buildings?.name ?? "—",
    expense_date: row["expense_date"] as string,
    accounting_month: row["accounting_month"] as string,
    category: row["category"] as ExpenseCategory,
    description: row["description"] as string,
    vendor_name: (row["vendor_name"] as string | null) ?? null,
    amount: Number(row["amount"] ?? 0),
    payment_method: row["payment_method"] as ExpensePaymentMethod,
    approval_status: row["approval_status"] as ExpenseApprovalStatus,
    reviewer_note: (row["reviewer_note"] as string | null) ?? null,
    receipt_document_url: (row["receipt_document_url"] as string | null) ?? null,
  };
}

export function useManagerExpenses(buildingId: string, monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<ManagerExpense[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      let query = supabase
        .from("building_expenses")
        .select(SELECT_COLUMNS)
        .order("expense_date", { ascending: false });
      if (buildingId && buildingId !== "all") query = query.eq("building_id", buildingId);
      if (monthInput) query = query.eq("accounting_month", monthToDate(monthInput));

      const { data, error } = await query;
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }
      state.setData((data ?? []).map(normalize));
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId, monthInput],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { expenses: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export function describeExpenseError(message: string) {
  if (message.includes("month_closed")) {
    return "That accounting month is closed. Post this expense into the next open month instead.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to record expenses for this building.";
  }
  return message;
}

export type CreateExpenseInput = {
  buildingId: string;
  expenseDate: string; // yyyy-MM-dd
  accountingMonthInput: string; // yyyy-MM
  category: ExpenseCategory;
  description: string;
  vendorName: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  transactionReference: string;
  receiptImage: ImagePickerAsset | null;
};

export function validateExpenseInput(input: CreateExpenseInput): string | null {
  if (!input.buildingId) return "Select the building this expense belongs to.";
  if (!input.expenseDate) return "Expense date is required.";
  if (!input.accountingMonthInput) return "Posted accounting month is required.";
  if (!input.description.trim()) return "Description is required.";
  if (!(Number.isFinite(input.amount) && input.amount > 0)) return "Amount must be greater than zero.";
  if (methodsRequiringReference.includes(input.paymentMethod) && !input.transactionReference.trim()) {
    return "A transaction or cheque reference is required for digital and bank payments.";
  }
  return null;
}

async function uploadReceipt(buildingId: string, image: ImagePickerAsset) {
  const response = await fetch(image.uri);
  const fileData = await response.arrayBuffer();
  const extension = image.fileName?.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${buildingId}/${Crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, fileData, {
    contentType: image.mimeType ?? "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload the receipt: ${error.message}`);
  return path;
}

export async function createExpense(input: CreateExpenseInput) {
  const invalid = validateExpenseInput(input);
  if (invalid) throw new Error(invalid);

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in.");

  const receiptPath = input.receiptImage ? await uploadReceipt(input.buildingId, input.receiptImage) : null;

  const { error } = await supabase.from("building_expenses").insert({
    building_id: input.buildingId,
    expense_date: input.expenseDate,
    accounting_month: monthToDate(input.accountingMonthInput),
    category: input.category,
    description: input.description.trim(),
    vendor_name: input.vendorName.trim() || null,
    amount: input.amount,
    payment_method: input.paymentMethod,
    transaction_reference: input.transactionReference.trim() || null,
    receipt_document_url: receiptPath,
    created_by: userId,
  });
  if (error) throw new Error(describeExpenseError(error.message));
}

export async function createReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the receipt: ${error.message}`);
  return data.signedUrl;
}
