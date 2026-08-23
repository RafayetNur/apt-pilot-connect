import { useState } from "react";

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
import type { Building } from "@/lib/buildings";
import { currentMonthInput, formatMonth } from "@/lib/rent";

export type GenerateRentValues = {
  buildingId: string;
  month: string;
  dueDate: string;
};

export function GenerateRentDialog({
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
  onSubmit: (values: GenerateRentValues) => void;
}) {
  const [buildingId, setBuildingId] = useState("");
  const [month, setMonth] = useState(currentMonthInput());
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const reset = () => {
    setError("");
    setConfirming(false);
  };

  const handleContinue = () => {
    if (!buildingId) {
      setError("Select a building.");
      return;
    }
    if (!month) {
      setError("Select a billing month.");
      return;
    }
    if (!dueDate) {
      setError("Select a due date.");
      return;
    }
    setError("");
    setConfirming(true);
  };

  const buildingName = buildings.find((b) => b.id === buildingId)?.name ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate monthly rent</DialogTitle>
          <DialogDescription>
            Rent records are created only for occupied flats that have a tenant assigned.
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-3 text-sm">
            <p>Please confirm before generating:</p>
            <ul className="space-y-1 rounded-xl bg-surface p-4">
              <li>
                <span className="text-muted-foreground">Building: </span>
                <span className="font-medium">{buildingName}</span>
              </li>
              <li>
                <span className="text-muted-foreground">Billing month: </span>
                <span className="font-medium">{formatMonth(`${month}-01`)}</span>
              </li>
              <li>
                <span className="text-muted-foreground">Due date: </span>
                <span className="font-medium">{dueDate}</span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              Flats already billed for this month will be skipped.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rent-building">Building</Label>
              <Select value={buildingId} onValueChange={setBuildingId}>
                <SelectTrigger id="rent-building">
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
              <Label htmlFor="rent-month">Billing month</Label>
              <Input
                id="rent-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rent-due">Due date</Label>
              <Input
                id="rent-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={saving}>
                Back
              </Button>
              <Button
                onClick={() => onSubmit({ buildingId, month, dueDate })}
                disabled={saving}
              >
                {saving ? "Generating…" : "Generate monthly rent"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleContinue}>Continue</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
