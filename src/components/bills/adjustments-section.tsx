import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  AdjustmentFormDialog,
  type AdjustmentFormValues,
} from "@/components/bills/adjustment-form-dialog";
import { ReviewAdjustmentDialog } from "@/components/bills/review-adjustment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  adjustmentCategoryLabel,
  adjustmentsQueryOptions,
  adjustmentTargetsQueryOptions,
  approvalStatusLabel,
  createAdjustment,
  createDocumentSignedUrl,
  netAdjustment,
  reviewAdjustment,
  type AdjustmentReviewAction,
  type AdjustmentRow,
  type ApprovalStatus,
} from "@/lib/adjustments";
import { formatRent } from "@/lib/flats";
import { formatDateTime } from "@/lib/payments";
import { formatMonth } from "@/lib/rent";

const statusVariant: Record<ApprovalStatus, "default" | "secondary" | "destructive"> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
};

export function AdjustmentsSection({ buildingId, month }: { buildingId: string; month: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{
    adjustment: AdjustmentRow;
    action: AdjustmentReviewAction;
  } | null>(null);

  const listQuery = useQuery(adjustmentsQueryOptions(buildingId, month));
  const targetsQuery = useQuery(adjustmentTargetsQueryOptions(buildingId, month));
  const rows = listQuery.data ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bill-adjustments"] }),
      queryClient.invalidateQueries({ queryKey: ["adjustment-targets"] }),
      queryClient.invalidateQueries({ queryKey: ["bill-entry-rows"] }),
      queryClient.invalidateQueries({ queryKey: ["rent-records"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["building-credits"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (values: AdjustmentFormValues) =>
      createAdjustment({
        target: values.target,
        postedMonth: values.postedMonth,
        adjustmentType: values.adjustmentType,
        category: values.category,
        amount: values.amount,
        reason: values.reason,
        documentFile: values.documentFile,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      toast.success(
        "Adjustment created. It is pending approval and not yet in the payable amount.",
      );
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      note,
    }: {
      id: string;
      action: AdjustmentReviewAction;
      note: string;
    }) => reviewAdjustment(id, action, note),
    onSuccess: async (_result, variables) => {
      setReviewTarget(null);
      toast.success(
        variables.action === "approve"
          ? "Adjustment approved and applied to the monthly total."
          : "Adjustment rejected.",
      );
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDocument = async (path: string) => {
    try {
      const url = await createDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const pending = rows.filter((row) => row.approval_status === "pending");
  const approvedNet = netAdjustment(rows.filter((row) => row.approval_status === "approved"));

  return (
    <section className="panel mt-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Bill adjustments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Late or corrected charges for {month ? formatMonth(`${month}-01`) : "—"}. Approved net
            effect: {formatRent(approvedNet)} · {pending.length} awaiting approval.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!buildingId || !month}>
          Create adjustment
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading adjustments…</p>
      ) : listQuery.error ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load adjustments: {(listQuery.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          No adjustment has been posted for this month. Use an adjustment when a bill has to change
          after a payment already exists.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {row.adjustment_type === "debit" ? "Debit +" : "Credit −"}
                    {formatRent(row.amount)} · {adjustmentCategoryLabel[row.category]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.tenant_name} · {row.building_name} · Flat {row.flat_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Original month {formatMonth(row.original_billing_month)} · posted to{" "}
                    {formatMonth(row.posted_billing_month)}
                  </p>
                </div>
                <Badge variant={statusVariant[row.approval_status]}>
                  {approvalStatusLabel[row.approval_status]}
                </Badge>
              </div>

              <p className="mt-3 rounded-lg bg-surface p-3 text-sm">
                <span className="text-muted-foreground">Reason: </span>
                {row.reason}
              </p>

              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">Created by</dt>
                  <dd className="mt-1 font-medium">
                    {row.creator_name} · {formatDateTime(row.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">Reviewer</dt>
                  <dd className="mt-1 font-medium">{row.reviewer_name || "—"}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">Reviewed at</dt>
                  <dd className="mt-1 font-medium">
                    {row.approved_at ? formatDateTime(row.approved_at) : "—"}
                  </dd>
                </div>
              </dl>

              {row.reviewer_note ? (
                <p className="mt-3 rounded-lg bg-surface p-3 text-sm">
                  <span className="text-muted-foreground">Reviewer note: </span>
                  {row.reviewer_note}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {row.supporting_document_url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void openDocument(row.supporting_document_url!)}
                  >
                    View supporting document
                  </Button>
                ) : null}
                {row.approval_status === "pending" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setReviewTarget({ adjustment: row, action: "approve" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setReviewTarget({ adjustment: row, action: "reject" })}
                    >
                      Reject
                    </Button>
                    {row.created_by === user?.id ? (
                      <span className="self-center text-xs text-muted-foreground">
                        You created this one — another reviewer should approve it.
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AdjustmentFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        targets={targetsQuery.data ?? []}
        month={month}
        saving={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
      />

      <ReviewAdjustmentDialog
        adjustment={reviewTarget?.adjustment ?? null}
        action={reviewTarget?.action ?? null}
        saving={reviewMutation.isPending}
        onClose={() => setReviewTarget(null)}
        onConfirm={(note) => {
          if (!reviewTarget) return;
          reviewMutation.mutate({
            id: reviewTarget.adjustment.id,
            action: reviewTarget.action,
            note,
          });
        }}
      />
    </section>
  );
}
