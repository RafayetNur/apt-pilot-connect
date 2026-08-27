import { supabase } from "@/lib/supabase";
import { describeExpenseError } from "@/lib/manager/expenses";

/**
 * Owner building-expense entries. Data loading, creation and category/method
 * labels are identical between owner and manager (same `building_expenses`
 * table, same `expense-receipts` bucket, same validation) — re-exported from
 * mobile/lib/manager/expenses.ts rather than duplicated, per AGENTS.md's
 * "reuse Manager utilities where permissions and semantics are genuinely
 * shared" guidance. The one owner-only capability, reviewing an expense
 * (approve/reject) and cancelling an approved one, is added here: only the
 * owner can call `review_building_expense` / `cancel_building_expense` — a
 * manager's new expense always lands "pending" and stays that way until an
 * owner reviews it.
 */
export {
  RECEIPT_BUCKET,
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseMethodLabel,
  expenseMethodOptions,
  expenseStatusLabel,
  methodsRequiringReference,
  createExpense,
  createReceiptSignedUrl,
  describeExpenseError,
  useManagerExpenses as useOwnerExpenses,
  type ManagerExpense as OwnerExpense,
  type ExpenseCategory,
  type ExpensePaymentMethod,
  type ExpenseApprovalStatus,
  type CreateExpenseInput,
} from "@/lib/manager/expenses";

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

export async function cancelExpense(id: string, reason: string) {
  if (!reason.trim()) throw new Error("A cancellation reason is required.");
  const { error } = await supabase.rpc("cancel_building_expense", {
    _expense_id: id,
    _reason: reason.trim(),
  });
  if (error) throw new Error(describeExpenseError(error.message));
}
