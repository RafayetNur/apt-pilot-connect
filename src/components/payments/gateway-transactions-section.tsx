import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardSection, EmptyState } from "@/components/dashboard/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRent } from "@/lib/flats";
import {
  gatewayStatusLabel,
  gatewayStatusVariant,
  isExpiredCloseable,
  reconcileGatewayTransaction,
  reviewGatewayTransactionsQueryOptions,
  type ReconcileAction,
  type ReviewGatewayTransaction,
} from "@/lib/gateway-payments";
import { formatDateTime } from "@/lib/payments";
import { formatMonth } from "@/lib/rent";

const DEFAULT_VISIBLE_ROWS = 10;

/**
 * Reviewer-facing gateway ledger. There is deliberately no manual "mark paid"
 * control: every status change goes through the server-side reconciliation
 * endpoint, which asks SSLCOMMERZ and re-validates the amount itself.
 */
export function GatewayTransactionsSection() {
  const queryClient = useQueryClient();
  const query = useQuery(reviewGatewayTransactionsQueryOptions());
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ tranId, action }: { tranId: string; action: ReconcileAction }) =>
      reconcileGatewayTransaction(tranId, action),
    onSuccess: async (result) => {
      toast.success(
        result.changed
          ? `Updated with SSLCOMMERZ: ${gatewayStatusLabel[result.status]}.`
          : `No change — SSLCOMMERZ still reports ${gatewayStatusLabel[result.status]}.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["review-gateway-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["rent-payments-review"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setBusy(null),
  });

  const run = (transaction: ReviewGatewayTransaction, action: ReconcileAction) => {
    if (busy) return;
    setBusy(`${transaction.tran_id}:${action}`);
    mutation.mutate({ tranId: transaction.tran_id, action });
  };

  const rows = query.data ?? [];
  const visible = showAll ? rows : rows.slice(0, DEFAULT_VISIBLE_ROWS);

  return (
    <DashboardSection
      title="Gateway transactions"
      description="Online payment attempts. Reconciliation always asks SSLCOMMERZ — statuses are never set by hand."
      action={
        rows.length > DEFAULT_VISIBLE_ROWS ? (
          <Button variant="outline" size="sm" onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? "Show recent only" : `Show all ${rows.length}`}
          </Button>
        ) : null
      }
    >
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading gateway attempts…</p>
      ) : query.error ? (
        <p className="text-sm text-destructive">
          Could not load gateway attempts: {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState>No online payment attempt has been made yet.</EmptyState>
      ) : (
        <ul className="grid gap-2">
          {visible.map((row) => {
            const closeable = isExpiredCloseable(row);
            const checking = busy === `${row.tran_id}:check`;
            const closing = busy === `${row.tran_id}:close_expired`;
            return (
              <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.tenant_name} · Flat {row.flat_number} · {formatRent(row.expected_amount)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.building_name}
                      {row.billing_month ? ` · ${formatMonth(row.billing_month)}` : ""} ·{" "}
                      {formatDateTime(row.created_at)}
                    </p>
                  </div>
                  <Badge variant={gatewayStatusVariant[row.status]}>
                    {closeable ? "Expired" : gatewayStatusLabel[row.status]}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={Boolean(busy)}
                    onClick={() => run(row, "check")}
                  >
                    {checking ? "Checking…" : "Check with SSLCOMMERZ"}
                  </Button>
                  {closeable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(busy)}
                      onClick={() => run(row, "close_expired")}
                    >
                      {closing ? "Closing…" : "Close expired attempt"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}
