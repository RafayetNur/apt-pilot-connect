import { useQuery } from "@tanstack/react-query";
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
import type { Building } from "@/lib/buildings";
import { formatRent } from "@/lib/flats";
import { formatMonth, rentRecordsQueryOptions } from "@/lib/rent";

export type CashPaymentValues = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  amountPaid: number;
  note: string;
};

export function RecordCashDialog({
  open,
  onOpenChange,
  buildings,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildings: Building[];
  saving: boolean;
  onSubmit: (values: CashPaymentValues) => void;
}) {
  const [buildingId, setBuildingId] = useState("");
  const [recordId, setRecordId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setBuildingId("");
      setRecordId("");
      setAmount("");
      setNote("");
      setError("");
    }
  }, [open]);

  const { data: records } = useQuery({
    ...rentRecordsQueryOptions({ buildingId: buildingId || "all", month: "", status: "all" }),
    enabled: open && Boolean(buildingId),
  });

  const dueRecords = (records ?? []).filter((row) => row.remaining_due > 0);
  const selected = dueRecords.find((row) => row.id === recordId) ?? null;

  const handleSubmit = () => {
    if (!selected) {
      setError("Select the rent record this cash payment belongs to.");
      return;
    }
    const amountPaid = Number(amount);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setError("");
    onSubmit({
      rentRecordId: selected.id,
      buildingId: selected.building_id,
      flatId: selected.flat_id,
      tenantId: selected.tenant_id,
      amountPaid,
      note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record cash payment</DialogTitle>
          <DialogDescription>
            The cash entry is created as pending and becomes verified only after you confirm it in
            the review list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cash-building">Building</Label>
            <Select
              value={buildingId}
              onValueChange={(value) => {
                setBuildingId(value);
                setRecordId("");
              }}
            >
              <SelectTrigger id="cash-building">
                <SelectValue placeholder="Select a building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-record">Rent record</Label>
            <Select value={recordId} onValueChange={setRecordId} disabled={!buildingId}>
              <SelectTrigger id="cash-record">
                <SelectValue
                  placeholder={
                    buildingId
                      ? "Select a rent record with a due amount"
                      : "Select a building first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {dueRecords.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {formatMonth(row.billing_month)} · Flat {row.flat_number} · {row.tenant_name} ·
                    due {formatRent(row.remaining_due)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {buildingId && dueRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No rent records with a remaining due amount in this building.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-amount">Amount received (৳)</Label>
            <Input
              id="cash-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cash-note">Reference note (optional)</Label>
            <Textarea
              id="cash-note"
              rows={2}
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Collected in person, receipt book no. 12"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Record cash payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
