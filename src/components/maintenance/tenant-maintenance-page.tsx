import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PriorityBadge, StatusBadge } from "@/components/maintenance/parts";
import { RequestDetailPanel } from "@/components/maintenance/request-detail-panel";
import { RequestFormDialog } from "@/components/maintenance/request-form-dialog";
import { StatCard } from "@/components/dashboard/parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions, useQuery as useRq } from "@tanstack/react-query";
import {
  formatDateTime,
  isOpenStatus,
  maintenanceCategoryLabel,
  myMaintenanceRequestsQueryOptions,
} from "@/lib/maintenance";

/** The tenant's own flat + building, used to scope new requests. */
const myFlatQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-flat", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flats")
        .select("id, flat_number, building_id, buildings(name)")
        .eq("tenant_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as {
        id: string;
        flat_number: string;
        building_id: string;
        buildings?: { name: string } | null;
      };
      return {
        id: row.id,
        flat_number: row.flat_number,
        building_id: row.building_id,
        building_name: row.buildings?.name ?? "Your building",
      };
    },
  });

export function TenantMaintenancePage() {
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const flatQuery = useRq(myFlatQueryOptions(user?.id));
  const flat = flatQuery.data ?? null;

  const requestsQuery = useQuery(myMaintenanceRequestsQueryOptions(user?.id));
  const rows = requestsQuery.data ?? [];
  const open = useMemo(() => rows.filter((row) => isOpenStatus(row.status)), [rows]);
  const latest = rows[0] ?? null;
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Maintenance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report a problem in your flat or in the building&apos;s common areas. Reporting an issue
            never changes your rent, bills or payments.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={!flat}>
          Report an issue
        </Button>
      </header>

      {!flat ? (
        <p className="panel p-4 text-sm text-muted-foreground">
          You do not have an assigned flat yet, so requests cannot be submitted. Contact your
          building manager.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open requests" value={String(open.length)} />
        <StatCard
          label="Latest request"
          value={latest ? latest.request_number : "None yet"}
          {...(latest ? { hint: formatDateTime(latest.created_at) } : {})}
        />
        <StatCard label="Total reported" value={String(rows.length)} />
      </section>

      <section className="panel p-0">
        <ul className="divide-y divide-border/60">
          {requestsQuery.isLoading ? (
            <li className="p-4 text-sm text-muted-foreground">Loading your requests…</li>
          ) : rows.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">
              You have not reported any issue yet.
            </li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.request_number} · {maintenanceCategoryLabel[row.category]} ·{" "}
                    {row.is_common_area ? "Common area" : `Flat ${row.flat_number ?? "—"}`} ·{" "}
                    {formatDateTime(row.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={row.priority} />
                  <StatusBadge status={row.status} />
                  <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                    {selectedId === row.id ? "Viewing" : "Open"}
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {selected ? (
        <section className="panel p-4">
          <RequestDetailPanel
            request={selected}
            role="tenant"
            currentUserId={user?.id}
            isOwnerOfBuilding={false}
            assignable={[]}
          />
        </section>
      ) : null}

      <RequestFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role="tenant"
        buildings={flat ? [{ id: flat.building_id, name: flat.building_name }] : []}
        defaultBuildingId={flat?.building_id ?? ""}
        lockedFlatNumber={flat?.flat_number ?? null}
        lockedFlatId={flat?.id ?? null}
      />
    </div>
  );
}
