import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import { RecordCashDialog, type CashPaymentValues } from "@/components/payments/record-cash-dialog";
import {
  ReviewPaymentDialog,
  type PaymentDialogAction,
} from "@/components/payments/review-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildingsQueryOptions } from "@/lib/buildings";
import { formatRent } from "@/lib/flats";
import {
  createProofSignedUrl,
  formatDateTime,
  paymentMethodLabel,
  recordCashPayment,
  reviewPayment,
  reviewPaymentsQueryOptions,
  verificationStatusLabel,
  withdrawPayment,
  type PaymentFilters,
  type PaymentRow,
  type ReviewAction,
  type VerificationStatus,
} from "@/lib/payments";
import { formatMonth } from "@/lib/rent";

const statusVariant: Record<
  VerificationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  verified: "default",
  pending: "secondary",
  rejected: "destructive",
  correction_requested: "outline",
  withdrawn: "outline",
  cancelled: "outline",
};

export function PaymentsReviewPage({ role }: { role: "owner" | "manager" }) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PaymentFilters>({ buildingId: "all", status: "pending" });
  const [reviewTarget, setReviewTarget] = useState<{
    payment: PaymentRow;
    action: PaymentDialogAction;
  } | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);
  const [cashOpen, setCashOpen] = useState(false);

  const { data: buildings } = useQuery(buildingsQueryOptions());
  const { data, isLoading, error } = useQuery(reviewPaymentsQueryOptions(filters));
  const rows = data ?? [];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rent-payments"] }),
      queryClient.invalidateQueries({ queryKey: ["rent-records"] }),
      queryClient.invalidateQueries({ queryKey: ["building-credits"] }),
    ]);
  };

  const reviewMutation = useMutation({
    mutationFn: async ({
      paymentId,
      action,
      note,
    }: {
      paymentId: string;
      action: PaymentDialogAction;
      note: string;
    }) =>
      action === "cancel"
        ? withdrawPayment(paymentId, note)
        : reviewPayment(paymentId, action as ReviewAction, note),
    onSuccess: async (_result, variables) => {
      setReviewTarget(null);
      toast.success(
        variables.action === "cancel"
          ? "Submission cancelled. The tenant can submit a new payment."
          : variables.action === "verify"
            ? "Payment verified and applied to the rent record."
            : variables.action === "reject"
              ? "Payment rejected."
              : "Correction requested from the tenant.",
      );
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cashMutation = useMutation({
    mutationFn: async (values: CashPaymentValues) =>
      recordCashPayment({
        rentRecordId: values.rentRecordId,
        buildingId: values.buildingId,
        flatId: values.flatId,
        tenantId: values.tenantId,
        amountPaid: values.amountPaid,
        note: values.note,
      }),
    onSuccess: async () => {
      setCashOpen(false);
      toast.success("Cash payment recorded as pending. Confirm it to verify.");
      await invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openProof = async (path: string) => {
    try {
      const url = await createProofSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Payments</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review tenant payment submissions and record cash collected in person.
          </p>
        </div>
        <Button onClick={() => setCashOpen(true)}>Record cash payment</Button>
      </div>

      <section className="panel mt-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment-building">Building</Label>
            <Select
              value={filters.buildingId}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, buildingId: value }))}
            >
              <SelectTrigger id="payment-building">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buildings</SelectItem>
                {(buildings ?? []).map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-status">Verification status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value as PaymentFilters["status"] }))
              }
            >
              <SelectTrigger id="payment-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending verification</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="correction_requested">Correction requested</SelectItem>
                <SelectItem value="withdrawn">Withdrawn by tenant</SelectItem>
                <SelectItem value="cancelled">Cancelled by reviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading payment submissions…</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Could not load payments: {(error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <div className="panel py-10 text-center">
            <p className="font-display text-lg font-semibold">No payment submissions</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "owner"
                ? "Submissions from tenants in your buildings will appear here."
                : "Submissions from tenants in your assigned buildings will appear here."}
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <article key={row.id} className="panel p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{row.tenant_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.building_name} · Flat {row.flat_number} ·{" "}
                    {row.billing_month ? formatMonth(row.billing_month) : "—"}
                  </p>
                </div>
                <Badge variant={statusVariant[row.verification_status]}>
                  {verificationStatusLabel[row.verification_status]}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Rent amount" value={formatRent(row.base_rent)} />
                <Field label="Amount paid" value={formatRent(row.amount_paid)} />
                <Field label="Remaining due" value={formatRent(row.record_remaining_due)} />
                <Field label="Method" value={paymentMethodLabel[row.payment_method]} />
                <Field label="Provider" value={row.provider_name || "—"} />
                <Field label="Reference" value={row.transaction_reference || "—"} />
                <Field label="Submitted" value={formatDateTime(row.submitted_at)} />
                <Field label="Reviewer" value={row.reviewer_name || "—"} />
                <Field
                  label={row.verification_status === "verified" ? "Verified at" : "Reviewed at"}
                  value={formatDateTime(row.verified_at)}
                />
              </dl>

              {row.reviewer_note ? (
                <p className="mt-3 rounded-xl bg-surface p-3 text-sm">
                  <span className="text-muted-foreground">Reviewer note: </span>
                  {row.reviewer_note}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {row.payment_proof_url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void openProof(row.payment_proof_url!)}
                  >
                    View proof
                  </Button>
                ) : null}
                {row.verification_status === "verified" ? (
                  <Button variant="outline" size="sm" onClick={() => setReceipt(row)}>
                    View receipt
                  </Button>
                ) : row.verification_status === "withdrawn" ||
                  row.verification_status === "cancelled" ? (
                  <p className="text-sm text-muted-foreground">
                    This submission is closed and was never applied to the rent record.
                  </p>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setReviewTarget({ payment: row, action: "verify" })}
                    >
                      {row.payment_method === "cash" ? "Confirm cash & verify" : "Verify"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setReviewTarget({ payment: row, action: "correction_requested" })
                      }
                    >
                      Request correction
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setReviewTarget({ payment: row, action: "reject" })}
                    >
                      Reject
                    </Button>
                    {row.verification_status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReviewTarget({ payment: row, action: "cancel" })}
                      >
                        Cancel submission
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      <ReviewPaymentDialog
        payment={reviewTarget?.payment ?? null}
        action={reviewTarget?.action ?? null}
        saving={reviewMutation.isPending}
        onClose={() => setReviewTarget(null)}
        onConfirm={(note) => {
          if (!reviewTarget) return;
          reviewMutation.mutate({
            paymentId: reviewTarget.payment.id,
            action: reviewTarget.action,
            note,
          });
        }}
      />

      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />

      <RecordCashDialog
        open={cashOpen}
        onOpenChange={setCashOpen}
        buildings={buildings ?? []}
        saving={cashMutation.isPending}
        onSubmit={(values) => cashMutation.mutate(values)}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{value}</dd>
    </div>
  );
}
