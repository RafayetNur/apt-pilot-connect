import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { DashboardSection, EmptyState, StatCard } from "@/components/dashboard/parts";
import { PriorityBadge, StatusBadge } from "@/components/maintenance/parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/rent";
import {
  emptyMaintenanceFilters,
  maintenanceRequestsQueryOptions,
  summarizeMaintenance,
} from "@/lib/maintenance";

/** Owner and manager maintenance overview. Real records only, no notifications sent. */
export function MaintenanceDashboardSection({ role }: { role: "owner" | "manager" }) {
  const { user } = useAuth();
  const query = useQuery(
    maintenanceRequestsQueryOptions({ ...emptyMaintenanceFilters, status: "all" }),
  );
  const rows = query.data ?? [];
  const summary = useMemo(() => summarizeMaintenance(rows), [rows]);
  const path = role === "owner" ? "/owner/maintenance" : "/manager/maintenance";

  const assignedToMe = rows.filter(
    (row) => row.assigned_to === user?.id && row.status !== "closed" && row.status !== "rejected",
  );
  const today = new Date().toISOString().slice(0, 10);
  const scheduledToday = rows.filter(
    (row) => row.preferred_visit_date === today && row.status !== "closed",
  );

  return (
    <DashboardSection
      title="Maintenance"
      description="Reported problems for your buildings. Maintenance never changes bills, payments or the monthly closing."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={path}>Open maintenance</Link>
        </Button>
      }
    >
      {query.isLoading ? (
        <EmptyState>Loading maintenance requests…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>No maintenance request has been reported yet.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Open requests" value={String(summary.open)} />
            <StatCard label="Emergency" value={String(summary.emergency)} tone="danger" />
            <StatCard label="Unassigned" value={String(summary.unassigned)} tone="warning" />
            <StatCard label="Waiting for parts" value={String(summary.waitingForParts)} />
            <StatCard
              label="Needs acknowledgement"
              value={String(summary.needsAcknowledgement)}
              tone="warning"
            />
            {role === "manager" ? (
              <StatCard label="Assigned to me" value={String(assignedToMe.length)} />
            ) : (
              <StatCard
                label="Resolved last 7 days"
                value={String(summary.recentlyResolved)}
                tone="positive"
              />
            )}
          </div>

          {role === "manager" && scheduledToday.length > 0 ? (
            <div className="rounded-xl border border-border/60 bg-surface p-3 text-sm">
              <p className="font-medium">Requested visits for today</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {scheduledToday.map((row) => (
                  <li key={row.id}>
                    {row.request_number} · {row.title} ·{" "}
                    {row.preferred_visit_date ? formatDate(row.preferred_visit_date) : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.byBuilding.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Building</th>
                    <th className="py-2 text-right">Open</th>
                    <th className="py-2 text-right">Emergency</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byBuilding.map((row) => (
                    <tr key={row.building} className="border-t border-border/50">
                      <td className="py-2">{row.building}</td>
                      <td className="py-2 text-right">{row.open}</td>
                      <td className="py-2 text-right">{row.emergency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </DashboardSection>
  );
}

/** Tenant dashboard summary with a quick report action. */
export function TenantMaintenanceSummary() {
  const { user } = useAuth();
  const query = useQuery(
    maintenanceRequestsQueryOptions({ ...emptyMaintenanceFilters, status: "all" }),
  );
  const rows = (query.data ?? []).filter(
    (row) => row.submitted_by === user?.id || row.tenant_id === user?.id,
  );
  const open = rows.filter((row) => row.status !== "closed" && row.status !== "rejected");
  const latest = rows[0] ?? null;
  const upcoming = rows.find((row) => row.preferred_visit_date != null) ?? null;

  return (
    <DashboardSection
      title="Maintenance"
      description="Report a problem and follow its progress."
      action={
        <Button asChild size="sm">
          <Link to="/tenant/maintenance">Report an issue</Link>
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open requests" value={String(open.length)} />
        <StatCard
          label="Latest request"
          value={latest ? latest.request_number : "None yet"}
          {...(latest ? { hint: latest.title } : {})}
        />
        <StatCard
          label="Requested visit"
          value={upcoming?.preferred_visit_date ? formatDate(upcoming.preferred_visit_date) : "—"}
          hint="Confirmed schedules appear on the maintenance page"
        />
      </div>
      {latest ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Latest status:</span>
          <StatusBadge status={latest.status} />
          <PriorityBadge priority={latest.priority} />
        </div>
      ) : null}
    </DashboardSection>
  );
}
