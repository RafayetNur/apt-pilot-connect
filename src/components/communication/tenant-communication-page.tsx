import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  NoticePriorityBadge,
  CategoryBadge,
} from "@/components/communication/parts";
import { DashboardSection, EmptyState } from "@/components/dashboard/parts";
import { DashboardShell } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  acknowledgeNotice,
  createDocumentSignedUrl,
  documentsQueryOptions,
  formatFileSize,
  isExpired,
  noticeAcknowledgementsQueryOptions,
  noticesQueryOptions,
  sortNoticesForTenant,
} from "@/lib/communication";
import { formatDateTime } from "@/lib/maintenance";

export function TenantCommunicationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const noticesQuery = useQuery(noticesQueryOptions());
  const acksQuery = useQuery(noticeAcknowledgementsQueryOptions());
  const documentsQuery = useQuery(documentsQueryOptions());

  const notices = sortNoticesForTenant(noticesQuery.data ?? []);
  const myAcks = new Set(
    (acksQuery.data ?? []).filter((a) => a.tenant_id === user?.id).map((a) => a.notice_id),
  );
  const active = notices.filter((n) => n.status === "published" && !isExpired(n));
  const previous = notices.filter((n) => n.status !== "published" || isExpired(n));
  const documents = (documentsQuery.data ?? []).filter((doc) => doc.is_active);

  const acknowledge = useMutation({
    mutationFn: (noticeId: string) => acknowledgeNotice(noticeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notice-acknowledgements"] });
      toast.success("Thanks — your acknowledgement is recorded.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not record that."),
  });

  async function openDocument(path: string) {
    try {
      const url = await createDocumentSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the document.");
    }
  }

  return (
    <DashboardShell
      role="tenant"
      title="Notices & documents"
      intro="Notices from your building owner or manager, and the documents shared with you."
    >
      <DashboardSection title="Active notices">
        {noticesQuery.isLoading ? (
          <EmptyState>Loading notices…</EmptyState>
        ) : active.length === 0 ? (
          <EmptyState>You have no active notices right now.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {active.map((notice) => (
              <li
                key={notice.id}
                className="rounded-2xl border border-border/60 bg-card p-4 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <NoticePriorityBadge priority={notice.priority} />
                  <span className="text-xs text-muted-foreground">
                    {notice.building_name} · {notice.notice_number}
                  </span>
                </div>
                <p className="mt-2 font-display text-base font-semibold">{notice.title}</p>
                <p className="text-xs text-muted-foreground">
                  Published {formatDateTime(notice.published_at)}
                  {notice.expires_at ? ` · until ${formatDateTime(notice.expires_at)}` : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{notice.content}</p>
                {notice.requires_acknowledgement ? (
                  myAcks.has(notice.id) ? (
                    <p className="mt-3 text-xs font-medium text-primary">
                      You acknowledged this notice.
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={acknowledge.isPending}
                      onClick={() => acknowledge.mutate(notice.id)}
                    >
                      I have read this
                    </Button>
                  )
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>

      <DashboardSection title="Documents shared with you">
        {documents.length === 0 ? (
          <EmptyState>No documents have been shared with you yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="mr-2">
                    <CategoryBadge category={doc.category} />
                  </span>
                  {doc.title}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {doc.file_name} · {formatFileSize(doc.file_size)}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => void openDocument(doc.storage_path)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>

      <DashboardSection title="Previous notices">
        {previous.length === 0 ? (
          <EmptyState>Nothing archived yet.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {previous.map((notice) => (
              <li
                key={notice.id}
                className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-sm"
              >
                <p className="font-medium">{notice.title}</p>
                <p className="text-xs text-muted-foreground">
                  {notice.building_name} · {notice.notice_number} ·{" "}
                  {notice.status === "cancelled" ? "Cancelled" : "No longer active"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </DashboardShell>
  );
}
