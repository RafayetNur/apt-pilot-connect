import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const DOCUMENT_BUCKET = "building-documents";

// ============ notices ============

export type NoticePriority = "normal" | "important" | "urgent" | "emergency";

export const noticePriorityLabel: Record<NoticePriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  emergency: "Emergency",
};

export const noticePriorityOptions = Object.keys(noticePriorityLabel) as NoticePriority[];

export const noticePriorityRank: Record<NoticePriority, number> = {
  emergency: 0,
  urgent: 1,
  important: 2,
  normal: 3,
};

export type NoticeStatus = "draft" | "published" | "archived" | "cancelled";

export const noticeStatusLabel: Record<NoticeStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const noticeStatusOptions = Object.keys(noticeStatusLabel) as NoticeStatus[];

export type NoticeAudience =
  "all_tenants" | "selected_flats" | "selected_tenants" | "owner_manager_only";

export const noticeAudienceLabel: Record<NoticeAudience, string> = {
  all_tenants: "All tenants in the building",
  selected_flats: "Selected flats",
  selected_tenants: "Selected tenants",
  owner_manager_only: "Owner and managers only",
};

export const noticeAudienceOptions = Object.keys(noticeAudienceLabel) as NoticeAudience[];

export type NoticeAction =
  "created" | "edited" | "published" | "acknowledged" | "archived" | "cancelled";

export type Notice = {
  id: string;
  notice_number: string;
  building_id: string;
  building_name: string;
  title: string;
  content: string;
  priority: NoticePriority;
  status: NoticeStatus;
  audience_type: NoticeAudience;
  published_at: string | null;
  published_by: string | null;
  effective_from: string | null;
  expires_at: string | null;
  requires_acknowledgement: boolean;
  replaces_notice_id: string | null;
  replaced_by_notice_id: string | null;
  created_by: string;
  cancellation_reason: string | null;
  archived_at: string | null;
  created_at: string;
};

export type NoticeRecipient = {
  id: string;
  notice_id: string;
  flat_id: string | null;
  tenant_id: string | null;
};

export type NoticeAcknowledgement = {
  id: string;
  notice_id: string;
  tenant_id: string;
  acknowledged_at: string;
};

export type NoticeEvent = {
  id: string;
  notice_id: string;
  action: NoticeAction;
  performed_by: string;
  note: string | null;
  created_at: string;
};

const NOTICE_COLUMNS =
  "id, notice_number, building_id, title, content, priority, status, audience_type, published_at, published_by, effective_from, expires_at, requires_acknowledgement, replaces_notice_id, replaced_by_notice_id, created_by, cancellation_reason, archived_at, created_at, buildings(name)";

function mapNotice(raw: unknown): Notice {
  const row = raw as Record<string, unknown> & { buildings?: { name: string } | null };
  return {
    id: row["id"] as string,
    notice_number: row["notice_number"] as string,
    building_id: row["building_id"] as string,
    building_name: row.buildings?.name ?? "—",
    title: row["title"] as string,
    content: row["content"] as string,
    priority: row["priority"] as NoticePriority,
    status: row["status"] as NoticeStatus,
    audience_type: row["audience_type"] as NoticeAudience,
    published_at: (row["published_at"] as string | null) ?? null,
    published_by: (row["published_by"] as string | null) ?? null,
    effective_from: (row["effective_from"] as string | null) ?? null,
    expires_at: (row["expires_at"] as string | null) ?? null,
    requires_acknowledgement: Boolean(row["requires_acknowledgement"]),
    replaces_notice_id: (row["replaces_notice_id"] as string | null) ?? null,
    replaced_by_notice_id: (row["replaced_by_notice_id"] as string | null) ?? null,
    created_by: row["created_by"] as string,
    cancellation_reason: (row["cancellation_reason"] as string | null) ?? null,
    archived_at: (row["archived_at"] as string | null) ?? null,
    created_at: row["created_at"] as string,
  };
}

export function isExpired(notice: Notice, now = new Date()) {
  return notice.expires_at != null && new Date(notice.expires_at) < now;
}

/** Notices the signed-in user may read. RLS decides the rows: staff see their
 *  buildings' notices, tenants only published ones addressed to them. */
export const noticesQueryOptions = () =>
  queryOptions({
    queryKey: ["notices"],
    queryFn: async (): Promise<Notice[]> => {
      const { data, error } = await supabase
        .from("building_notices")
        .select(NOTICE_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapNotice);
    },
  });

export const noticeRecipientsQueryOptions = () =>
  queryOptions({
    queryKey: ["notice-recipients"],
    queryFn: async (): Promise<NoticeRecipient[]> => {
      const { data, error } = await supabase
        .from("notice_recipients")
        .select("id, notice_id, flat_id, tenant_id");
      if (error) throw error;
      return (data ?? []) as NoticeRecipient[];
    },
  });

export const noticeAcknowledgementsQueryOptions = () =>
  queryOptions({
    queryKey: ["notice-acknowledgements"],
    queryFn: async (): Promise<NoticeAcknowledgement[]> => {
      const { data, error } = await supabase
        .from("notice_acknowledgements")
        .select("id, notice_id, tenant_id, acknowledged_at");
      if (error) throw error;
      return (data ?? []) as NoticeAcknowledgement[];
    },
  });

export const noticeEventsQueryOptions = (noticeId: string | null) =>
  queryOptions({
    queryKey: ["notice-events", noticeId ?? "none"],
    enabled: Boolean(noticeId),
    queryFn: async (): Promise<NoticeEvent[]> => {
      const { data, error } = await supabase
        .from("notice_events")
        .select("id, notice_id, action, performed_by, note, created_at")
        .eq("notice_id", noticeId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NoticeEvent[];
    },
  });

export type NoticeInput = {
  buildingId: string;
  title: string;
  content: string;
  priority: NoticePriority;
  audienceType: NoticeAudience;
  requiresAcknowledgement: boolean;
  effectiveFrom: string | null;
  expiresAt: string | null;
  flatIds: string[];
  tenantIds: string[];
};

function noticeArgs(input: NoticeInput) {
  return {
    _title: input.title,
    _content: input.content,
    _priority: input.priority,
    _audience_type: input.audienceType,
    _requires_acknowledgement: input.requiresAcknowledgement,
    ...(input.effectiveFrom ? { _effective_from: input.effectiveFrom } : {}),
    ...(input.expiresAt ? { _expires_at: input.expiresAt } : {}),
    ...(input.audienceType === "selected_flats" ? { _flat_ids: input.flatIds } : {}),
    ...(input.audienceType === "selected_tenants" ? { _tenant_ids: input.tenantIds } : {}),
  };
}

export async function createNoticeDraft(input: NoticeInput) {
  const { data, error } = await supabase.rpc("notice_create", {
    _building_id: input.buildingId,
    ...noticeArgs(input),
  });
  if (error) throw new Error(describeCommunicationError(error.message));
  return mapNotice(data);
}

export async function updateNoticeDraft(noticeId: string, input: NoticeInput) {
  const { data, error } = await supabase.rpc("notice_update_draft", {
    _notice_id: noticeId,
    ...noticeArgs(input),
  });
  if (error) throw new Error(describeCommunicationError(error.message));
  return mapNotice(data);
}

export async function publishNotice(noticeId: string, confirmed: boolean) {
  const { error } = await supabase.rpc("notice_publish", {
    _notice_id: noticeId,
    _confirmed: confirmed,
  });
  if (error) throw new Error(describeCommunicationError(error.message));
}

export async function publishNoticeRevision(
  noticeId: string,
  input: NoticeInput,
  reason: string,
  confirmed: boolean,
) {
  const { error } = await supabase.rpc("notice_publish_revision", {
    _notice_id: noticeId,
    _reason: reason,
    _confirmed: confirmed,
    ...noticeArgs(input),
  });
  if (error) throw new Error(describeCommunicationError(error.message));
}

export async function cancelNotice(noticeId: string, reason: string) {
  const { error } = await supabase.rpc("notice_cancel", {
    _notice_id: noticeId,
    _reason: reason,
  });
  if (error) throw new Error(describeCommunicationError(error.message));
}

export async function archiveNotice(noticeId: string, note: string | null) {
  const { error } = await supabase.rpc("notice_archive", {
    _notice_id: noticeId,
    ...(note ? { _note: note } : {}),
  });
  if (error) throw new Error(describeCommunicationError(error.message));
}

export async function acknowledgeNotice(noticeId: string) {
  const { error } = await supabase.rpc("notice_acknowledge", { _notice_id: noticeId });
  if (error) throw new Error(describeCommunicationError(error.message));
}

// ============ documents ============

export type DocumentCategory =
  | "building_rule"
  | "tenant_guideline"
  | "emergency_contact"
  | "rent_policy"
  | "maintenance_policy"
  | "meeting_minutes"
  | "utility_document"
  | "legal_document"
  | "receipt_or_invoice"
  | "other";

export const documentCategoryLabel: Record<DocumentCategory, string> = {
  building_rule: "Building rule",
  tenant_guideline: "Tenant guideline",
  emergency_contact: "Emergency contact",
  rent_policy: "Rent policy",
  maintenance_policy: "Maintenance policy",
  meeting_minutes: "Meeting minutes",
  utility_document: "Utility document",
  legal_document: "Legal document",
  receipt_or_invoice: "Receipt or invoice",
  other: "Other",
};

export const documentCategoryOptions = Object.keys(documentCategoryLabel) as DocumentCategory[];

export type DocumentVisibility =
  "owner_only" | "owner_manager" | "all_building_tenants" | "selected_flats" | "selected_tenants";

export const documentVisibilityLabel: Record<DocumentVisibility, string> = {
  owner_only: "Owner only",
  owner_manager: "Owner and managers",
  all_building_tenants: "All tenants in the building",
  selected_flats: "Selected flats",
  selected_tenants: "Selected tenants",
};

export const documentVisibilityOptions = Object.keys(
  documentVisibilityLabel,
) as DocumentVisibility[];

export type BuildingDocument = {
  id: string;
  building_id: string;
  building_name: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  visibility: DocumentVisibility;
  version_number: number;
  replaces_document_id: string | null;
  replaced_by_document_id: string | null;
  uploaded_by: string;
  is_active: boolean;
  archived_at: string | null;
  archive_reason: string | null;
  created_at: string;
};

export const documentsQueryOptions = () =>
  queryOptions({
    queryKey: ["building-documents"],
    queryFn: async (): Promise<BuildingDocument[]> => {
      const { data, error } = await supabase
        .from("building_documents")
        .select(
          "id, building_id, title, description, category, storage_path, file_name, file_type, file_size, visibility, version_number, replaces_document_id, replaced_by_document_id, uploaded_by, is_active, archived_at, archive_reason, created_at, buildings(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & { buildings?: { name: string } | null };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          title: row["title"] as string,
          description: (row["description"] as string | null) ?? null,
          category: row["category"] as DocumentCategory,
          storage_path: row["storage_path"] as string,
          file_name: row["file_name"] as string,
          file_type: row["file_type"] as string,
          file_size: Number(row["file_size"] ?? 0),
          visibility: row["visibility"] as DocumentVisibility,
          version_number: Number(row["version_number"] ?? 1),
          replaces_document_id: (row["replaces_document_id"] as string | null) ?? null,
          replaced_by_document_id: (row["replaced_by_document_id"] as string | null) ?? null,
          uploaded_by: row["uploaded_by"] as string,
          is_active: Boolean(row["is_active"]),
          archived_at: (row["archived_at"] as string | null) ?? null,
          archive_reason: (row["archive_reason"] as string | null) ?? null,
          created_at: row["created_at"] as string,
        };
      });
    },
  });

export const documentRecipientsQueryOptions = () =>
  queryOptions({
    queryKey: ["document-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_recipients")
        .select("id, document_id, flat_id, tenant_id");
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        document_id: string;
        flat_id: string | null;
        tenant_id: string | null;
      }>;
    },
  });

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type.toLowerCase())) {
    return "Only PDF, JPG, PNG or DOCX files can be uploaded.";
  }
  if (file.size <= 0) return "That file appears to be empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Files must be 20 MB or smaller.";
  return null;
}

export type DocumentInput = {
  buildingId: string;
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: DocumentVisibility;
  flatIds: string[];
  tenantIds: string[];
  replacesDocumentId: string | null;
};

/** Uploads the file to the private bucket, then records it through the guarded RPC. */
export async function createDocument(input: DocumentInput, file: File) {
  const invalid = validateDocumentFile(file);
  if (invalid) throw new Error(invalid);

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${input.buildingId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (uploadError) throw new Error(`Could not upload the file: ${uploadError.message}`);

  const { error } = await supabase.rpc("document_create", {
    _building_id: input.buildingId,
    _title: input.title,
    _category: input.category,
    _storage_path: path,
    _file_name: file.name.slice(0, 200),
    _file_type: file.type.toLowerCase(),
    _file_size: file.size,
    _visibility: input.visibility,
    ...(input.description ? { _description: input.description } : {}),
    ...(input.visibility === "selected_flats" ? { _flat_ids: input.flatIds } : {}),
    ...(input.visibility === "selected_tenants" ? { _tenant_ids: input.tenantIds } : {}),
    ...(input.replacesDocumentId ? { _replaces_document_id: input.replacesDocumentId } : {}),
  });
  if (error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    throw new Error(describeCommunicationError(error.message));
  }
}

export async function archiveDocument(documentId: string, reason: string) {
  const { error } = await supabase.rpc("document_archive", {
    _document_id: documentId,
    _reason: reason,
  });
  if (error) throw new Error(describeCommunicationError(error.message));
}

export async function createDocumentSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the document: ${error.message}`);
  return data.signedUrl;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============ in-app notifications ============

export type NotificationType =
  | "notice_published"
  | "notice_updated"
  | "document_shared"
  | "maintenance_update"
  | "payment_update"
  | "general";

export type InAppNotification = {
  id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  is_read: boolean;
  created_at: string;
};

export const notificationsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["in-app-notifications", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<InAppNotification[]> => {
      const { data, error } = await supabase
        .from("in_app_notifications")
        .select(
          "id, notification_type, title, message, related_entity_type, related_entity_id, is_read, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as InAppNotification[];
    },
  });

export async function markNotificationsRead(ids: string[] | null) {
  const { error } = await supabase.rpc(
    "notifications_mark_read",
    ids && ids.length > 0 ? { _ids: ids } : {},
  );
  if (error) throw new Error(describeCommunicationError(error.message));
}

// ============ shared helpers ============

export function describeCommunicationError(message: string) {
  if (message.includes("duplicate key") && message.includes("notice_number")) {
    return "That notice number is already in use. Try again.";
  }
  if (message.includes("append-only")) {
    return "Notice history and acknowledgements cannot be edited or deleted.";
  }
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to do this for this building.";
  }
  return message;
}

export function summarizeNotices(
  notices: Notice[],
  acks: NoticeAcknowledgement[],
  recipients: NoticeRecipient[],
  occupiedTenantsByBuilding: Record<string, number>,
) {
  const now = new Date();
  const published = notices.filter((n) => n.status === "published");
  const active = published.filter((n) => !isExpired(n, now));

  const expectedFor = (notice: Notice) => {
    if (notice.audience_type === "owner_manager_only") return 0;
    if (notice.audience_type === "all_tenants") {
      return occupiedTenantsByBuilding[notice.building_id] ?? 0;
    }
    return recipients.filter((r) => r.notice_id === notice.id).length;
  };

  const awaiting = active.filter((notice) => {
    if (!notice.requires_acknowledgement) return false;
    const done = acks.filter((a) => a.notice_id === notice.id).length;
    return done < expectedFor(notice);
  });

  return {
    active,
    drafts: notices.filter((n) => n.status === "draft"),
    urgent: active.filter((n) => n.priority === "urgent" || n.priority === "emergency"),
    emergency: active.filter((n) => n.priority === "emergency"),
    expired: published.filter((n) => isExpired(n, now)),
    previous: notices.filter(
      (n) => n.status === "archived" || n.status === "cancelled" || isExpired(n, now),
    ),
    awaitingAcknowledgement: awaiting,
    expectedFor,
    ackCountFor: (notice: Notice) => acks.filter((a) => a.notice_id === notice.id).length,
  };
}

export function sortNoticesForTenant(notices: Notice[]) {
  return [...notices].sort((a, b) => {
    const rank = noticePriorityRank[a.priority] - noticePriorityRank[b.priority];
    if (rank !== 0) return rank;
    return (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at);
  });
}

/** Number of occupied flats with a tenant per building — the expected audience
 *  size for an "all tenants" notice. RLS scopes rows to what the user may see. */
export const occupiedTenantCountsQueryOptions = () =>
  queryOptions({
    queryKey: ["occupied-tenant-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("flats")
        .select("building_id, tenant_id, occupancy_status");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const raw of data ?? []) {
        const row = raw as {
          building_id: string;
          tenant_id: string | null;
          occupancy_status: string;
        };
        if (row.occupancy_status !== "occupied" || !row.tenant_id) continue;
        counts[row.building_id] = (counts[row.building_id] ?? 0) + 1;
      }
      return counts;
    },
  });
