import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/hooks/useAuth";
import { formatRent } from "@/lib/flats";
import { formatDateTime } from "@/lib/payments";
import { formatDate, formatMonth } from "@/lib/rent";
import {
  cancelExpense,
  createReceiptSignedUrl,
  expenseCategoryLabel,
  expenseMethodLabel,
  expenseQueryOptions,
  expenseStatusLabel,
  reviewExpense,
  type BuildingExpense,
} from "@/lib/expenses";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ExpenseDetailDialog({
  expense,
  onOpenChange,
  role,
  currentUserId,
  onEdit,
  onReplace,
}: {
  expense: BuildingExpense | null;
  onOpenChange: (open: boolean) => void;
  role: AppRole;
  currentUserId: string | undefined;
  onEdit: (expense: BuildingExpense) => void;
  onReplace: (expense: BuildingExpense) => void;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setReason("");
    setError("");
  }, [expense?.id]);

  const replacementQuery = useQuery(expenseQueryOptions(expense?.replaced_by_expense_id ?? null));
  const originalQuery = useQuery(expenseQueryOptions(expense?.replaces_expense_id ?? null));

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["building-expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["building-expenses-month"] }),
      queryClient.invalidateQueries({ queryKey: ["building-expense"] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: (action: "approve" | "reject") => reviewExpense(expense!.id, action, note),
    onSuccess: async (_data, action) => {
      toast.success(action === "approve" ? "Expense approved." : "Expense rejected.");
      onOpenChange(false);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelExpense(expense!.id, reason),
    onSuccess: async () => {
      toast.success("Expense cancelled. Record a corrected replacement if needed.");
      onOpenChange(false);
      await invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const receiptMutation = useMutation({
    mutationFn: () => createReceiptSignedUrl(expense!.receipt_document_url!),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!expense) return null;

  const isOwner = role === "owner";
  const isCreator = expense.created_by === currentUserId;
  const canReview = isOwner && expense.approval_status === "pending";
  const canEdit = expense.approval_status === "pending" && isCreator;
  const canCancel =
    (expense.approval_status === "approved" && isOwner) ||
    (expense.approval_status === "pending" && (isOwner || isCreator));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Expense detail
            <Badge variant={expense.approval_status === "approved" ? "default" : "secondary"}>
              {expenseStatusLabel[expense.approval_status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>{expense.description}</DialogDescription>
        </DialogHeader>

        <div>
          <Row label="Building" value={expense.building_name} />
          <Row label="Expense date" value={formatDate(expense.expense_date)} />
          <Row label="Posted accounting month" value={formatMonth(expense.accounting_month)} />
          {expense.related_month ? (
            <Row label="Related month" value={formatMonth(expense.related_month)} />
          ) : null}
          <Row label="Category" value={expenseCategoryLabel[expense.category]} />
          <Row label="Vendor" value={expense.vendor_name ?? "—"} />
          <Row label="Amount" value={formatRent(expense.amount)} />
          <Row label="Payment method" value={expenseMethodLabel[expense.payment_method]} />
          <Row label="Reference" value={expense.transaction_reference ?? "—"} />
          <Row label="Recorded by" value={expense.creator_name} />
          <Row
            label="Reviewer"
            value={
              expense.reviewer_name
                ? `${expense.reviewer_name} · ${formatDateTime(expense.approved_at)}`
                : "—"
            }
          />
          {expense.reviewer_note ? (
            <Row label="Reviewer note" value={expense.reviewer_note} />
          ) : null}
          {expense.cancelled_at ? (
            <Row
              label="Cancelled"
              value={`${expense.canceller_name ?? "—"} · ${formatDateTime(expense.cancelled_at)}`}
            />
          ) : null}
          {expense.cancellation_reason ? (
            <Row label="Cancellation reason" value={expense.cancellation_reason} />
          ) : null}
          {originalQuery.data ? (
            <Row
              label="Replaces"
              value={`${formatDate(originalQuery.data.expense_date)} · ${formatRent(originalQuery.data.amount)}`}
            />
          ) : null}
          {replacementQuery.data ? (
            <Row
              label="Replaced by"
              value={`${formatDate(replacementQuery.data.expense_date)} · ${formatRent(replacementQuery.data.amount)}`}
            />
          ) : null}
          <Row
            label="Receipt"
            value={
              expense.receipt_document_url ? (
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => receiptMutation.mutate()}
                  disabled={receiptMutation.isPending}
                >
                  {receiptMutation.isPending ? "Opening…" : "View / download"}
                </Button>
              ) : (
                "—"
              )
            }
          />
        </div>

        {canReview ? (
          <div className="space-y-2">
            <Label htmlFor="expense-review-note">Reviewer note (required to reject)</Label>
            <Textarea
              id="expense-review-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        ) : null}

        {canCancel ? (
          <div className="space-y-2">
            <Label htmlFor="expense-cancel-reason">Cancellation reason</Label>
            <Textarea
              id="expense-cancel-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Approved amounts are never overwritten. Cancel the wrong entry, then record a
              corrected replacement.
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="flex-wrap gap-2">
          {canEdit ? (
            <Button variant="outline" onClick={() => onEdit(expense)}>
              Edit
            </Button>
          ) : null}
          {expense.approval_status === "cancelled" && (isOwner || isCreator) ? (
            <Button variant="outline" onClick={() => onReplace(expense)}>
              Record replacement
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || !reason.trim()}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Cancel expense"}
            </Button>
          ) : null}
          {canReview ? (
            <>
              <Button
                variant="outline"
                onClick={() => reviewMutation.mutate("reject")}
                disabled={reviewMutation.isPending || !note.trim()}
              >
                Reject
              </Button>
              <Button
                onClick={() => reviewMutation.mutate("approve")}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? "Saving…" : "Approve"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
