import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const MAINTENANCE_BUCKET = "maintenance-attachments";

export type MaintenanceCategory =
  | "plumbing"
  | "electrical"
  | "gas"
  | "water"
  | "appliance"
  | "structural"
  | "lift"
  | "security"
  | "cleanliness"
  | "common_area"
  | "internet"
  | "pest_control"
  | "other";

export const maintenanceCategoryLabel: Record<MaintenanceCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  gas: "Gas",
  water: "Water supply",
  appliance: "Appliance",
  structural: "Structural",
  lift: "Lift",
  security: "Security",
  cleanliness: "Cleanliness",
  common_area: "Common area",
  internet: "Internet",
  pest_control: "Pest control",
  other: "Other",
};

export const maintenanceCategoryOptions = Object.keys(
  maintenanceCategoryLabel,
) as MaintenanceCategory[];

export type MaintenancePriority = "low" | "medium" | "high" | "emergency";

export const maintenancePriorityLabel: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  emergency: "Emergency",
};

export const maintenancePriorityOptions = Object.keys(
  maintenancePriorityLabel,
) as MaintenancePriority[];

/** Emergency first, then high → low. Used for the owner/manager queue order. */
export const priorityRank: Record<MaintenancePriority, number> = {
  emergency: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type MaintenanceStatus =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "waiting_for_parts"
  | "resolved"
  | "closed"
  | "rejected"
  | "cancelled"
  | "reopened";

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_for_parts: "Waiting for parts",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  reopened: "Reopened",
};

export const maintenanceStatusOptions = Object.keys(
  maintenanceStatusLabel,
) as MaintenanceStatus[];

/** Mirrors public.maintenance_transition_allowed in the database. */
export const allowedTransitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  submitted: ["acknowledged", "rejected", "cancelled"],
  acknowledged: ["assigned", "rejected", "cancelled"],
  assigned: ["in_progress"],
  in_progress: ["waiting_for_parts", "resolved"],
  waiting_for_parts: ["in_progress"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  rejected: [],
  cancelled: [],
  reopened: ["acknowledged", "assigned", "in_progress"],
};

export const openStatuses: MaintenanceStatus[] = [
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "waiting_for_parts",
  "reopened",
];

export function isOpenStatus(status: MaintenanceStatus) {
  return openStatuses.includes(status);
}

export type WorkOrderStatus = "draft" | "assigned" | "in_progress" | "completed" | "cancelled";

export const workOrderStatusLabel: Record<WorkOrderStatus, string> = {
  draft: "Draft",
  assigned: "Assigned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const workOrderTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export type AttachmentType = "issue_photo" | "issue_video" | "document" | "completion_proof";

export const attachmentTypeLabel: Record<AttachmentType, string> = {
  issue_photo: "Photo",
  issue_video: "Video",
  document: "Document",
  completion_proof: "Completion proof",
};

export type MaintenanceRequest = {
  id: string;
  request_number: string;
  building_id: string;
  flat_id: string | null;
  tenant_id: string | null;
  submitted_by: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  preferred_visit_date: string | null;
  access_instructions: string | null;
  is_common_area: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  closed_by: string | null;
  closed_at: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  reopening_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRow = MaintenanceRequest & {
  building_name: string;
  flat_number: string | null;
  tenant_name: string | null;
  submitter_name: string;
  assignee_name: string | null;
};

export type MaintenanceStatusEvent = {
  id: string;
  maintenance_request_id: string;
  previous_status: MaintenanceStatus | null;
  new_status: MaintenanceStatus;
  performed_by: string;
  note: string | null;
  created_at: string;
  performer_name: string;
};

export type MaintenanceAttachment = {
  id: string;
  maintenance_request_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  attachment_type: AttachmentType;
  created_at: string;
};

export type MaintenanceComment = {
  id: string;
  maintenance_request_id: string;
  author_id: string;
  comment_text: string;
  visibility: "shared" | "internal";
  created_at: string;
  updated_at: string | null;
  author_name: string;
};

export type WorkOrder = {
  id: string;
  work_order_number: string;
  maintenance_request_id: string;
  building_id: string;
  assigned_manager_id: string | null;
  vendor_name: string | null;
  vendor_phone: string | null;
  technician_name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  status: WorkOrderStatus;
  work_description: string;
  completion_note: string | null;
  completed_by: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  manager_name: string | null;
  expense_id: string | null;
  expense_status: string | null;
};

/** Tenant-safe schedule projection — never includes vendor contact details. */
export type TenantScheduleRow = {
  work_order_number: string;
  status: WorkOrderStatus;
  scheduled_date: string | null;
  scheduled_time: string | null;
  technician_name: string | null;
  work_description: string;
  completed_at: string | null;
};

const REQUEST_SELECT =
  "*, buildings(name), flats(flat_number), tenant:profiles!maintenance_requests_tenant_id_fkey(full_name), submitter:profiles!maintenance_requests_submitted_by_fkey(full_name), assignee:profiles!maintenance_requests_assigned_to_fkey(full_name)";

type RawRequest = Record<string, unknown> & {
  buildings?: { name: string } | null;
  flats?: { flat_number: string } | null;
  tenant?: { full_name: string } | null;
  submitter?: { full_name: string } | null;
  assignee?: { full_name: string } | null;
};

function normalizeRequest(row: RawRequest): MaintenanceRow {
  return {
    ...(row as unknown as MaintenanceRequest),
    building_name: row.buildings?.name ?? "—",
    flat_number: row.flats?.flat_number ?? null,
    tenant_name: row.tenant?.full_name ?? null,
    submitter_name: row.submitter?.full_name ?? "—",
    assignee_name: row.assignee?.full_name ?? null,
  };
}

export type MaintenanceFilters = {
  buildingId: string; // "all"
  flatId: string; // "all"
  status: MaintenanceStatus | "all" | "open";
  priority: MaintenancePriority | "all";
  category: MaintenanceCategory | "all";
  assignedTo: string; // "all" | "unassigned" | uuid
  dateFrom: string;
  dateTo: string;
  search: string;
};

export const emptyMaintenanceFilters: MaintenanceFilters = {
  buildingId: "all",
  flatId: "all",
  status: "open",
  priority: "all",
  category: "all",
  assignedTo: "all",
  dateFrom: "",
  dateTo: "",
  search: "",
};

/** Emergency first, then newest. Used for both the queue and dashboards. */
export function sortQueue(rows: MaintenanceRow[]) {
  return [...rows].sort((a, b) => {
    const p = priorityRank[a.priority] - priorityRank[b.priority];
    if (p !== 0) return p;
    return b.created_at.localeCompare(a.created_at);
  });
}

export const maintenanceRequestsQueryOptions = (filters: MaintenanceFilters) =>
  queryOptions({
    queryKey: ["maintenance-requests", filters],
    queryFn: async (): Promise<MaintenanceRow[]> => {
      let query = supabase
        .from("maintenance_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false });

      if (filters.buildingId !== "all") query = query.eq("building_id", filters.buildingId);
      if (filters.flatId !== "all") query = query.eq("flat_id", filters.flatId);
      if (filters.status === "open") query = query.in("status", openStatuses);
      else if (filters.status !== "all") query = query.eq("status", filters.status);
      if (filters.priority !== "all") query = query.eq("priority", filters.priority);
      if (filters.category !== "all") query = query.eq("category", filters.category);
      if (filters.assignedTo === "unassigned") query = query.is("assigned_to", null);
      else if (filters.assignedTo !== "all") query = query.eq("assigned_to", filters.assignedTo);
      if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);

      const term = filters.search.trim();
      if (term) {
        const escaped = term.replace(/[%,()]/g, " ");
        query = query.or(
          `title.ilike.%${escaped}%,description.ilike.%${escaped}%,request_number.ilike.%${escaped}%`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return sortQueue((data ?? []).map((row) => normalizeRequest(row as RawRequest)));
    },
  });

export const myMaintenanceRequestsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-maintenance-requests", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MaintenanceRow[]> => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(REQUEST_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeRequest(row as RawRequest));
    },
  });

export const maintenanceRequestQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: ["maintenance-request", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async (): Promise<MaintenanceRow | null> => {
      const { data, error } = await supabase
        .from("maintenance_requests")
        .select(REQUEST_SELECT)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeRequest(data as RawRequest) : null;
    },
  });

export const maintenanceTimelineQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: ["maintenance-timeline", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async (): Promise<MaintenanceStatusEvent[]> => {
      const { data, error } = await supabase
        .from("maintenance_status_events")
        .select("*, performer:profiles!maintenance_status_events_performed_by_fkey(full_name)")
        .eq("maintenance_request_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as unknown as MaintenanceStatusEvent),
        performer_name:
          (row as { performer?: { full_name: string } | null }).performer?.full_name ?? "—",
      }));
    },
  });

export const maintenanceAttachmentsQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: ["maintenance-attachments", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async (): Promise<MaintenanceAttachment[]> => {
      const { data, error } = await supabase
        .from("maintenance_attachments")
        .select("*")
        .eq("maintenance_request_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceAttachment[];
    },
  });

export const maintenanceCommentsQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: ["maintenance-comments", id ?? "none"],
    enabled: Boolean(id),
    queryFn: async (): Promise<MaintenanceComment[]> => {
      const { data, error } = await supabase
        .from("maintenance_comments")
        .select("*, author:profiles!maintenance_comments_author_id_fkey(full_name)")
        .eq("maintenance_request_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as unknown as MaintenanceComment),
        author_name: (row as { author?: { full_name: string } | null }).author?.full_name ?? "—",
      }));
    },
  });

export const workOrdersQueryOptions = (requestId: string | null) =>
  queryOptions({
    queryKey: ["work-orders", requestId ?? "none"],
    enabled: Boolean(requestId),
    queryFn: async (): Promise<WorkOrder[]> => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(
          "*, manager:profiles!work_orders_assigned_manager_id_fkey(full_name), building_expenses(id, approval_status)",
        )
        .eq("maintenance_request_id", requestId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const raw = row as Record<string, unknown> & {
          manager?: { full_name: string } | null;
          building_expenses?: Array<{ id: string; approval_status: string }> | null;
        };
        const linked = (raw.building_expenses ?? []).filter(
          (item) => item.approval_status !== "cancelled",
        )[0];
        return {
          ...(row as unknown as WorkOrder),
          estimated_cost: raw["estimated_cost"] == null ? null : Number(raw["estimated_cost"]),
          actual_cost: raw["actual_cost"] == null ? null : Number(raw["actual_cost"]),
          manager_name: raw.manager?.full_name ?? null,
          expense_id: linked?.id ?? null,
          expense_status: linked?.approval_status ?? null,
        };
      });
    },
  });

export const tenantScheduleQueryOptions = (requestId: string | null) =>
  queryOptions({
    queryKey: ["maintenance-tenant-schedule", requestId ?? "none"],
    enabled: Boolean(requestId),
    queryFn: async (): Promise<TenantScheduleRow[]> => {
      const { data, error } = await supabase.rpc("maintenance_tenant_schedule", {
        _request_id: requestId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as TenantScheduleRow[];
    },
  });

/** Owner/manager people who can be assigned work inside a building. */
export const assignableUsersQueryOptions = (buildingIds: string[]) =>
  queryOptions({
    queryKey: ["maintenance-assignable", [...buildingIds].sort().join(",")],
    queryFn: async (): Promise<Array<{ id: string; full_name: string; role: string }>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["owner", "manager"])
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; full_name: string; role: string }>;
    },
  });

// ============ mutations ============

export type CreateRequestInput = {
  buildingId: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  priority: MaintenancePriority;
  isCommonArea: boolean;
  flatId: string | null;
  preferredVisitDate: string;
  accessInstructions: string;
};

export function validateRequestInput(input: CreateRequestInput): string | null {
  if (!input.buildingId) return "Select the building this issue belongs to.";
  if (input.title.trim().length < 3) return "Give the issue a short title (at least 3 characters).";
  if (input.title.trim().length > 160) return "Keep the title under 160 characters.";
  if (input.description.trim().length < 5) return "Describe the problem so it can be fixed.";
  if (input.description.trim().length > 4000) return "Keep the description under 4000 characters.";
  if (!input.isCommonArea && !input.flatId) return "Choose the flat this issue belongs to.";
  if (input.accessInstructions.length > 1000) return "Access instructions are too long.";
  return null;
}

export function describeMaintenanceError(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to perform this maintenance action.";
  }
  if (message.includes("append-only")) {
    return "Maintenance history cannot be edited or deleted.";
  }
  return message;
}

export async function createMaintenanceRequest(input: CreateRequestInput) {
  const invalid = validateRequestInput(input);
  if (invalid) throw new Error(invalid);

  const args: Record<string, unknown> = {
    _building_id: input.buildingId,
    _category: input.category,
    _title: input.title.trim(),
    _description: input.description.trim(),
    _priority: input.priority,
    _is_common_area: input.isCommonArea,
  };
  if (!input.isCommonArea && input.flatId) args["_flat_id"] = input.flatId;
  if (input.preferredVisitDate) args["_preferred_visit_date"] = input.preferredVisitDate;
  if (input.accessInstructions.trim()) args["_access_instructions"] = input.accessInstructions.trim();

  const { data, error } = await supabase.rpc("create_maintenance_request", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
  return data as unknown as MaintenanceRequest;
}

export async function changeMaintenanceStatus(
  requestId: string,
  status: MaintenanceStatus,
  note?: string,
) {
  const args: Record<string, unknown> = { _request_id: requestId, _new_status: status };
  if (note?.trim()) args["_note"] = note.trim();
  const { error } = await supabase.rpc("maintenance_change_status", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function assignMaintenanceRequest(
  requestId: string,
  assignedTo: string | null,
  priority?: MaintenancePriority,
) {
  const args: Record<string, unknown> = { _request_id: requestId, _assigned_to: assignedTo };
  if (priority) args["_priority"] = priority;
  const { error } = await supabase.rpc("maintenance_assign", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function setMaintenancePriority(requestId: string, priority: MaintenancePriority) {
  const { error } = await supabase.rpc("maintenance_set_priority", {
    _request_id: requestId,
    _priority: priority,
  });
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export type WorkOrderInput = {
  workDescription: string;
  assignedManagerId: string | null;
  vendorName: string;
  vendorPhone: string;
  technicianName: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedCost: string;
};

export async function createWorkOrder(requestId: string, input: WorkOrderInput) {
  if (input.workDescription.trim().length < 3) {
    throw new Error("Describe the work that needs to be done.");
  }
  const estimated = input.estimatedCost.trim() ? Number(input.estimatedCost) : null;
  if (estimated != null && (!Number.isFinite(estimated) || estimated < 0)) {
    throw new Error("Estimated cost cannot be negative.");
  }

  const args: Record<string, unknown> = {
    _maintenance_request_id: requestId,
    _work_description: input.workDescription.trim(),
  };
  if (input.assignedManagerId) args["_assigned_manager_id"] = input.assignedManagerId;
  if (input.vendorName.trim()) args["_vendor_name"] = input.vendorName.trim();
  if (input.vendorPhone.trim()) args["_vendor_phone"] = input.vendorPhone.trim();
  if (input.technicianName.trim()) args["_technician_name"] = input.technicianName.trim();
  if (input.scheduledDate) args["_scheduled_date"] = input.scheduledDate;
  if (input.scheduledTime.trim()) args["_scheduled_time"] = input.scheduledTime.trim();
  if (estimated != null) args["_estimated_cost"] = estimated;

  const { error } = await supabase.rpc("work_order_create", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function updateWorkOrderStatus(
  workOrderId: string,
  status: WorkOrderStatus,
  note?: string,
  actualCost?: number | null,
) {
  const args: Record<string, unknown> = { _work_order_id: workOrderId, _new_status: status };
  if (note?.trim()) args["_note"] = note.trim();
  if (actualCost != null) args["_actual_cost"] = actualCost;
  const { error } = await supabase.rpc("work_order_update_status", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function createExpenseDraftFromWorkOrder(params: {
  workOrderId: string;
  category: string;
  amount: number;
  description: string;
  expenseDate: string;
  accountingMonth: string; // yyyy-MM
  paymentMethod: string;
  vendorName: string;
  transactionReference: string;
}) {
  const args: Record<string, unknown> = {
    _work_order_id: params.workOrderId,
    _category: params.category,
    _amount: params.amount,
    _description: params.description.trim(),
    _expense_date: params.expenseDate,
    _accounting_month: `${params.accountingMonth}-01`,
    _payment_method: params.paymentMethod,
  };
  if (params.vendorName.trim()) args["_vendor_name"] = params.vendorName.trim();
  if (params.transactionReference.trim()) {
    args["_transaction_reference"] = params.transactionReference.trim();
  }

  const { error } = await supabase.rpc("create_expense_draft_from_work_order", args as never);
  if (error) {
    if (error.message.includes("month_closed")) {
      throw new Error(
        "That accounting month is closed. Post this expense draft into the next open month.",
      );
    }
    throw new Error(describeMaintenanceError(error.message));
  }
}

// ============ attachments ============

const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
];

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function validateAttachment(file: File): string | null {
  if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
    return "Attachments must be JPG, JPEG, PNG, WEBP, MP4, MOV, WEBM or PDF.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return "Attachments must be 25 MB or smaller.";
  if (file.size === 0) return "That file appears to be empty.";
  return null;
}

function attachmentTypeFor(file: File): AttachmentType {
  if (file.type.startsWith("image/")) return "issue_photo";
  if (file.type.startsWith("video/")) return "issue_video";
  return "document";
}

export async function uploadMaintenanceAttachments(
  requestId: string,
  files: File[],
  options?: { attachmentType?: AttachmentType },
) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in.");

  for (const file of files) {
    const invalid = validateAttachment(file);
    if (invalid) throw new Error(invalid);

    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${requestId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(MAINTENANCE_BUCKET)
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);

    const { error } = await supabase.from("maintenance_attachments").insert({
      maintenance_request_id: requestId,
      uploaded_by: userId,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      file_type: file.type,
      file_size: file.size,
      attachment_type: options?.attachmentType ?? attachmentTypeFor(file),
    });
    if (error) {
      await supabase.storage.from(MAINTENANCE_BUCKET).remove([path]);
      throw new Error(describeMaintenanceError(error.message));
    }
  }
}

export async function createAttachmentSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(MAINTENANCE_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the attachment: ${error.message}`);
  return data.signedUrl;
}

// ============ comments ============

export async function addMaintenanceComment(
  requestId: string,
  text: string,
  visibility: "shared" | "internal",
) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Write something before posting.");
  if (trimmed.length > 2000) throw new Error("Keep comments under 2000 characters.");

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("You must be signed in.");

  const { error } = await supabase.from("maintenance_comments").insert({
    maintenance_request_id: requestId,
    author_id: userId,
    comment_text: trimmed,
    visibility,
  });
  if (error) throw new Error(describeMaintenanceError(error.message));
}

// ============ derived helpers ============

export function ageInDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function durationLabel(fromIso: string, toIso: string | null) {
  if (!toIso) return "—";
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (ms < 0) return "—";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type MaintenanceSummary = {
  open: number;
  emergency: number;
  unassigned: number;
  waitingForParts: number;
  needsAcknowledgement: number;
  recentlyResolved: number;
  byBuilding: Array<{ building: string; open: number; emergency: number }>;
};

export function summarizeMaintenance(rows: MaintenanceRow[]): MaintenanceSummary {
  const open = rows.filter((row) => isOpenStatus(row.status));
  const byBuilding = new Map<string, { open: number; emergency: number }>();
  for (const row of open) {
    const entry = byBuilding.get(row.building_name) ?? { open: 0, emergency: 0 };
    entry.open += 1;
    if (row.priority === "emergency") entry.emergency += 1;
    byBuilding.set(row.building_name, entry);
  }
  const weekAgo = Date.now() - 7 * 86_400_000;

  return {
    open: open.length,
    emergency: open.filter((row) => row.priority === "emergency").length,
    unassigned: open.filter((row) => !row.assigned_to).length,
    waitingForParts: rows.filter((row) => row.status === "waiting_for_parts").length,
    needsAcknowledgement: rows.filter((row) => row.status === "submitted").length,
    recentlyResolved: rows.filter(
      (row) =>
        (row.status === "resolved" || row.status === "closed") &&
        row.resolved_at != null &&
        new Date(row.resolved_at).getTime() > weekAgo,
    ).length,
    byBuilding: [...byBuilding.entries()]
      .map(([building, value]) => ({ building, ...value }))
      .sort((a, b) => b.open - a.open),
  };
}
