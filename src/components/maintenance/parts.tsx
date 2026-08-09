import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addMaintenanceComment,
  attachmentTypeLabel,
  createAttachmentSignedUrl,
  formatDateTime,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  type MaintenanceAttachment,
  type MaintenanceComment,
  type MaintenancePriority,
  type MaintenanceStatus,
  type MaintenanceStatusEvent,
} from "@/lib/maintenance";

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const tone =
    priority === "emergency"
      ? "bg-destructive text-destructive-foreground"
      : priority === "high"
        ? "bg-accent text-accent-foreground"
        : priority === "medium"
          ? "bg-secondary text-secondary-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {priority === "emergency" ? "Emergency" : maintenancePriorityLabel[priority]}
    </span>
  );
}

export function StatusBadge({ status }: { status: MaintenanceStatus }) {
  const variant =
    status === "resolved" || status === "closed"
      ? "default"
      : status === "rejected" || status === "cancelled"
        ? "outline"
        : "secondary";
  return <Badge variant={variant}>{maintenanceStatusLabel[status]}</Badge>;
}

export function EmergencyNotice() {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <p className="font-semibold">Emergency request</p>
      <p className="mt-1 text-muted-foreground">
        If anyone&apos;s safety is at risk, contact your building&apos;s emergency contact and the
        national emergency services directly by phone right now. AptPilot only records this request
        for the owner and manager — it does not call anyone and does not dispatch a technician.
      </p>
    </div>
  );
}

export function Timeline({ events }: { events: MaintenanceStatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No history recorded yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-border pl-3">
          <p className="text-sm font-medium">
            {event.previous_status && event.previous_status !== event.new_status
              ? `${maintenanceStatusLabel[event.previous_status]} → ${maintenanceStatusLabel[event.new_status]}`
              : maintenanceStatusLabel[event.new_status]}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(event.created_at)} · {event.performer_name}
          </p>
          {event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function AttachmentList({ attachments }: { attachments: MaintenanceAttachment[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function open(path: string) {
    setBusy(path);
    try {
      const url = await createAttachmentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the attachment.");
    } finally {
      setBusy(null);
    }
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No attachments.</p>;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
        >
          <span className="min-w-0 flex-1 truncate">
            {item.file_name}
            <span className="ml-2 text-xs text-muted-foreground">
              {attachmentTypeLabel[item.attachment_type]} ·{" "}
              {Math.max(1, Math.round(item.file_size / 1024))} KB
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy === item.storage_path}
            onClick={() => void open(item.storage_path)}
          >
            {busy === item.storage_path ? "Opening…" : "View"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function AttachmentPicker({
  files,
  onChange,
  label = "Attach photos, videos or documents",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="maintenance-attachments">{label}</Label>
      <input
        id="maintenance-attachments"
        type="file"
        multiple
        accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
        className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        onChange={(event) => onChange(Array.from(event.target.files ?? []))}
      />
      <p className="text-xs text-muted-foreground">
        JPG, PNG, WEBP, MP4, MOV, WEBM or PDF · up to 25 MB each. Files stay private and are only
        visible to you, your manager and the building owner.
      </p>
      {files.length > 0 ? (
        <p className="text-xs text-muted-foreground">{files.length} file(s) selected.</p>
      ) : null}
    </div>
  );
}

export function CommentThread({
  requestId,
  comments,
  canPostInternal,
  currentUserId,
}: {
  requestId: string;
  comments: MaintenanceComment[];
  canPostInternal: boolean;
  currentUserId: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);

  const mutation = useMutation({
    mutationFn: () => addMaintenanceComment(requestId, text, internal ? "internal" : "shared"),
    onSuccess: async () => {
      setText("");
      toast.success(internal ? "Internal note added." : "Comment posted.");
      await queryClient.invalidateQueries({ queryKey: ["maintenance-comments", requestId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={cn(
                "rounded-xl border p-3 text-sm",
                comment.visibility === "internal"
                  ? "border-dashed border-border bg-muted"
                  : "border-border/60 bg-surface",
              )}
            >
              <p className="text-xs text-muted-foreground">
                {comment.author_name}
                {comment.author_id === currentUserId ? " (you)" : ""} ·{" "}
                {formatDateTime(comment.created_at)}
                {comment.visibility === "internal" ? " · internal note" : ""}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{comment.comment_text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Label htmlFor="maintenance-comment">Add a comment</Label>
        <Textarea
          id="maintenance-comment"
          rows={3}
          value={text}
          maxLength={2000}
          placeholder="Share an update…"
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canPostInternal ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={internal}
                onChange={(event) => setInternal(event.target.checked)}
              />
              Internal note (not visible to the tenant)
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              Your comments are visible to the owner and manager of this building.
            </span>
          )}
          <Button
            size="sm"
            disabled={mutation.isPending || !text.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Posting…" : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useInvalidateMaintenance(requestId: string | null) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["maintenance-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["my-maintenance-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["maintenance-request", requestId ?? "none"] }),
      queryClient.invalidateQueries({ queryKey: ["maintenance-timeline", requestId ?? "none"] }),
      queryClient.invalidateQueries({ queryKey: ["work-orders", requestId ?? "none"] }),
      queryClient.invalidateQueries({
        queryKey: ["maintenance-tenant-schedule", requestId ?? "none"],
      }),
    ]);
  };
}

/** Small read-only key/value row reused by the detail panels. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value}</span>
    </div>
  );
}

export function useSchedulePreview(requestId: string | null) {
  return useQuery({
    queryKey: ["maintenance-tenant-schedule", requestId ?? "none"],
    enabled: false,
  });
}
