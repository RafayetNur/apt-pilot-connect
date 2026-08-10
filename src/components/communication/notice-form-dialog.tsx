import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AudienceTargetPicker } from "@/components/communication/parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  createNoticeDraft,
  noticeAudienceLabel,
  noticeAudienceOptions,
  noticePriorityLabel,
  noticePriorityOptions,
  publishNotice,
  publishNoticeRevision,
  updateNoticeDraft,
  type Notice,
  type NoticeAudience,
  type NoticeInput,
  type NoticePriority,
} from "@/lib/communication";

export type NoticeDialogMode = "create" | "edit" | "revise";

function toInputValue(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function NoticeFormDialog({
  open,
  onOpenChange,
  mode,
  notice,
  buildings,
  defaultBuildingId,
  targetFlatIds = [],
  targetTenantIds = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: NoticeDialogMode;
  notice?: Notice | null;
  buildings: Array<{ id: string; name: string }>;
  defaultBuildingId: string;
  targetFlatIds?: string[];
  targetTenantIds?: string[];
}) {
  const queryClient = useQueryClient();

  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<NoticePriority>("normal");
  const [audienceType, setAudienceType] = useState<NoticeAudience>("all_tenants");
  const [flatIds, setFlatIds] = useState<string[]>([]);
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [requiresAck, setRequiresAck] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setConfirmed(false);
    if (notice && mode !== "create") {
      setBuildingId(notice.building_id);
      setTitle(notice.title);
      setContent(notice.content);
      setPriority(notice.priority);
      setAudienceType(notice.audience_type);
      setFlatIds(targetFlatIds);
      setTenantIds(targetTenantIds);
      setRequiresAck(notice.requires_acknowledgement);
      setEffectiveFrom(toInputValue(notice.effective_from));
      setExpiresAt(toInputValue(notice.expires_at));
      return;
    }
    setBuildingId(defaultBuildingId);
    setTitle("");
    setContent("");
    setPriority("normal");
    setAudienceType("all_tenants");
    setFlatIds([]);
    setTenantIds([]);
    setRequiresAck(false);
    setEffectiveFrom("");
    setExpiresAt("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, notice?.id, defaultBuildingId]);

  function buildInput(): NoticeInput {
    return {
      buildingId,
      title: title.trim(),
      content: content.trim(),
      priority,
      audienceType,
      requiresAcknowledgement: requiresAck,
      effectiveFrom: toIso(effectiveFrom),
      expiresAt: toIso(expiresAt),
      flatIds,
      tenantIds,
    };
  }

  function validate(): string | null {
    if (!buildingId) return "Choose the building this notice belongs to.";
    if (title.trim().length < 4) return "Give the notice a clear title.";
    if (content.trim().length < 10) return "Write the notice message.";
    if (audienceType === "selected_flats" && flatIds.length === 0) {
      return "Select at least one flat.";
    }
    if (audienceType === "selected_tenants" && tenantIds.length === 0) {
      return "Select at least one tenant.";
    }
    const from = toIso(effectiveFrom);
    const until = toIso(expiresAt);
    if (from && until && until <= from) {
      return "The expiry time must be after the effective time.";
    }
    if (mode === "revise" && reason.trim().length < 5) {
      return "Explain what changed in this revision.";
    }
    return null;
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notices"] });
    void queryClient.invalidateQueries({ queryKey: ["notice-recipients"] });
    void queryClient.invalidateQueries({ queryKey: ["notice-acknowledgements"] });
    void queryClient.invalidateQueries({ queryKey: ["in-app-notifications"] });
  };

  const mutation = useMutation({
    mutationFn: async (action: "draft" | "publish") => {
      const problem = validate();
      if (problem) throw new Error(problem);
      const input = buildInput();

      if (mode === "revise" && notice) {
        await publishNoticeRevision(notice.id, input, reason.trim(), confirmed);
        return "revised" as const;
      }
      if (mode === "edit" && notice) {
        await updateNoticeDraft(notice.id, input);
        if (action === "publish") await publishNotice(notice.id, confirmed);
        return action;
      }
      const created = await createNoticeDraft(input);
      if (action === "publish") await publishNotice(created.id, confirmed);
      return action;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(
        result === "revised"
          ? "Revision published. Tenants were notified and asked to acknowledge again."
          : result === "publish"
            ? "Notice published."
            : "Draft saved.",
      );
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save the notice.");
    },
  });

  const busy = mutation.isPending;
  const needsTargets = audienceType === "selected_flats" || audienceType === "selected_tenants";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "New notice"
              : mode === "edit"
                ? "Edit draft notice"
                : "Publish a revision"}
          </DialogTitle>
          <DialogDescription>
            {mode === "revise"
              ? "A published notice cannot be edited in place. This creates a new version, archives the old one and asks tenants to acknowledge again."
              : "Notices reach only the tenants you select. Nothing is sent by SMS or email — this is in-app only."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-building">Building</Label>
              <Select
                value={buildingId}
                onValueChange={setBuildingId}
                disabled={mode !== "create"}
              >
                <SelectTrigger id="notice-building">
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
              <Label htmlFor="notice-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as NoticePriority)}>
                <SelectTrigger id="notice-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noticePriorityOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {noticePriorityLabel[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Water supply interruption on Friday"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-content">Message</Label>
            <Textarea
              id="notice-content"
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Explain what is happening, when, and what tenants should do."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notice-audience">Who should see this</Label>
            <Select
              value={audienceType}
              onValueChange={(value) => setAudienceType(value as NoticeAudience)}
            >
              <SelectTrigger id="notice-audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {noticeAudienceOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {noticeAudienceLabel[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsTargets ? (
            <div className="space-y-2">
              <Label>{audienceType === "selected_flats" ? "Flats" : "Tenants"}</Label>
              <AudienceTargetPicker
                buildingId={buildingId}
                mode={audienceType === "selected_flats" ? "flats" : "tenants"}
                selectedFlatIds={flatIds}
                selectedTenantIds={tenantIds}
                onFlatsChange={setFlatIds}
                onTenantsChange={setTenantIds}
                enabled={open}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notice-from">Effective from (optional)</Label>
              <Input
                id="notice-from"
                type="datetime-local"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notice-until">Expires at (optional)</Label>
              <Input
                id="notice-until"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={requiresAck}
              onCheckedChange={(value) => setRequiresAck(value === true)}
            />
            <span>
              Ask tenants to acknowledge that they have read this notice
              <span className="mt-1 block text-xs text-muted-foreground">
                You will see who has acknowledged and who has not.
              </span>
            </span>
          </label>

          {mode === "revise" ? (
            <div className="space-y-2">
              <Label htmlFor="notice-reason">What changed?</Label>
              <Textarea
                id="notice-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Corrected the shutdown time from 9am to 11am."
              />
            </div>
          ) : null}

          <label className="flex items-start gap-2 rounded-xl border border-border/60 bg-surface p-3 text-sm">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <span>
              I have reviewed this notice and want to publish it to the selected audience.
              <span className="mt-1 block text-xs text-muted-foreground">
                Required before publishing. A published notice can only be revised, cancelled or
                archived — never silently edited.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {mode !== "revise" ? (
            <Button
              variant="secondary"
              onClick={() => mutation.mutate("draft")}
              disabled={busy}
            >
              {busy ? "Saving…" : "Save draft"}
            </Button>
          ) : null}
          <Button onClick={() => mutation.mutate("publish")} disabled={busy || !confirmed}>
            {busy ? "Publishing…" : mode === "revise" ? "Publish revision" : "Publish now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
