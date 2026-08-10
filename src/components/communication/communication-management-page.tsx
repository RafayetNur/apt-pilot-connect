import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DocumentFormDialog } from "@/components/communication/document-form-dialog";
import {
  NoticeFormDialog,
  type NoticeDialogMode,
} from "@/components/communication/notice-form-dialog";
import {
  CategoryBadge,
  NoticeHistory,
  NoticePriorityBadge,
  NoticeStatusBadge,
  VisibilityBadge,
} from "@/components/communication/parts";
import { DashboardSection, EmptyState } from "@/components/dashboard/parts";
import { ManagerShell } from "@/components/manager-shell";
import { OwnerShell } from "@/components/owner-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/hooks/useAuth";
import { buildingsQueryOptions } from "@/lib/buildings";
import {
  archiveDocument,
  archiveNotice,
  cancelNotice,
  createDocumentSignedUrl,
  documentRecipientsQueryOptions,
  documentsQueryOptions,
  formatFileSize,
  isExpired,
  noticeAcknowledgementsQueryOptions,
  noticeAudienceLabel,
  noticeEventsQueryOptions,
  noticeRecipientsQueryOptions,
  noticeStatusOptions,
  noticesQueryOptions,
  occupiedTenantCountsQueryOptions,
  publishNotice,
  summarizeNotices,
  type BuildingDocument,
  type Notice,
} from "@/lib/communication";
import { formatDateTime } from "@/lib/maintenance";

export function CommunicationManagementPage({ role }: { role: Exclude<AppRole, "tenant"> }) {
  const Shell = role === "owner" ? OwnerShell : ManagerShell;
  const queryClient = useQueryClient();

  const buildingsQuery = useQuery(buildingsQueryOptions());
  const noticesQuery = useQuery(noticesQueryOptions());
  const recipientsQuery = useQuery(noticeRecipientsQueryOptions());
  const acksQuery = useQuery(noticeAcknowledgementsQueryOptions());
  const documentsQuery = useQuery(documentsQueryOptions());
  const docRecipientsQuery = useQuery(documentRecipientsQueryOptions());
  const countsQuery = useQuery(occupiedTenantCountsQueryOptions());

  const buildings = (buildingsQuery.data ?? []).map((b) => ({ id: b.id, name: b.name }));
  const notices = noticesQuery.data ?? [];
  const documents = documentsQuery.data ?? [];

  const [tab, setTab] = useState<"notices" | "documents">("notices");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [noticeDialog, setNoticeDialog] = useState<{
    open: boolean;
    mode: NoticeDialogMode;
    notice: Notice | null;
  }>({ open: false, mode: "create", notice: null });
  const [docDialog, setDocDialog] = useState<{ open: boolean; replaces: BuildingDocument | null }>({
    open: false,
    replaces: null,
  });

  const summary = useMemo(
    () =>
      summarizeNotices(
        notices,
        acksQuery.data ?? [],
        recipientsQuery.data ?? [],
        countsQuery.data ?? {},
      ),
    [notices, acksQuery.data, recipientsQuery.data, countsQuery.data],
  );

  const eventsQuery = useQuery(noticeEventsQueryOptions(expandedId));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notices"] });
    void queryClient.invalidateQueries({ queryKey: ["building-documents"] });
    void queryClient.invalidateQueries({ queryKey: ["notice-events"] });
  };

  const action = useMutation({
    mutationFn: async (job: () => Promise<void>) => job(),
    onSuccess: () => {
      invalidate();
      toast.success("Updated.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not complete that action."),
  });

  const filteredNotices = notices.filter((notice) => {
    if (buildingFilter !== "all" && notice.building_id !== buildingFilter) return false;
    if (statusFilter !== "all" && notice.status !== statusFilter) return false;
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      if (
        !notice.title.toLowerCase().includes(needle) &&
        !notice.notice_number.toLowerCase().includes(needle)
      ) {
        return false;
      }
    }
    return true;
  });

  const filteredDocuments = documents.filter(
    (doc) => buildingFilter === "all" || doc.building_id === buildingFilter,
  );

  const docTargets = docRecipientsQuery.data ?? [];

  async function openDocument(doc: BuildingDocument) {
    try {
      const url = await createDocumentSignedUrl(doc.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the document.");
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Notices & documents</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Publish building notices, share authorised documents and see exactly who has read what.
            Everything stays inside AptPilot — no SMS or email is sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setDocDialog({ open: true, replaces: null })}
            disabled={buildings.length === 0}
          >
            Share document
          </Button>
          <Button
            onClick={() => setNoticeDialog({ open: true, mode: "create", notice: null })}
            disabled={buildings.length === 0}
          >
            New notice
          </Button>
        </div>
      </div>

      <div className="panel mt-6 grid gap-3 p-4 sm:grid-cols-4">
        <Stat label="Active notices" value={summary.active.length} />
        <Stat label="Urgent or emergency" value={summary.urgent.length} />
        <Stat label="Awaiting acknowledgement" value={summary.awaitingAcknowledgement.length} />
        <Stat label="Drafts" value={summary.drafts.length} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant={tab === "notices" ? "default" : "outline"} onClick={() => setTab("notices")}>
          Notices
        </Button>
        <Button
          variant={tab === "documents" ? "default" : "outline"}
          onClick={() => setTab("documents")}
        >
          Documents
        </Button>
        <Select value={buildingFilter} onValueChange={setBuildingFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buildings</SelectItem>
            {buildings.map((building) => (
              <SelectItem key={building.id} value={building.id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tab === "notices" ? (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {noticeStatusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or number"
              className="w-56"
            />
          </>
        ) : null}
      </div>

      {tab === "notices" ? (
        <DashboardSection
          title="Notices"
          description="Published notices can be revised, cancelled or archived — never edited silently."
        >
          {noticesQuery.isLoading ? (
            <EmptyState>Loading notices…</EmptyState>
          ) : filteredNotices.length === 0 ? (
            <EmptyState>No notices match these filters yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {filteredNotices.map((notice) => {
                const expected = summary.expectedFor(notice);
                const acked = summary.ackCountFor(notice);
                const expanded = expandedId === notice.id;
                return (
                  <li
                    key={notice.id}
                    className="rounded-2xl border border-border/60 bg-card p-4 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <NoticePriorityBadge priority={notice.priority} />
                          <NoticeStatusBadge status={notice.status} />
                          {isExpired(notice) && notice.status === "published" ? (
                            <span className="text-xs text-muted-foreground">Expired</span>
                          ) : null}
                        </div>
                        <p className="mt-2 font-display text-base font-semibold">{notice.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {notice.notice_number} · {notice.building_name} ·{" "}
                          {noticeAudienceLabel[notice.audience_type]}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notice.published_at
                            ? `Published ${formatDateTime(notice.published_at)}`
                            : `Created ${formatDateTime(notice.created_at)}`}
                          {notice.expires_at
                            ? ` · expires ${formatDateTime(notice.expires_at)}`
                            : ""}
                        </p>
                        {notice.requires_acknowledgement ? (
                          <p className="mt-1 text-xs font-medium">
                            Acknowledged by {acked} of {expected} tenant(s)
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(expanded ? null : notice.id)}
                        >
                          {expanded ? "Hide" : "Details"}
                        </Button>
                        {notice.status === "draft" ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setNoticeDialog({ open: true, mode: "edit", notice })
                              }
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              disabled={action.isPending}
                              onClick={() =>
                                action.mutate(() => publishNotice(notice.id, true))
                              }
                            >
                              Publish
                            </Button>
                          </>
                        ) : null}
                        {notice.status === "published" ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                setNoticeDialog({ open: true, mode: "revise", notice })
                              }
                            >
                              Revise
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={action.isPending}
                              onClick={() => {
                                const note = window.prompt("Archiving note (optional)") ?? "";
                                action.mutate(() => archiveNotice(notice.id, note || null));
                              }}
                            >
                              Archive
                            </Button>
                            {role === "owner" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={action.isPending}
                                onClick={() => {
                                  const reason = window.prompt("Why is this notice cancelled?");
                                  if (!reason) return;
                                  action.mutate(() => cancelNotice(notice.id, reason));
                                }}
                              >
                                Cancel
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Message
                          </p>
                          <p className="mt-2 whitespace-pre-wrap">{notice.content}</p>
                          {notice.cancellation_reason ? (
                            <p className="mt-2 text-xs text-destructive">
                              Cancelled: {notice.cancellation_reason}
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            History
                          </p>
                          <div className="mt-2">
                            {eventsQuery.isLoading ? (
                              <p className="text-sm text-muted-foreground">Loading history…</p>
                            ) : (
                              <NoticeHistory events={eventsQuery.data ?? []} />
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardSection>
      ) : (
        <DashboardSection
          title="Documents"
          description="Files are private. Sharing a new version archives the previous one."
        >
          {documentsQuery.isLoading ? (
            <EmptyState>Loading documents…</EmptyState>
          ) : filteredDocuments.length === 0 ? (
            <EmptyState>No documents shared yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {filteredDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={doc.category} />
                      <VisibilityBadge visibility={doc.visibility} />
                      {!doc.is_active ? (
                        <span className="text-xs text-muted-foreground">Archived</span>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium">
                      {doc.title} <span className="text-xs">v{doc.version_number}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {doc.building_name} · {doc.file_name} · {formatFileSize(doc.file_size)} ·
                      shared {formatDateTime(doc.created_at)}
                    </p>
                    {doc.visibility === "selected_flats" ||
                    doc.visibility === "selected_tenants" ? (
                      <p className="text-xs text-muted-foreground">
                        {docTargets.filter((target) => target.document_id === doc.id).length}{" "}
                        recipient(s)
                      </p>
                    ) : null}
                    {doc.description ? <p className="mt-1">{doc.description}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void openDocument(doc)}>
                      View
                    </Button>
                    {doc.is_active ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDocDialog({ open: true, replaces: doc })}
                        >
                          New version
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={action.isPending}
                          onClick={() => {
                            const reason = window.prompt("Why is this document archived?");
                            if (!reason) return;
                            action.mutate(() => archiveDocument(doc.id, reason));
                          }}
                        >
                          Archive
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardSection>
      )}

      <NoticeFormDialog
        open={noticeDialog.open}
        onOpenChange={(open) => setNoticeDialog((prev) => ({ ...prev, open }))}
        mode={noticeDialog.mode}
        notice={noticeDialog.notice}
        buildings={buildings}
        defaultBuildingId={
          buildingFilter !== "all" ? buildingFilter : (buildings[0]?.id ?? "")
        }
        targetFlatIds={(recipientsQuery.data ?? [])
          .filter((r) => r.notice_id === noticeDialog.notice?.id && r.flat_id)
          .map((r) => r.flat_id as string)}
        targetTenantIds={(recipientsQuery.data ?? [])
          .filter((r) => r.notice_id === noticeDialog.notice?.id && r.tenant_id)
          .map((r) => r.tenant_id as string)}
      />

      <DocumentFormDialog
        open={docDialog.open}
        onOpenChange={(open) => setDocDialog((prev) => ({ ...prev, open }))}
        buildings={buildings}
        defaultBuildingId={buildingFilter !== "all" ? buildingFilter : (buildings[0]?.id ?? "")}
        replaces={docDialog.replaces}
      />
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
