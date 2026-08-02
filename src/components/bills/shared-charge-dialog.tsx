import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  computeEqualSplit,
  createSharedCharge,
  eligibleFlatsQueryOptions,
  sharedCategoryLabel,
  sharedCategoryOptions,
  type SharedChargeCategory,
} from "@/lib/charges";
import { formatRent } from "@/lib/flats";
import { formatMonth } from "@/lib/rent";

export function SharedChargeDialog({
  open,
  onOpenChange,
  buildingId,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  month: string;
}) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<SharedChargeCategory>("guard_salary");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCategory("guard_salary");
      setAmount("");
      setDescription("");
      setError("");
    }
  }, [open]);

  const eligibleQuery = useQuery({
    ...eligibleFlatsQueryOptions(buildingId, month),
    enabled: open && Boolean(buildingId) && Boolean(month),
  });
  const flats = eligibleQuery.data ?? [];

  const total = Number(amount);
  const validTotal = Number.isFinite(total) && total > 0;
  const shares = useMemo(
    () => (validTotal ? computeEqualSplit(total, flats.length) : []),
    [validTotal, total, flats.length]
  );
  const allocatedSum = shares.reduce((sum, value) => sum + value, 0);

  const mutation = useMutation({
    mutationFn: () =>
      createSharedCharge({
        buildingId,
        month,
        category,
        totalAmount: total,
        description,
      }),
    onSuccess: async (result) => {
      toast.success(`Shared charge split equally across ${result.flatCount} flats.`);
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shared-charges"] }),
        queryClient.invalidateQueries({ queryKey: ["bill-entry-rows"] }),
        queryClient.invalidateQueries({ queryKey: ["rent-records"] }),
      ]);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleConfirm = () => {
    if (!validTotal) {
      setError("Enter a total shared amount greater than zero.");
      return;
    }
    if (flats.length === 0) {
      setError(
        "No occupied flats have a rent record for this month, so this charge cannot be split."
      );
      return;
    }
    setError("");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add shared building charge</DialogTitle>
          <DialogDescription>
            {month ? formatMonth(`${month}-01`) : ""} · Split equally among occupied flats that
            already have a rent record for this month.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shared-category">Category</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as SharedChargeCategory)}
            >
              <SelectTrigger id="shared-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sharedCategoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {sharedCategoryLabel[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shared-amount">Total shared amount (৳)</Label>
            <Input
              id="shared-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shared-description">Description (optional)</Label>
            <Textarea
              id="shared-description"
              rows={2}
              maxLength={300}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="rounded-xl bg-surface p-4 text-sm">
            <p className="font-medium">Allocation preview</p>
            {eligibleQuery.isLoading ? (
              <p className="mt-2 text-muted-foreground">Checking occupied flats…</p>
            ) : flats.length === 0 ? (
              <p className="mt-2 text-muted-foreground">
                No occupied flats have a rent record for this month. Generate monthly rent first —
                nothing will be split.
              </p>
            ) : (
              <>
                <p className="mt-2 text-muted-foreground">
                  Total {validTotal ? formatRent(total) : "—"} · {flats.length} occupied flat
                  {flats.length === 1 ? "" : "s"} · allocated{" "}
                  {validTotal ? formatRent(allocatedSum) : "—"}
                </p>
                <ul className="mt-3 grid gap-1">
                  {flats.map((flat, index) => (
                    <li key={flat.rentRecordId} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Flat {flat.flatNumber} · {flat.tenantName}
                      </span>
                      <span className="font-medium">
                        {validTotal ? formatRent(shares[index] ?? 0) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Any rounding remainder is handed out one paisa at a time, so the shares always add
                  up to the exact total.
                </p>
              </>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mutation.isPending || flats.length === 0 || !validTotal}
          >
            {mutation.isPending ? "Saving…" : "Confirm split"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
