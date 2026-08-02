import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardSection, EmptyState, StatCard } from "@/components/dashboard/parts";
import { ReceiptDialog } from "@/components/payments/receipt-dialog";
import {
  SubmitPaymentDialog,
  type SubmitPaymentValues,
} from "@/components/payments/submit-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  flatChargeLabel,
  myMonthlyBillsQueryOptions,
  sharedCategoryLabel,
  type TenantMonthlyBill,
} from "@/lib/charges";
import { formatRent, myFlatQueryOptions, occupancyLabel } from "@/lib/flats";
import {
  createProofSignedUrl,
  formatDateTime,
  myCreditsQueryOptions,
  myPaymentsQueryOptions,
  paymentMethodLabel,
  submitTenantPayment,
  verificationStatusLabel,
  withdrawPayment,
  type PaymentRow,
  type VerificationStatus,
} from "@/lib/payments";
import {
  adjustmentCategoryLabel,
  adjustmentTypeLabel,
  approvalStatusLabel,
  myAdjustmentsQueryOptions,
  type ApprovalStatus,
} from "@/lib/adjustments";
import { formatDate, formatMonth, paymentStatusLabel, type PaymentStatus } from "@/lib/rent";

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
  withdrawn: "outline",
  cancelled: "outline",
};

const approvalVariant: Record<ApprovalStatus, "default" | "secondary" | "destructive"> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
};

export const Route = createFileRoute("/_authenticated/tenant/dashboard")({
  head: () => ({
    meta: [
      { title: "Tenant dashboard — AptPilot" },
      {
        name: "description",
        content:
          "See your monthly bill breakdown, total payable, remaining due, receipts and payment submissions on AptPilot.",
      },
      { property: "og:title", content: "Tenant dashboard — AptPilot" },
      {
        property: "og:description",
        content: "Your rent, utility bills, shared charges, payments and receipts in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenantDashboard,
});

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BillBreakdown({ bill }: { bill: TenantMonthlyBill }) {
  return (
    <div className="rounded-xl bg-surface p-4 text-sm">
      <BreakdownRow label="Base rent" value={formatRent(bill.base_rent)} />
      {bill.charges.length === 0 ? (
        <p className="py-1.5 text-xs text-muted-foreground">
          No utility or flat-specific bill has been entered for this month yet.
        </p>
      ) : (
        bill.charges.map((charge) => (
          <BreakdownRow
            key={charge.id}
            label={flatChargeLabel[charge.charge_type]}
            value={formatRent(charge.amount)}
          />
        ))
      )}
      {bill.sharedShares.map((share) => (
        <BreakdownRow
          key={share.id}
          label={`Shared · ${sharedCategoryLabel[share.category]}`}
          value={formatRent(share.allocated_amount)}
        />
      ))}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="font-semibold">Total payable</span>
        <span className="font-display text-base font-semibold">
          {formatRent(bill.total_payable)}
        </span>
      </div>
    </div>
  );
}

function PaymentHistoryItem({
  payment,
  onReceipt,
  onWithdraw,
  withdrawing,
}: {
  payment: PaymentRow;
  onReceipt: (payment: PaymentRow) => void;
  onWithdraw: (payment: PaymentRow) => void;
  withdrawing: boolean;
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
              {payment.receipt_number ? ` · ${payment.receipt_number}` : ""}
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
        {payment.verification_status === "pending" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={withdrawing}
            onClick={() => onWithdraw(payment)}
          >
            {withdrawing ? "Withdrawing…" : "Withdraw submission"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function TenantDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const flatQuery = useQuery(myFlatQueryOptions(user?.id));
  const billsQuery = useQuery(myMonthlyBillsQueryOptions(user?.id));
  const paymentsQuery = useQuery(myPaymentsQueryOptions(user?.id));
  const creditsQuery = useQuery(myCreditsQueryOptions(user?.id));
  const adjustmentsQuery = useQuery(myAdjustmentsQueryOptions(user?.id));

  const [submitFor, setSubmitFor] = useState<TenantMonthlyBill | null>(null);
  const [receipt, setReceipt] = useState<PaymentRow | null>(null);

  const bills = billsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const credits = creditsQuery.data ?? [];
  const availableCredit = credits.reduce((sum, credit) => sum + credit.remaining_amount, 0);

  const current = bills[0] ?? null;
  const currentPayments = current
    ? payments.filter((payment) => payment.rent_record_id === current.id)
    : [];
  const hasPending = currentPayments.some((payment) => payment.verification_status === "pending");
  const lastReview = currentPayments.find(
    (payment) =>
      payment.verification_status === "rejected" ||
      payment.verification_status === "correction_requested",
  );

  const submitMutation = useMutation({
    mutationFn: async ({
      bill,
      values,
    }: {
      bill: TenantMonthlyBill;
      values: SubmitPaymentValues;
    }) =>
      submitTenantPayment({
        rentRecordId: bill.id,
        buildingId: bill.building_id,
        flatId: bill.flat_id,
        tenantId: bill.tenant_id,
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
        queryClient.invalidateQueries({ queryKey: ["my-monthly-bills"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const withdrawMutation = useMutation({
    mutationFn: async (payment: PaymentRow) => withdrawPayment(payment.id, ""),
    onSuccess: async () => {
      toast.success("Submission withdrawn. You can submit a corrected payment now.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["my-rent-payments"] }),
        queryClient.invalidateQueries({ queryKey: ["my-monthly-bills"] }),
      ]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const adjustments = adjustmentsQuery.data ?? [];
  const flat = flatQuery.data;

  return (
    <DashboardShell
      role="tenant"
      title="Your monthly bill"
      intro={
        flat
          ? `${flat.building?.name ?? "Your building"} · Flat ${flat.flat.flat_number}`
          : "Your flat, bills, payments and receipts live here."
      }
    >
      {flatQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading your flat…</p>
      ) : !flat ? (
        <EmptyState>
          No flat has been assigned to your account yet. Your owner or manager will assign one.
        </EmptyState>
      ) : null}

      {current ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Billing month`}
              value={formatMonth(current.billing_month)}
              hint={`Due ${formatDate(current.due_date)}`}
            />
            <StatCard label="Total payable" value={formatRent(current.total_payable)} />
            <StatCard
              label="Verified paid"
              value={formatRent(current.total_paid)}
              tone="positive"
            />
            <StatCard
              label="Remaining due"
              value={formatRent(current.remaining_due)}
              tone="danger"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant[current.payment_status as PaymentStatus]}>
              {paymentStatusLabel[current.payment_status as PaymentStatus]}
            </Badge>
            {flat ? (
              <Badge variant={flat.flat.occupancy_status === "occupied" ? "default" : "secondary"}>
                {occupancyLabel[flat.flat.occupancy_status]}
              </Badge>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Advance credit available: {formatRent(availableCredit)}
            </span>
            {current.remaining_due > 0 && !hasPending ? (
              <Button size="sm" onClick={() => setSubmitFor(current)}>
                Submit payment
              </Button>
            ) : hasPending ? (
              <span className="text-sm text-muted-foreground">
                A submission is pending verification.
              </span>
            ) : null}
          </div>

          {lastReview?.reviewer_note ? (
            <p className="mt-3 rounded-xl border border-border/60 bg-card p-4 text-sm">
              <span className="font-medium">
                {verificationStatusLabel[lastReview.verification_status]}:{" "}
              </span>
              {lastReview.reviewer_note}
            </p>
          ) : null}

          <DashboardSection
            title="Current bill breakdown"
            description="Utility amounts are the final amounts printed on your provider bills."
          >
            <BillBreakdown bill={current} />
          </DashboardSection>
        </>
      ) : billsQuery.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading your bill…</p>
      ) : billsQuery.error ? (
        <p className="mt-6 text-sm text-destructive">
          Could not load your bill: {(billsQuery.error as Error).message}
        </p>
      ) : (
        <DashboardSection title="Current bill">
          <EmptyState>No rent bill has been generated for you yet.</EmptyState>
        </DashboardSection>
      )}

      {bills.length > 1 ? (
        <DashboardSection title="Earlier months" description="Each month keeps its own balance.">
          <ul className="grid gap-3">
            {bills.slice(1).map((bill) => (
              <li key={bill.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">
                      {formatMonth(bill.billing_month)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Payable {formatRent(bill.total_payable)} · Paid {formatRent(bill.total_paid)}{" "}
                      · Remaining {formatRent(bill.remaining_due)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={statusVariant[bill.payment_status as PaymentStatus]}>
                      {paymentStatusLabel[bill.payment_status as PaymentStatus]}
                    </Badge>
                    {bill.remaining_due > 0 &&
                    !payments.some(
                      (payment) =>
                        payment.rent_record_id === bill.id &&
                        payment.verification_status === "pending",
                    ) ? (
                      <Button size="sm" variant="outline" onClick={() => setSubmitFor(bill)}>
                        Submit payment
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3">
                  <BillBreakdown bill={bill} />
                </div>
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}

      <DashboardSection
        title="Payment history & receipts"
        description="Every submission you made, with reviewer notes and receipts."
      >
        {payments.length === 0 ? (
          <EmptyState>You have not submitted a payment yet.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {payments.map((payment) => (
              <PaymentHistoryItem
                key={payment.id}
                payment={payment}
                onReceipt={setReceipt}
                onWithdraw={(row) => withdrawMutation.mutate(row)}
                withdrawing={
                  withdrawMutation.isPending && withdrawMutation.variables?.id === payment.id
                }
              />
            ))}
          </ul>
        )}
      </DashboardSection>

      <DashboardSection
        title="Bill adjustments"
        description="Late or corrected charges. Only approved adjustments change what you owe."
      >
        {adjustments.length === 0 ? (
          <EmptyState>No adjustment has been made to your bills.</EmptyState>
        ) : (
          <ul className="grid gap-2">
            {adjustments.map((row) => (
              <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {row.adjustment_type === "debit" ? "+" : "−"}
                      {formatRent(row.amount)} · {adjustmentCategoryLabel[row.category]} (
                      {adjustmentTypeLabel[row.adjustment_type]})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMonth(row.original_billing_month)} bill · posted to{" "}
                      {formatMonth(row.posted_billing_month)}
                    </p>
                  </div>
                  <Badge variant={approvalVariant[row.approval_status]}>
                    {approvalStatusLabel[row.approval_status]}
                  </Badge>
                </div>
                <p className="mt-3 rounded-lg bg-surface p-3 text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  {row.reason}
                </p>
                {row.reviewer_note ? (
                  <p className="mt-2 rounded-lg bg-surface p-3 text-sm">
                    <span className="text-muted-foreground">Reviewer note: </span>
                    {row.reviewer_note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>

      <DashboardSection
        title="Advance credit"
        description="From overpayments. It is not applied to a future month automatically yet."
      >
        {credits.length === 0 ? (
          <EmptyState>You have no advance credit.</EmptyState>
        ) : (
          <ul className="grid gap-2 text-sm">
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
        )}
      </DashboardSection>

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
          submitMutation.mutate({ bill: submitFor, values });
        }}
      />

      <ReceiptDialog payment={receipt} onClose={() => setReceipt(null)} />
    </DashboardShell>
  );
}
