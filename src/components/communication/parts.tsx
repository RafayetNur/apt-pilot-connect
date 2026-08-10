import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { flatTenantsQueryOptions, flatsQueryOptions } from "@/lib/flats";
import { formatDateTime } from "@/lib/maintenance";
import { cn } from "@/lib/utils";
import {
  documentCategoryLabel,
  documentVisibilityLabel,
  noticePriorityLabel,
  noticeStatusLabel,
  type DocumentCategory,
  type DocumentVisibility,
  type NoticeEvent,
  type NoticePriority,
  type NoticeStatus,
} from "@/lib/communication";

export function NoticePriorityBadge({ priority }: { priority: NoticePriority }) {
  const tone =
    priority === "emergency"
      ? "bg-destructive text-destructive-foreground"
      : priority === "urgent"
        ? "bg-accent text-accent-foreground"
        : priority === "important"
          ? "bg-secondary text-secondary-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        tone,
      )}
    >
      {noticePriorityLabel[priority]}
    </span>
  );
}

export function NoticeStatusBadge({ status }: { status: NoticeStatus }) {
  const variant =
    status === "published"
      ? "default"
      : status === "draft"
        ? "secondary"
        : ("outline" as const);
  return <Badge variant={variant}>{noticeStatusLabel[status]}</Badge>;
}

export function CategoryBadge({ category }: { category: DocumentCategory }) {
  return <Badge variant="secondary">{documentCategoryLabel[category]}</Badge>;
}

export function VisibilityBadge({ visibility }: { visibility: DocumentVisibility }) {
  return <Badge variant="outline">{documentVisibilityLabel[visibility]}</Badge>;
}

const noticeActionLabel: Record<string, string> = {
  created: "Draft created",
  edited: "Draft edited",
  published: "Published",
  acknowledged: "Acknowledged by a tenant",
  archived: "Archived",
  cancelled: "Cancelled",
};

export function NoticeHistory({ events }: { events: NoticeEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No history recorded yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="border-l-2 border-border pl-3">
          <p className="text-sm font-medium">{noticeActionLabel[event.action] ?? event.action}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
          {event.note ? <p className="mt-1 text-sm">{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/** Multi-select for flats or tenants of one building, used by notices and documents. */
export function AudienceTargetPicker({
  buildingId,
  mode,
  selectedFlatIds,
  selectedTenantIds,
  onFlatsChange,
  onTenantsChange,
  enabled,
}: {
  buildingId: string;
  mode: "flats" | "tenants";
  selectedFlatIds: string[];
  selectedTenantIds: string[];
  onFlatsChange: (ids: string[]) => void;
  onTenantsChange: (ids: string[]) => void;
  enabled: boolean;
}) {
  const flatsQuery = useQuery({
    ...flatsQueryOptions(buildingId),
    enabled: enabled && Boolean(buildingId),
  });
  const flats = flatsQuery.data ?? [];
  const tenantIds = flats
    .map((flat) => flat.tenant_id)
    .filter((id): id is string => Boolean(id));
  const tenantsQuery = useQuery({
    ...flatTenantsQueryOptions(tenantIds),
    enabled: enabled && mode === "tenants" && tenantIds.length > 0,
  });
  const tenants = Object.values(tenantsQuery.data ?? {});

  function toggle(list: string[], id: string, onChange: (ids: string[]) => void) {
    onChange(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  if (!buildingId) {
    return <p className="text-sm text-muted-foreground">Choose a building first.</p>;
  }

  if (mode === "flats") {
    if (flatsQuery.isLoading) {
      return <p className="text-sm text-muted-foreground">Loading flats…</p>;
    }
    if (flats.length === 0) {
      return <p className="text-sm text-muted-foreground">This building has no flats yet.</p>;
    }
    return (
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-surface p-3">
        {flats.map((flat) => (
          <label key={flat.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selectedFlatIds.includes(flat.id)}
              onCheckedChange={() => toggle(selectedFlatIds, flat.id, onFlatsChange)}
            />
            <span>
              Flat {flat.flat_number}
              <span className="ml-2 text-xs text-muted-foreground">
                {flat.occupancy_status === "occupied" ? "Occupied" : "Vacant"}
              </span>
            </span>
          </label>
        ))}
      </div>
    );
  }

  if (tenantsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tenants…</p>;
  }
  if (tenants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tenants are assigned to flats in this building yet.
      </p>
    );
  }
  return (
    <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/60 bg-surface p-3">
      {tenants.map((tenant) => (
        <label key={tenant.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selectedTenantIds.includes(tenant.id)}
            onCheckedChange={() => toggle(selectedTenantIds, tenant.id, onTenantsChange)}
          />
          <span>
            {tenant.full_name || tenant.email}
            <span className="ml-2 text-xs text-muted-foreground">{tenant.email}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-sm">
      {children}
    </Label>
  );
}
