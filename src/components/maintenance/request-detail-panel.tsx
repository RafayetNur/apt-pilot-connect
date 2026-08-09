import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  AttachmentList,
  AttachmentPicker,
  CommentThread,
  DetailRow,
  EmergencyNotice,
  PriorityBadge,
  StatusBadge,
  Timeline,
  useInvalidateMaintenance,
} from "@/components/maintenance/parts";
import { WorkOrderSection } from "@/components/maintenance/work-order-section";
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
import { Textarea } from "@/components/ui/textarea";
import type { AppRole } from "@/hooks/useAuth";
import { formatDate } from "@/lib/rent";
import {
  ageInDays,
  allowedTransitions,
  assignMaintenanceRequest,
  changeMaintenanceStatus,
  durationLabel,
  formatDateTime,
  maintenanceAttachmentsQueryOptions,
  maintenanceCategoryLabel,
  maintenanceCommentsQueryOptions,
  maintenancePriorityLabel,
  maintenancePriorityOptions,
  maintenanceStatusLabel,
  maintenanceTimelineQueryOptions,
  setMaintenancePriority,
  tenantScheduleQueryOptions,
  uploadMaintenanceAttachments,
  workOrderStatusLabel,
  type MaintenancePriority,
  type MaintenanceRow,
  type MaintenanceStatus,
} from "@/lib/maintenance";

const noteRequiredFor: MaintenanceStatus[] = [
  "resolved",
  "rejected",
  "cancelled",
  "reopened",
];

export function RequestDetailPanel({
  request,
  role,
  currentUserId,
  isOwnerOfBuilding,
  assignable,
}: {
  request: MaintenanceRow;
  role: AppRole;
  currentUserId: string | undefined;
  isOwnerOfBuilding: boolean;
  assignable: Array<{ id: string; full_name: string; role: string }>;
}) {
  const canManage = role === "owner" || role === "manager";
  const isRequester = request.submitted_by === currentUserId || request.tenant_id === currentUserId;
  const invalidate = useInvalidateMaintenance(request.id);

  const timelineQuery = useQuery(maintenanceTimelineQueryOptions(request.id));
  const attachmentsQuery = useQuery(maintenanceAttachmentsQueryOptions(request.id));
  const commentsQuery = useQuery(maintenanceCommentsQueryOptions(request.id));
  const scheduleQuery = useQuery({
    ...tenantScheduleQueryOptions(request.id),
    enabled: !canManage,
  });

  const [statusTarget, setStatusTarget] = useState<MaintenanceStatus | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const uploadMutation = useMutation({
    mutationFn: () => uploadMaintenanceAttachments(request.id, files),
    onSuccess: async () => {
      toast.success("Attachment uploaded.");
      setFiles([]);
      await invalidate();
      await attachmentsQuery.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: (assignedTo: string | null) => assignMaintenanceRequest(request.id, assignedTo),
    onSuccess: async () => {
      toast.success("Assignment updated.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: MaintenancePriority) => setMaintenancePriority(request.id, priority),
    onSuccess: async () => {
      toast.success("Priority updated.");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Which transitions this viewer may actually perform.
  const actions = allowedTransitions[request.status].filter((next) => {
    if (next === "rejected") return isOwnerOfBuilding;
    if (next === "cancelled") return isRequester || isOwnerOfBuilding;
    if (next === "closed") return canManage || isRequester;
    if (next === "reopened") return canManage || isRequester;
    return canManage;
  });

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{request.request_number}</span>
          <StatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
        </div>
        <h2 className="font-display text-xl font-semibold">{request.title}</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{request.description}</p>
      </header>

      {request.priority === "emergency" ? <EmergencyNotice /> : null}

      <section className="rounded-xl border border-border/60 bg-surface p-3">
        <DetailRow label="Building" value={request.building_name} />
        <DetailRow
          label="Location"
          value={
            request.is_common_area
              ? "Common area"
              : request.flat_number
                ? `Flat ${request.flat_number}`
                : "—"
          }
        />
        <DetailRow label="Category" value={maintenanceCategoryLabel[request.category]} />
        <DetailRow label="Reported by" value={request.submitter_name} />
        {canManage ? <DetailRow label="Tenant" value={request.tenant_name ?? "—"} /> : null}
        <DetailRow label="Submitted" value={formatDateTime(request.created_at)} />
        <DetailRow label="Request age" value={`${ageInDays(request.created_at)} day(s)`} />
        <DetailRow
          label="Acknowledgement time"
          value={durationLabel(request.created_at, request.acknowledged_at)}
        />
        <DetailRow
          label="Resolution time"
          value={durationLabel(request.created_at, request.resolved_at)}
        />
        <DetailRow label="Assigned to" value={request.assignee_name ?? "Unassigned"} />
        <DetailRow
          label="Preferred visit"
          value={request.preferred_visit_date ? formatDate(request.preferred_visit_date) : "—"}
        />
        <DetailRow label="Access instructions" value={request.access_instructions ?? "—"} />
        {request.resolution_note ? (
          <DetailRow label="Resolution note" value={request.resolution_note} />
        ) : null}
        {request.rejection_reason ? (
          <DetailRow label="Rejection reason" value={request.rejection_reason} />
        ) : null}
        {request.cancellation_reason ? (
          <DetailRow label="Cancellation reason" value={request.cancellation_reason} />
        ) : null}
        {request.reopening_reason ? (
          <DetailRow label="Reopening reason" value={request.reopening_reason} />
        ) : null}
      </section>

      {canManage ? (
        <section className="grid gap-3 rounded-xl border border-border/60 bg-surface p-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="detail-assign">Assign to</Label>
            <Select
              value={request.assigned_to ?? "none"}
              onValueChange={(value) => assignMutation.mutate(value === "none" ? null : value)}
            >
              <SelectTrigger id="detail-assign">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {assignable.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-priority">Priority</Label>
            <Select
              value={request.priority}
              onValueChange={(value) => priorityMutation.mutate(value as MaintenancePriority)}
            >
              <SelectTrigger id="detail-priority">
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
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="flex flex-wrap gap-2">
          {actions.map((next) => (
            <Button
              key={next}
              size="sm"
              variant={next === "rejected" || next === "cancelled" ? "outline" : "default"}
              onClick={() => setStatusTarget(next)}
            >
              {next === "closed" && isRequester && !canManage
                ? "Confirm fixed & close"
                : next === "reopened"
                  ? isRequester && !canManage
                    ? "Request reopening"
                    : "Reopen"
                  : `Mark ${maintenanceStatusLabel[next].toLowerCase()}`}
            </Button>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="font-display text-base font-semibold">Status timeline</h3>
        {timelineQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : (
          <Timeline events={timelineQuery.data ?? []} />
        )}
      </section>

      {canManage ? (
        <section>
          <WorkOrderSection requestId={request.id} canManage assignable={assignable} />
        </section>
      ) : (
        <section className="space-y-2">
          <h3 className="font-display text-base font-semibold">Scheduled work</h3>
          {scheduleQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading schedule…</p>
          ) : (scheduleQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No visit has been scheduled yet.</p>
          ) : (
            <ul className="space-y-2">
              {(scheduleQuery.data ?? []).map((row) => (
                <li
                  key={row.work_order_number}
                  className="rounded-xl border border-border/60 bg-surface p-3 text-sm"
                >
                  <p className="font-medium">
                    {row.scheduled_date ? formatDate(row.scheduled_date) : "Date to be confirmed"}
                    {row.scheduled_time ? ` · ${row.scheduled_time}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {workOrderStatusLabel[row.status]}
                    {row.technician_name ? ` · Technician: ${row.technician_name}` : ""}
                  </p>
                  <p className="mt-1">{row.work_description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-display text-base font-semibold">Attachments</h3>
        {attachmentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading attachments…</p>
        ) : (
          <AttachmentList attachments={attachmentsQuery.data ?? []} />
        )}
        <AttachmentPicker files={files} onChange={setFiles} label="Add an attachment" />
        <Button
          size="sm"
          variant="outline"
          disabled={files.length === 0 || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate()}
        >
          {uploadMutation.isPending ? "Uploading…" : "Upload"}
        </Button>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-semibold">Comments</h3>
        {commentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments…</p>
        ) : (
          <CommentThread
            requestId={request.id}
            comments={commentsQuery.data ?? []}
            canPostInternal={canManage}
            currentUserId={currentUserId}
          />
        )}
      </section>

      <StatusChangeDialog
        request={request}
        status={statusTarget}
        onClose={() => setStatusTarget(null)}
        onDone={invalidate}
      />
    </div>
  );
}

function StatusChangeDialog({
  request,
  status,
  onClose,
  onDone,
}: {
  request: MaintenanceRow;
  status: MaintenanceStatus | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const needsNote = status ? noteRequiredFor.includes(status) : false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!status) return;
      await changeMaintenanceStatus(request.id, status, note);
    },
    onSuccess: async () => {
      toast.success("Request updated.");
      setNote("");
      onClose();
      await onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(status)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {status ? `${maintenanceStatusLabel[status]} — ${request.request_number}` : ""}
          </DialogTitle>
          <DialogDescription>
            The database checks that this step is allowed and records who made it. Maintenance never
            changes rent, bills, payments or the monthly closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="status-note">
            {status === "resolved"
              ? "Resolution note (required — describe what was fixed)"
              : status === "rejected"
                ? "Rejection reason (required)"
                : status === "cancelled"
                  ? "Cancellation reason (required)"
                  : status === "reopened"
                    ? "Reopening reason (required)"
                    : "Note (optional)"}
          </Label>
          <Textarea
            id="status-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {status === "resolved" ? (
            <p className="text-xs text-muted-foreground">
              Attach completion proof in the attachments section where practical. All open work
              orders must be completed or cancelled first.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || (needsNote && !note.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
