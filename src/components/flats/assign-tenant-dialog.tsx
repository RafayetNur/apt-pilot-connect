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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TenantProfile } from "@/lib/flats";

export function AssignTenantDialog({
  open,
  onOpenChange,
  flatNumber,
  tenants,
  loading,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flatNumber: string;
  tenants: TenantProfile[];
  loading: boolean;
  saving: boolean;
  onSubmit: (tenantId: string) => void;
}) {
  const [tenantId, setTenantId] = useState("");

  useEffect(() => {
    if (open) setTenantId("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign tenant to flat {flatNumber}</DialogTitle>
          <DialogDescription>
            Pick an existing tenant account. The flat becomes occupied once assigned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="tenant">Tenant</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading tenants…</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenant accounts exist yet. Tenants must register first.
            </p>
          ) : (
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger id="tenant">
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.full_name || tenant.email} — {tenant.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!tenantId || saving} onClick={() => onSubmit(tenantId)}>
            {saving ? "Assigning…" : "Assign tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
