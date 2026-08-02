import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import {
  SubmitPaymentDialog,
  type SubmitPaymentValues,
} from "@/components/payments/submit-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatRent, myFlatQueryOptions, occupancyLabel } from "@/lib/flats";
import {
  createProofSignedUrl,
  formatDateTime,
  myCreditsQueryOptions,
  myPaymentsQueryOptions,
  paymentMethodLabel,
  submitTenantPayment,
  verificationStatusLabel,
  type PaymentRow,
  type VerificationStatus,
} from "@/lib/payments";
import {
  formatDate,
  formatMonth,
  myRentRecordsQueryOptions,
  paymentStatusLabel,
  type PaymentStatus,
  type RentRecord,
} from "@/lib/rent";

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partially_paid: "outline",
  unpaid: "secondary",
  overdue: "destructive",
};

const verificationVariant: Record<
  VerificationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  verified: "default",
  pending: "secondary",
  rejected: "destructive",
  correction_requested: "outline",
};

export const Route = createFileRoute("/_authenticated/tenant/dashboard")({
  head: () => ({
    meta: [
      { title: "Tenant dashboard — AptPilot" },
      {
        name: "description",
        content:
          "Tenant workspace for your flat details, rent bills, payment submissions and receipts on AptPilot.",
      },
      { property: "og:title", content: "Tenant dashboard — AptPilot" },
      { property: "og:description", content: "Your AptPilot tenant workspace." },
    ],
  }),
  component: TenantDashboard,
});

function AssignedFlatSection() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery(myFlatQueryOptions(user?.id));

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold">Your flat</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading your flat…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not load your flat: {(error as Error).message}
        </p>
      ) : !data ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No flat has been assigned to your account yet.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Building</dt>
            <dd className="mt-1 text-sm font-medium">{data.building?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
            <dd className="mt-1 text-sm font-medium">{data.building?.address || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Flat number</dt>
            <dd className="mt-1 text-sm font-medium">{data.flat.flat_number}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Floor</dt>
            <dd className="mt-1 text-sm font-medium">{data.flat.floor_number}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Monthly rent</dt>
            <dd className="mt-1 text-sm font-medium">{formatRent(data.flat.monthly_rent)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge
                variant={data.flat.occupancy_status === "occupied" ? "default" : "secondary"}
              >
                {occupancyLabel[data.flat.occupancy_status]}
              </Badge>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function CreditSection() {
  const { user } = useAuth();
  const { data } = useQuery(myCreditsQueryOptions(user?.id));
  const credits = data ?? [];
  const available = credits.reduce((sum, credit) => sum + credit.remaining_amount, 0);

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold">Advance credit</h2>
      <p className="mt-2 font-display text-3xl font-semibold">{formatRent(available)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Available advance credit from overpayments. It is not applied to a future month
        automatically yet — your owner or manager will adjust it.
      </p>
      {credits.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm">
          {credits.map((credit) => (
            <li
              key={credit.id}
              className="flex items-center justify-between rounded-xl bg-surface px-4 py-2"
            >
              <span className="text-muted-foreground">{formatDateTime(credit.created_at)}</span>
              <span className="font-medium">
                {formatRent(credit.remaining_amount)} of {formatRent(credit.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function PaymentHistoryItem({
  payment,
  onReceipt,
}: {
  payment: PaymentRow;
  onReceipt: (payment: PaymentRow) => void;
}) {
  const openProof = async () => {
    if (!payment.payment_proof_url) return;
    try {
      const url = await createProofSignedUrl(payment.payment_proof_url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <li className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {formatRent(payment.amount_paid)} · {paymentMethodLabel[payment.payment_method]}
          </p>
          <p className="text-xs text-muted-foreground">
            Submitted {formatDateTime(payment.submitted_at)}
            {payment.transaction_reference ? ` · Ref ${payment.transaction_reference}` : ""}
          </p>
          {payment.verification_status === "verified" ? (
            <p className="text-xs text-muted-foreground">
              Verified by {payment.reviewer_name || "reviewer"} on{" "}
              {formatDateTime(payment.verified_at)}
            </p>
          ) : null}
        </div>
        <Badge variant={verificationVariant[payment.verification_status]}>
          {verificationStatusLabel[payment.verification_status]}
        </Badge>
      </div>
      {payment.reviewer_note ? (
        <p className="mt-3 rounded-lg bg-surface p-3 text-sm">
          <span className="text-muted-foreground">Reviewer note: </span>
          {payment.reviewer_note}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {payment.payment_proof_url ? (
          <Button variant="outline" size="sm" onClick={() => void openProof()}>
            View proof
          </Button>
        ) : null}
        {payment.verification_status === "verified" ? (
          <Button variant="outline" size="sm" onClick={() => onReceipt(payment)}>
            View receipt
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function MyRentSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(myRentRecordsQueryOptions(user?.id));
  const { data: payments } = useQuery(myPaymentsQueryOptions(user?.id));
  const [submitFor, setSubmitFor] = useState<RentRecord | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);

  const rows = data ?? [];
  const allPayments = payments ?? [];

  const submitMutation = useMutation({
    mutationFn: async ({
      record,
      values,
    }: {
      record: RentRecord;
      values: SubmitPaymentValues;
    }) =>
      submitTenantPayment({
        rentRecordId: record.id,
        buildingId: record.building_id,
        flatId: record.flat_id,
        tenantId: record.tenant_id,
        amountPaid: values.amountPaid,
        paymentMethod: values.paymentMethod,
        providerName: values.providerName,
        transactionReference: values.transactionReference,
        proofFile: values.proofFile,
      }),
    onSuccess: async () => {
      setSubmitFor(null);
      toast.success("Payment submitted. It is now pending verification.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-rent-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["my-rent-records"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold">Your rent bills</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading your rent bills…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not load your rent bills: {(error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No rent bill has been generated for this month.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {rows.map((row) => {
            const recordPayments = allPayments.filter((p) => p.rent_record_id === row.id);
            const hasPending = recordPayments.some((p) => p.verification_status === "pending");
            const canSubmit = row.remaining_due > 0 && !hasPending;

            return (
              <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">
                      {formatMonth(row.billing_month)}
                    </p>
                    <p className="mt-1 text-sm">
                      Base rent {formatRent(row.base_rent)} · Paid {formatRent(row.total_paid)} ·
                      Remaining {formatRent(row.remaining_due)}
                    </p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(row.due_date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={statusVariant[row.payment_status]}>
                      {paymentStatusLabel[row.payment_status]}
                    </Badge>
                    {canSubmit ? (
                      <Button size="sm" onClick={() => setSubmitFor(row)}>
                        Submit payment
                      </Button>
                    ) : hasPending ? (
                      <p className="text-xs text-muted-foreground">
                        A submission is pending verification
                      </p>
                    ) : null}
                  </div>
                </div>

                {recordPayments.length > 0 ? (
                  <ul className="mt-4 grid gap-2">
                    {recordPayments.map((payment) => (
                      <PaymentHistoryItem
                        key={payment.id}
                        payment={payment}
                        onReceipt={setReceipt}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <SubmitPaymentDialog
        open={Boolean(submitFor)}
        onOpenChange={(next) => {
          if (!next) setSubmitFor(null);
        }}
        remainingDue={submitFor?.remaining_due ?? 0}
        billingMonthLabel={submitFor ? formatMonth(submitFor.billing_month) : ""}
        saving={submitMutation.isPending}
        onSubmit={(values) => {
          if (!submitFor) return;
          submitMutation.mutate({ record: submitFor, values });
        }}
      />

      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </section>
  );
}

function TenantDashboard() {
  return (
    <DashboardShell
      role="tenant"
      title="Tenant dashboard"
      intro="This is your tenant workspace. Your flat details, rent bills and payment submissions live here."
    >
      <AssignedFlatSection />
      <MyRentSection />
      <CreditSection />
    </DashboardShell>
  );
}
