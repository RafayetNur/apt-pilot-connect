import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AttachmentPicker } from "@/components/maintenance/parts";
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
import type { AppRole } from "@/hooks/useAuth";
import { flatsQueryOptions } from "@/lib/flats";
import {
  createMaintenanceRequest,
  maintenanceCategoryLabel,
  maintenanceCategoryOptions,
  maintenancePriorityLabel,
  maintenancePriorityOptions,
  uploadMaintenanceAttachments,
  validateRequestInput,
  type MaintenanceCategory,
  type MaintenancePriority,
} from "@/lib/maintenance";

export function RequestFormDialog({
  open,
  onOpenChange,
  role,
  buildings,
  defaultBuildingId,
  /** Tenants always report against their own flat, so the picker is hidden. */
  lockedFlatNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: AppRole;
  buildings: Array<{ id: string; name: string }>;
  defaultBuildingId: string;
  lockedFlatNumber?: string | null;
}) {
  const queryClient = useQueryClient();
  const isTenant = role === "tenant";

  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [flatId, setFlatId] = useState("");
  const [isCommonArea, setIsCommonArea] = useState(false);
  const [category, setCategory] = useState<MaintenanceCategory>("plumbing");
  const [priority, setPriority] = useState<MaintenancePriority>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredVisitDate, setPreferredVisitDate] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setBuildingId(defaultBuildingId);
    setFlatId("");
    setIsCommonArea(false);
    setCategory("plumbing");
    setPriority("medium");
    setTitle("");
    setDescription("");
    setPreferredVisitDate("");
    setAccessInstructions("");
    setFiles([]);
  }, [open, defaultBuildingId]);

  const flatsQuery = useQuery({
    ...flatsQueryOptions(buildingId),
    enabled: !isTenant && Boolean(buildingId) && open,
  });
  const flats = flatsQuery.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const request = await createMaintenanceRequest({
        buildingId,
        category,
        title,
        description,
        priority,
        isCommonArea,
        flatId: isTenant ? null : flatId || null,
        preferredVisitDate,
        accessInstructions,
      });
      if (files.length > 0) {
        await uploadMaintenanceAttachments(request.id, files);
      }
      return request;
    },
    onSuccess: async (request) => {
      toast.success(`Request ${request.request_number} submitted.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] }),
        queryClient.invalidateQueries({ queryKey: ["my-maintenance-requests"] }),
      ]);
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invalid = validateRequestInput({
    buildingId,
    category,
    title,
    description,
    priority,
    isCommonArea,
    flatId: isTenant ? "tenant-flat" : flatId || null,
    preferredVisitDate,
    accessInstructions,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Maintenance requests are operational records. They never change your rent, bills or
            payments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {isTenant ? (
              <div className="space-y-2">
                <Label>Building</Label>
                <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                  {buildings.find((item) => item.id === buildingId)?.name ?? "Your building"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="request-building">Building</Label>
                <Select value={buildingId} onValueChange={setBuildingId}>
                  <SelectTrigger id="request-building">
                    <SelectValue placeholder="Select building" />
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
            )}

            <div className="space-y-2">
              <Label htmlFor="request-scope">Where is the problem?</Label>
              <Select
                value={isCommonArea ? "common" : "flat"}
                onValueChange={(value) => setIsCommonArea(value === "common")}
              >
                <SelectTrigger id="request-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Inside a flat</SelectItem>
                  <SelectItem value="common">Common area of the building</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isCommonArea ? (
              isTenant ? (
                <div className="space-y-2">
                  <Label>Flat</Label>
                  <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                    {lockedFlatNumber ? `Flat ${lockedFlatNumber}` : "Your assigned flat"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="request-flat">Flat</Label>
                  <Select value={flatId} onValueChange={setFlatId}>
                    <SelectTrigger id="request-flat">
                      <SelectValue placeholder="Select flat" />
                    </SelectTrigger>
                    <SelectContent>
                      {flats.map((flat) => (
                        <SelectItem key={flat.id} value={flat.id}>
                          Flat {flat.flat_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="request-category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as MaintenanceCategory)}
              >
                <SelectTrigger id="request-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {maintenanceCategoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {maintenanceCategoryLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as MaintenancePriority)}
              >
                <SelectTrigger id="request-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {maintenancePriorityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {maintenancePriorityLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-visit">Preferred visit date (optional)</Label>
              <Input
                id="request-visit"
                type="date"
                value={preferredVisitDate}
                onChange={(event) => setPreferredVisitDate(event.target.value)}
              />
            </div>
          </div>

          {priority === "emergency" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              If anyone is in danger, call your building&apos;s emergency contact and the emergency
              services by phone now. Submitting this form only notifies the owner and manager inside
              AptPilot — nobody is dispatched automatically.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="request-title">Title</Label>
            <Input
              id="request-title"
              value={title}
              maxLength={160}
              placeholder="e.g. Kitchen tap leaking"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-description">Description</Label>
            <Textarea
              id="request-description"
              rows={4}
              maxLength={4000}
              value={description}
              placeholder="What is wrong, when it started, and anything already tried."
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-access">Access instructions (optional)</Label>
            <Textarea
              id="request-access"
              rows={2}
              maxLength={1000}
              value={accessInstructions}
              placeholder="e.g. Someone is home after 5pm; please call before arriving."
              onChange={(event) => setAccessInstructions(event.target.value)}
            />
          </div>

          <AttachmentPicker files={files} onChange={setFiles} />

          {invalid ? <p className="text-sm text-destructive">{invalid}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || Boolean(invalid)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
