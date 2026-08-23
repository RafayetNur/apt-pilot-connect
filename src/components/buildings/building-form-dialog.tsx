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
import type { Building, BuildingInput, BuildingStatus } from "@/lib/buildings";

const emptyForm: BuildingInput = {
  name: "",
  address: "",
  area: "",
  floors: 0,
  total_flats: 0,
  assigned_manager: "",
  status: "active",
};

export function BuildingFormDialog({
  open,
  onOpenChange,
  building,
  onSubmit,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building?: Building | null;
  onSubmit: (input: BuildingInput) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BuildingInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      building
        ? {
            name: building.name,
            address: building.address,
            area: building.area,
            floors: building.floors,
            total_flats: building.total_flats,
            assigned_manager: building.assigned_manager,
            status: building.status,
          }
        : emptyForm,
    );
  }, [open, building]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return setError("Building name is required.");
    if (!form.address.trim()) return setError("Full address is required.");
    if (!form.area.trim()) return setError("Area is required.");
    setError(null);
    onSubmit({
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      area: form.area.trim(),
      assigned_manager: form.assigned_manager.trim(),
      floors: Number(form.floors) || 0,
      total_flats: Number(form.total_flats) || 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {building ? "Edit building" : "Add building"}
          </DialogTitle>
          <DialogDescription>
            {building
              ? "Update the details of this building."
              : "Register a new building in your portfolio."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="name">Building name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nabila Residence"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="address">Full address</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="House 12, Road 7, Dhanmondi, Dhaka 1205"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="area">Area</Label>
              <Input
                id="area"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="Dhanmondi"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manager">Assigned manager (optional)</Label>
              <Input
                id="manager"
                value={form.assigned_manager}
                onChange={(e) => setForm({ ...form, assigned_manager: e.target.value })}
                placeholder="Manager name or email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floors">Number of floors</Label>
              <Input
                id="floors"
                type="number"
                min={0}
                value={form.floors}
                onChange={(e) => setForm({ ...form, floors: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flats">Total flats</Label>
              <Input
                id="flats"
                type="number"
                min={0}
                value={form.total_flats}
                onChange={(e) => setForm({ ...form, total_flats: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm({ ...form, status: value as BuildingStatus })}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : building ? "Save changes" : "Add building"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
