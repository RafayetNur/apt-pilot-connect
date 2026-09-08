import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/maintenance/parts";
import { RequestDetailPanel } from "@/components/maintenance/request-detail-panel";
import { RequestFormDialog } from "@/components/maintenance/request-form-dialog";
import { StatCard } from "@/components/dashboard/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { buildingsQueryOptions } from "@/lib/buildings";
import { flatsQueryOptions } from "@/lib/flats";
import { cn } from "@/lib/utils";
import {
  assignableUsersQueryOptions,
  emptyMaintenanceFilters,
  formatDateTime,
  maintenanceCategoryLabel,
  maintenanceCategoryOptions,
  maintenancePriorityLabel,
  maintenancePriorityOptions,
  maintenanceRequestsQueryOptions,
  maintenanceStatusLabel,
  maintenanceStatusOptions,
  summarizeMaintenance,
  type MaintenanceCategory,
  type MaintenanceFilters,
  type MaintenancePriority,
  type MaintenanceRow,
  type MaintenanceStatus,
} from "@/lib/maintenance";

/** One row of the master list — the whole card is the "open" control. */
function RequestListCard({
  request,
  selected,
  onSelect,
}: {
  request: MaintenanceRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border/60 bg-card hover:bg-muted",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate font-medium">{request.title}</p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {request.request_number} · {maintenanceCategoryLabel[request.category]}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {request.building_name} ·{" "}
          {request.is_common_area
            ? "Common area"
            : request.flat_number
              ? `Flat ${request.flat_number}`
              : "—"}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <StatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
        </div>
        <p className="text-xs text-muted-foreground">
          Reported {formatDateTime(request.created_at)}
        </p>
        {request.assignee_name ? (
          <p className="truncate text-xs text-muted-foreground">
            Assigned to {request.assignee_name}
          </p>
        ) : null}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export function MaintenanceManagementPage({ role }: { role: AppRole }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<MaintenanceFilters>(emptyMaintenanceFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const buildingsQuery = useQuery(buildingsQueryOptions());
  const buildings = buildingsQuery.data ?? [];
  const flatsQuery = useQuery({
    ...flatsQueryOptions(filters.buildingId),
    enabled: filters.buildingId !== "all",
  });
  const flats = flatsQuery.data ?? [];

  const requestsQuery = useQuery(maintenanceRequestsQueryOptions(filters));
  const rows = requestsQuery.data ?? [];
  const summary = useMemo(() => summarizeMaintenance(rows), [rows]);
  const emergencies = rows.filter(
    (row) => row.priority === "emergency" && row.status !== "closed" && row.status !== "rejected",
  );

  const assignableQuery = useQuery(assignableUsersQueryOptions(buildings.map((b) => b.id)));
  const assignable = assignableQuery.data ?? [];

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const isOwnerOfSelected =
    role === "owner" && selected != null && buildings.some((b) => b.id === selected.building_id);

  const update = (patch: Partial<MaintenanceFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Maintenance management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, assign and resolve reported problems. Maintenance records never change tenant
            bills, payments, shared charges or the monthly closing.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={buildings.length === 0}>
          Log a request
        </Button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Open requests" value={String(summary.open)} />
        <StatCard
          label="Emergency"
          value={String(summary.emergency)}
          tone="danger"
          hint="Handled by phone, not by the app"
        />
        <StatCard label="Unassigned" value={String(summary.unassigned)} tone="warning" />
        <StatCard label="Waiting for parts" value={String(summary.waitingForParts)} />
        <StatCard label="Resolved last 7 days" value={String(summary.recentlyResolved)} tone="positive" />
      </section>

      {emergencies.length > 0 ? (
        <section className="panel border-destructive/40 p-4">
          <h2 className="font-display text-lg font-semibold">Emergency queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Call the building&apos;s emergency contact directly for anything involving personal
            safety. AptPilot records and tracks the response — it does not dispatch anyone.
          </p>
          <ul className="mt-3 space-y-2">
            {emergencies.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.request_number}
                  </span>{" "}
                  · {row.title} · {row.building_name}
                  {row.flat_number ? ` · Flat ${row.flat_number}` : " · Common area"}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                    Open
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="mf-building">Building</Label>
          <Select
            value={filters.buildingId}
            onValueChange={(value) => update({ buildingId: value, flatId: "all" })}
          >
            <SelectTrigger id="mf-building">
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-flat">Flat</Label>
          <Select
            value={filters.flatId}
            onValueChange={(value) => update({ flatId: value })}
            disabled={filters.buildingId === "all"}
          >
            <SelectTrigger id="mf-flat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All flats</SelectItem>
              {flats.map((flat) => (
                <SelectItem key={flat.id} value={flat.id}>
                  Flat {flat.flat_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => update({ status: value as MaintenanceStatus | "all" | "open" })}
          >
            <SelectTrigger id="mf-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open only</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
              {maintenanceStatusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {maintenanceStatusLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-priority">Priority</Label>
          <Select
            value={filters.priority}
            onValueChange={(value) => update({ priority: value as MaintenancePriority | "all" })}
          >
            <SelectTrigger id="mf-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {maintenancePriorityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {maintenancePriorityLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-category">Category</Label>
          <Select
            value={filters.category}
            onValueChange={(value) => update({ category: value as MaintenanceCategory | "all" })}
          >
            <SelectTrigger id="mf-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {maintenanceCategoryOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {maintenanceCategoryLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-assignee">Assigned person</Label>
          <Select
            value={filters.assignedTo}
            onValueChange={(value) => update({ assignedTo: value })}
          >
            <SelectTrigger id="mf-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {user?.id ? <SelectItem value={user.id}>Assigned to me</SelectItem> : null}
              {assignable
                .filter((person) => person.id !== user?.id)
                .map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-from">Reported from</Label>
          <Input
            id="mf-from"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update({ dateFrom: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mf-to">Reported to</Label>
          <Input
            id="mf-to"
            type="date"
            value={filters.dateTo}
            onChange={(event) => update({ dateTo: event.target.value })}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="mf-search">Search title, description or request number</Label>
          <Input
            id="mf-search"
            value={filters.search}
            placeholder="e.g. leaking, MR-202608-00003"
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <section className="panel space-y-2 p-3">
          {requestsQuery.isLoading ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">Loading requests…</p>
          ) : rows.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              No maintenance requests match these filters.
            </p>
          ) : (
            rows.map((row) => (
              <RequestListCard
                key={row.id}
                request={row}
                selected={row.id === selectedId}
                onSelect={() => setSelectedId(row.id)}
              />
            ))
          )}
        </section>

        <section className="panel p-4">
          {selected ? (
            <RequestDetailPanel
              request={selected}
              role={role}
              currentUserId={user?.id}
              isOwnerOfBuilding={isOwnerOfSelected}
              assignable={assignable}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a request to see its timeline, work orders, attachments and comments.
            </p>
          )}
        </section>
      </div>

      <RequestFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={role}
        buildings={buildings}
        defaultBuildingId={filters.buildingId !== "all" ? filters.buildingId : (buildings[0]?.id ?? "")}
      />
    </div>
  );
}
