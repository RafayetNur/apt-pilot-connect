import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRent } from "@/lib/flats";
import { formatDateTime } from "@/lib/payments";
import {
  fetchGatewayStatus,
  gatewayStatusLabel,
  gatewayStatusVariant,
  initiateOnlinePayment,
  isOnlineAmountEligible,
  myGatewayTransactionsQueryOptions,
  MAX_ONLINE_AMOUNT_BDT,
  MIN_ONLINE_AMOUNT_BDT,
  recentPendingTransaction,
  SessionExpiredError,
} from "@/lib/gateway-payments";

export function BillPaymentOptions({
  rentRecordId,
  remainingDue,
  manualPending,
  onManual,
}: {
  rentRecordId: string;
  remainingDue: number;
  manualPending: boolean;
  onManual: () => void;
}) {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const transactionsQuery = useQuery(myGatewayTransactionsQueryOptions());
  const transactions = (transactionsQuery.data ?? []).filter(
    (item) => item.rent_record_id === rentRecordId,
  );
  const pending = recentPendingTransaction(transactions, rentRecordId);
  const eligible = isOnlineAmountEligible(remainingDue);

  const initiate = useMutation({
    mutationFn: () => initiateOnlinePayment(rentRecordId),
    onSuccess: (result) => {
      // Full-page navigation — the gateway is never embedded in an iframe.
      window.location.assign(result.gatewayUrl);
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof SessionExpiredError
          ? "Your session has expired. Please sign in again."
          : error.message,
      );
    },
  });

  const checkStatus = async (tranId: string) => {
    setChecking(true);
    try {
      const status = await fetchGatewayStatus(tranId);
      toast.success(`Payment status: ${gatewayStatusLabel[status]}`);
      await queryClient.invalidateQueries({ queryKey: ["gateway-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["my-monthly-bills"] });
      await queryClient.invalidateQueries({ queryKey: ["my-payments"] });
    } catch (error) {
      toast.error(
        error instanceof SessionExpiredError
          ? "Your session has expired. Please sign in again."
          : "Could not check the payment status right now.",
      );
    } finally {
      setChecking(false);
    }
  };

  if (remainingDue <= 0) {
    return <Badge variant="default">Paid</Badge>;
  }

  return (
    <div className="w-full max-w-full space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-sm font-semibold">Pay online with SSLCOMMERZ</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            You will be redirected to SSLCOMMERZ&rsquo;s secure checkout, where cards, mobile
            banking and internet banking channels may be offered. Availability depends on the
            gateway. Amount to pay now: <span className="font-medium">{formatRent(remainingDue)}</span>.
          </p>
          {eligible ? null : (
            <p className="mt-2 text-xs text-muted-foreground">
              Online payment is unavailable for this amount (it supports{" "}
              {formatRent(MIN_ONLINE_AMOUNT_BDT)} to {formatRent(MAX_ONLINE_AMOUNT_BDT)}). You can
              still submit a manual payment.
            </p>
          )}
          {pending ? (
            <p className="mt-2 text-xs text-muted-foreground">
              An online payment is already processing. Check its status before trying again.
            </p>
          ) : null}
          <Button
            className="mt-3 min-h-11 w-full"
            disabled={!eligible || initiate.isPending || Boolean(pending)}
            onClick={() => initiate.mutate()}
          >
            {initiate.isPending ? "Opening secure checkout…" : "Pay online with SSLCOMMERZ"}
          </Button>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-sm font-semibold">Submit manual payment</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Paid with bKash, Nagad or a bank transfer? Submit the transaction reference and proof.
            Manual submissions require verification by your manager or owner.
          </p>
          {manualPending ? (
            <p className="mt-2 text-xs text-muted-foreground">
              A submission is pending verification.
            </p>
          ) : null}
          <Button
            variant="outline"
            className="mt-3 min-h-11 w-full"
            disabled={manualPending}
            onClick={onManual}
          >
            Submit payment
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Payments are confirmed securely after verification by SSLCOMMERZ.
      </p>

      {transactions.length > 0 ? (
        <ul className="grid gap-2">
          {transactions.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-xs"
            >
              <span className="text-muted-foreground">
                {formatDateTime(item.created_at)} · {formatRent(item.expected_amount)}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={gatewayStatusVariant[item.status]}>
                  {gatewayStatusLabel[item.status]}
                </Badge>
                {item.status === "pending" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-9"
                    disabled={checking}
                    onClick={() => void checkStatus(item.tran_id)}
                  >
                    {checking ? "Checking…" : "Check payment status"}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
