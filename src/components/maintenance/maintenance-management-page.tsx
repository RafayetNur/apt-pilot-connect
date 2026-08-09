import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
  type MaintenanceStatus,
} from "@/lib/maintenance";

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="panel overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Request</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Priority</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Assigned</th>
                <th className="px-3 py-3">Reported</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {requestsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    Loading requests…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                    No maintenance requests match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.id === selectedId
                        ? "border-t border-border/50 bg-muted"
                        : "border-t border-border/50"
                    }
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium">{row.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {row.request_number} · {maintenanceCategoryLabel[row.category]}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {row.building_name}
                      <span className="block text-xs text-muted-foreground">
                        {row.is_common_area
                          ? "Common area"
                          : row.flat_number
                            ? `Flat ${row.flat_number}`
                            : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3">{row.assignee_name ?? "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
