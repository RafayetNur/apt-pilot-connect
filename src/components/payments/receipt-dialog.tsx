import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRent } from "@/lib/flats";
import { formatDateTime, paymentMethodLabel, type PaymentRow } from "@/lib/payments";
import { formatMonth } from "@/lib/rent";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ReceiptDialog({
  payment,
  onClose,
}: {
  payment: PaymentRow | null;
  onClose: () => void;
}) {
  const open = Boolean(payment && payment.verification_status === "verified");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment receipt</DialogTitle>
        </DialogHeader>
        {payment ? (
          <div id="aptpilot-receipt" className="rounded-xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-xl font-semibold">AptPilot</p>
              <p className="text-xs text-muted-foreground">Rent payment receipt</p>
            </div>
            <p className="mt-1 text-sm font-medium">{payment.receipt_number ?? "—"}</p>
            <div className="mt-4">
              <Line label="Tenant" value={payment.tenant_name} />
              <Line label="Building" value={payment.building_name} />
              <Line label="Flat" value={payment.flat_number} />
              <Line
                label="Billing month"
                value={payment.billing_month ? formatMonth(payment.billing_month) : "—"}
              />
              <Line label="Base rent" value={formatRent(payment.base_rent)} />
              <Line label="Amount received" value={formatRent(payment.amount_paid)} />
              <Line label="Applied to rent" value={formatRent(payment.applied_amount)} />
              <Line label="Payment method" value={paymentMethodLabel[payment.payment_method]} />
              {payment.transaction_reference ? (
                <Line label="Transaction reference" value={payment.transaction_reference} />
              ) : null}
              <Line label="Remaining due" value={formatRent(payment.record_remaining_due)} />
              {payment.credit_amount > 0 ? (
                <Line label="Advance credit created" value={formatRent(payment.credit_amount)} />
              ) : null}
              <Line label="Verified by" value={payment.reviewer_name || "—"} />
              <Line label="Verified at" value={formatDateTime(payment.verified_at)} />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>Print receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
