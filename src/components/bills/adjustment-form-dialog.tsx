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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  adjustmentCategoryLabel,
  adjustmentCategoryOptions,
  type AdjustmentCategory,
  type AdjustmentTarget,
  type AdjustmentType,
} from "@/lib/adjustments";
import { formatRent } from "@/lib/flats";
import { formatMonth } from "@/lib/rent";

export type AdjustmentFormValues = {
  target: AdjustmentTarget;
  postedMonth: string;
  adjustmentType: AdjustmentType;
  category: AdjustmentCategory;
  amount: number;
  reason: string;
  documentFile: File | null;
};

export function AdjustmentFormDialog({
  open,
  onOpenChange,
  targets,
  month,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  targets: AdjustmentTarget[];
  month: string;
  saving: boolean;
  onSubmit: (values: AdjustmentFormValues) => void;
}) {
  const [recordId, setRecordId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("debit");
  const [category, setCategory] = useState<AdjustmentCategory>("water");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRecordId(targets[0]?.rentRecordId ?? "");
    setAdjustmentType("debit");
    setCategory("water");
    setAmount("");
    setReason("");
    setFile(null);
    setError("");
  }, [open, targets]);

  const target = targets.find((item) => item.rentRecordId === recordId) ?? null;
  const parsed = Number(amount);
  const preview =
    target && Number.isFinite(parsed) && parsed > 0
      ? target.totalPayable + (adjustmentType === "debit" ? parsed : -parsed)
      : null;

  const handleSubmit = () => {
    if (!target) {
      setError("Select the flat this adjustment belongs to.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!reason.trim()) {
      setError("Explain why this adjustment is needed.");
      return;
    }
    setError("");
    onSubmit({
      target,
      postedMonth: month,
      adjustmentType,
      category,
      amount: parsed,
      reason,
      documentFile: file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create bill adjustment</DialogTitle>
          <DialogDescription>
            Adjustments handle late or corrected charges without touching an existing bill, payment
            or receipt. Nothing changes until the adjustment is approved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="adjustment-flat">Flat &amp; tenant</Label>
            <Select value={recordId} onValueChange={setRecordId}>
              <SelectTrigger id="adjustment-flat">
                <SelectValue placeholder="Select a billed flat" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((item) => (
                  <SelectItem key={item.rentRecordId} value={item.rentRecordId}>
                    Flat {item.flatNumber} · {item.tenantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {targets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No rent record exists for this building and month yet.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adjustment-type">Type</Label>
              <Select
                value={adjustmentType}
                onValueChange={(value) => setAdjustmentType(value as AdjustmentType)}
              >
                <SelectTrigger id="adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit — increases payable</SelectItem>
                  <SelectItem value="credit">Credit — reduces payable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as AdjustmentCategory)}
              >
                <SelectTrigger id="adjustment-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adjustmentCategoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {adjustmentCategoryLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-amount">Amount (Tk)</Label>
            <Input
              id="adjustment-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {target ? (
              <p className="text-xs text-muted-foreground">
                {formatMonth(target.billingMonth)} bill · payable {formatRent(target.totalPayable)} ·
                verified paid {formatRent(target.totalPaid)} · remaining{" "}
                {formatRent(target.remainingDue)}
                {preview !== null ? ` → revised payable ${formatRent(Math.max(preview, 0))}` : ""}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-reason">Reason</Label>
            <Textarea
              id="adjustment-reason"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Water bill for June arrived after the bill was paid."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment-document">Supporting document (optional)</Label>
            <Input
              id="adjustment-document"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Stored privately. Only you, the building reviewers and this tenant can open it.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || targets.length === 0}>
            {saving ? "Saving…" : "Create adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
