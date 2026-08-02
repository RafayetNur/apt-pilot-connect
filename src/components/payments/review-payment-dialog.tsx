import { useEffect, useState } from "react";

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
import { formatRent } from "@/lib/flats";
import type { PaymentRow, ReviewAction } from "@/lib/payments";

const actionTitle: Record<ReviewAction, string> = {
  verify: "Verify payment",
  reject: "Reject payment",
  correction_requested: "Request correction",
};

export function ReviewPaymentDialog({
  payment,
  action,
  saving,
  onClose,
  onConfirm,
}: {
  payment: PaymentRow | null;
  action: ReviewAction | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setError("");
  }, [payment?.id, action]);

  const open = Boolean(payment && action);
  const noteRequired = action === "reject" || action === "correction_requested";

  const handleConfirm = () => {
    if (noteRequired && !note.trim()) {
      setError("A reviewer note is required for this action.");
      return;
    }
    setError("");
    onConfirm(note);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{action ? actionTitle[action] : "Review payment"}</DialogTitle>
          <DialogDescription>
            {payment
              ? `${payment.tenant_name} · Flat ${payment.flat_number} · ${formatRent(payment.amount_paid)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {action === "verify" && payment ? (
          <div className="space-y-2 rounded-xl bg-surface p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Remaining due before verification: </span>
              <span className="font-medium">{formatRent(payment.record_remaining_due)}</span>
            </p>
            <p className="text-muted-foreground">
              {payment.amount_paid > payment.record_remaining_due
                ? `${formatRent(payment.record_remaining_due)} will be applied to this rent record and ${formatRent(payment.amount_paid - payment.record_remaining_due)} will be stored as advance credit.`
                : "The full amount will be applied to this rent record."}
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="review-note">
            Reviewer note{noteRequired ? "" : " (optional)"}
          </Label>
          <Textarea
            id="review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder={
              noteRequired ? "Explain what the tenant needs to fix." : "Add a note for the record."
            }
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving…" : action ? actionTitle[action] : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
