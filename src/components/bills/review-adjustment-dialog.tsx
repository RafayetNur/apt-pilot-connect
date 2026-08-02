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
import {
  adjustmentCategoryLabel,
  type AdjustmentReviewAction,
  type AdjustmentRow,
} from "@/lib/adjustments";
import { formatRent } from "@/lib/flats";

export function ReviewAdjustmentDialog({
  adjustment,
  action,
  saving,
  onClose,
  onConfirm,
}: {
  adjustment: AdjustmentRow | null;
  action: AdjustmentReviewAction | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setError("");
  }, [adjustment?.id, action]);

  const open = Boolean(adjustment && action);
  const noteRequired = action === "reject";

  const handleConfirm = () => {
    if (noteRequired && !note.trim()) {
      setError("A reviewer note is required when rejecting an adjustment.");
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
          <DialogTitle>
            {action === "approve" ? "Approve adjustment" : "Reject adjustment"}
          </DialogTitle>
          <DialogDescription>
            {adjustment
              ? `${adjustment.tenant_name} · Flat ${adjustment.flat_number} · ${
                  adjustment.adjustment_type === "debit" ? "+" : "−"
                }${formatRent(adjustment.amount)} · ${adjustmentCategoryLabel[adjustment.category]}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {action === "approve" && adjustment ? (
          <div className="space-y-2 rounded-xl bg-surface p-4 text-sm text-muted-foreground">
            <p>
              Approving updates the monthly total payable and remaining due in one transaction.
              Existing verified payments and receipts stay exactly as they are.
            </p>
            {adjustment.adjustment_type === "credit" ? (
              <p>
                If the tenant has already paid more than the revised total, the extra amount becomes
                advance credit.
              </p>
            ) : (
              <p>
                If the month was already fully paid, it moves back to partially paid and the tenant
                can submit another payment.
              </p>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="adjustment-review-note">
            Reviewer note{noteRequired ? "" : " (optional)"}
          </Label>
          <Textarea
            id="adjustment-review-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder={
              noteRequired ? "Explain why this adjustment is rejected." : "Add a note for the record."
            }
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving}
            variant={action === "reject" ? "destructive" : "default"}
          >
            {saving ? "Saving…" : action === "approve" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
