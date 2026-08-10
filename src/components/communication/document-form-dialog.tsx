import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AudienceTargetPicker } from "@/components/communication/parts";
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
  createDocument,
  documentCategoryLabel,
  documentCategoryOptions,
  documentVisibilityLabel,
  documentVisibilityOptions,
  validateDocumentFile,
  type BuildingDocument,
  type DocumentCategory,
  type DocumentVisibility,
} from "@/lib/communication";

export function DocumentFormDialog({
  open,
  onOpenChange,
  buildings,
  defaultBuildingId,
  /** When set, the upload becomes a new version that replaces this document. */
  replaces,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildings: Array<{ id: string; name: string }>;
  defaultBuildingId: string;
  replaces?: BuildingDocument | null;
}) {
  const queryClient = useQueryClient();

  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("building_rule");
  const [visibility, setVisibility] = useState<DocumentVisibility>("all_building_tenants");
  const [flatIds, setFlatIds] = useState<string[]>([]);
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setBuildingId(replaces?.building_id ?? defaultBuildingId);
    setTitle(replaces?.title ?? "");
    setDescription(replaces?.description ?? "");
    setCategory(replaces?.category ?? "building_rule");
    setVisibility(replaces?.visibility ?? "all_building_tenants");
    setFlatIds([]);
    setTenantIds([]);
    setFile(null);
  }, [open, defaultBuildingId, replaces]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!buildingId) throw new Error("Choose the building this document belongs to.");
      if (title.trim().length < 3) throw new Error("Give the document a clear title.");
      if (!file) throw new Error("Choose a file to upload.");
      const invalid = validateDocumentFile(file);
      if (invalid) throw new Error(invalid);
      if (visibility === "selected_flats" && flatIds.length === 0) {
        throw new Error("Select at least one flat.");
      }
      if (visibility === "selected_tenants" && tenantIds.length === 0) {
        throw new Error("Select at least one tenant.");
      }
      await createDocument(
        {
          buildingId,
          title: title.trim(),
          description: description.trim(),
          category,
          visibility,
          flatIds,
          tenantIds,
          replacesDocumentId: replaces?.id ?? null,
        },
        file,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["building-documents"] });
      void queryClient.invalidateQueries({ queryKey: ["document-recipients"] });
      void queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] });
      toast.success(
        replaces
          ? "New version uploaded. The previous version was archived."
          : "Document shared.",
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not upload the document.");
    },
  });

  const busy = mutation.isPending;
  const needsTargets = visibility === "selected_flats" || visibility === "selected_tenants";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{replaces ? "Upload a new version" : "Share a document"}</DialogTitle>
          <DialogDescription>
            Files stay private. Only the people you choose can open them, through a short-lived
            secure link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-building">Building</Label>
              <Select
                value={buildingId}
                onValueChange={setBuildingId}
                disabled={Boolean(replaces)}
              >
                <SelectTrigger id="doc-building">
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
              <Label htmlFor="doc-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
                <SelectTrigger id="doc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentCategoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {documentCategoryLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Building rules and house guidelines"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description (optional)</Label>
            <Textarea
              id="doc-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-visibility">Who can open this</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as DocumentVisibility)}
            >
              <SelectTrigger id="doc-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentVisibilityOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {documentVisibilityLabel[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTargets ? (
            <div className="space-y-2">
              <Label>{visibility === "selected_flats" ? "Flats" : "Tenants"}</Label>
              <AudienceTargetPicker
                buildingId={buildingId}
                mode={visibility === "selected_flats" ? "flats" : "tenants"}
                selectedFlatIds={flatIds}
                selectedTenantIds={tenantIds}
                onFlatsChange={setFlatIds}
                onTenantsChange={setTenantIds}
                enabled={open}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <input
              id="doc-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG or DOCX · up to 20 MB.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={busy}>
            {busy ? "Uploading…" : replaces ? "Upload new version" : "Share document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
