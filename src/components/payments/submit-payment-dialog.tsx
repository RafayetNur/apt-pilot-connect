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
import { formatRent } from "@/lib/flats";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/payments";

export type SubmitPaymentValues = {
  amountPaid: number;
  paymentMethod: PaymentMethod;
  providerName: string;
  transactionReference: string;
  proofFile: File | null;
};

const tenantMethods: PaymentMethod[] = ["bkash", "nagad", "bank_transfer"];

export function SubmitPaymentDialog({
  open,
  onOpenChange,
  remainingDue,
  billingMonthLabel,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remainingDue: number;
  billingMonthLabel: string;
  saving: boolean;
  onSubmit: (values: SubmitPaymentValues) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [provider, setProvider] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(remainingDue > 0 ? String(remainingDue) : "");
      setMethod("bkash");
      setProvider("");
      setReference("");
      setFile(null);
      setError("");
    }
  }, [open, remainingDue]);

  const handleSubmit = () => {
    const amountPaid = Number(amount);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!provider.trim()) {
      setError("Provider name is required for digital payments.");
      return;
    }
    if (!reference.trim()) {
      setError("Transaction reference is required for digital payments.");
      return;
    }
    if (!file) {
      setError("Upload a screenshot or photo of the payment as proof.");
      return;
    }
    setError("");
    onSubmit({
      amountPaid,
      paymentMethod: method,
      providerName: provider,
      transactionReference: reference,
      proofFile: file,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit payment</DialogTitle>
          <DialogDescription>
            {billingMonthLabel} · Remaining due {formatRent(remainingDue)}. Your owner or manager
            will verify this submission before it is applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount paid (৳)</Label>
            <Input
              id="pay-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">Payment method</Label>
            <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
              <SelectTrigger id="pay-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tenantMethods.map((item) => (
                  <SelectItem key={item} value={item}>
                    {paymentMethodLabel[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cash payments are recorded by your owner or manager.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-provider">Provider name</Label>
            <Input
              id="pay-provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="bKash personal, City Bank…"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-reference">Transaction reference</Label>
            <Input
              id="pay-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="TrxID / slip number"
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-proof">Payment proof</Label>
            <Input
              id="pay-proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Kept private — only you and your building reviewers can open it.
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting…" : "Submit payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
