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
import type { Flat, FlatInput, OccupancyStatus } from "@/lib/flats";

const emptyForm: FlatInput = {
  flat_number: "",
  floor_number: 0,
  bedroom_count: 0,
  bathroom_count: 0,
  size_sqft: 0,
  monthly_rent: 0,
  occupancy_status: "vacant",
  notes: "",
};

export function FlatFormDialog({
  open,
  onOpenChange,
  flat,
  existingNumbers,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flat?: Flat | null;
  existingNumbers: string[];
  onSubmit: (input: FlatInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FlatInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      flat
        ? {
            flat_number: flat.flat_number,
            floor_number: flat.floor_number,
            bedroom_count: flat.bedroom_count,
            bathroom_count: flat.bathroom_count,
            size_sqft: flat.size_sqft,
            monthly_rent: flat.monthly_rent,
            occupancy_status: flat.occupancy_status,
            notes: flat.notes,
          }
        : emptyForm,
    );
  }, [open, flat]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const flatNumber = form.flat_number.trim();
    if (!flatNumber) return setError("Flat number is required.");
    const duplicate = existingNumbers
      .filter((value) => value.toLowerCase() !== (flat?.flat_number ?? "").toLowerCase())
      .some((value) => value.toLowerCase() === flatNumber.toLowerCase());
    if (duplicate) return setError("A flat with this number already exists in this building.");
    if (!(Number(form.monthly_rent) > 0)) return setError("Monthly rent must be greater than 0.");
    setError(null);
    onSubmit({
      ...form,
      flat_number: flatNumber,
      notes: form.notes.trim(),
      floor_number: Number(form.floor_number) || 0,
      bedroom_count: Number(form.bedroom_count) || 0,
      bathroom_count: Number(form.bathroom_count) || 0,
      size_sqft: Number(form.size_sqft) || 0,
      monthly_rent: Number(form.monthly_rent),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{flat ? "Edit flat" : "Add flat"}</DialogTitle>
          <DialogDescription>
            {flat ? "Update the details of this flat." : "Add a new flat to this building."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="flat_number">Flat number</Label>
              <Input
                id="flat_number"
                value={form.flat_number}
                onChange={(e) => setForm({ ...form, flat_number: e.target.value })}
                placeholder="A1"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floor_number">Floor</Label>
              <Input
                id="floor_number"
                type="number"
                min={0}
                value={form.floor_number}
                onChange={(e) => setForm({ ...form, floor_number: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bedroom_count">Bedrooms</Label>
              <Input
                id="bedroom_count"
                type="number"
                min={0}
                value={form.bedroom_count}
                onChange={(e) => setForm({ ...form, bedroom_count: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bathroom_count">Bathrooms</Label>
              <Input
                id="bathroom_count"
                type="number"
                min={0}
                value={form.bathroom_count}
                onChange={(e) => setForm({ ...form, bathroom_count: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="size_sqft">Size (sqft)</Label>
              <Input
                id="size_sqft"
                type="number"
                min={0}
                value={form.size_sqft}
                onChange={(e) => setForm({ ...form, size_sqft: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="monthly_rent">Monthly rent (BDT)</Label>
              <Input
                id="monthly_rent"
                type="number"
                min={1}
                step="0.01"
                value={form.monthly_rent}
                onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="occupancy_status">Occupancy status</Label>
            <Select
              value={form.occupancy_status}
              onValueChange={(value) =>
                setForm({ ...form, occupancy_status: value as OccupancyStatus })
              }
            >
              <SelectTrigger id="occupancy_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Corner unit, south facing balcony"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : flat ? "Save changes" : "Add flat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
