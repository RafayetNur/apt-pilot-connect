import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { DashboardShell } from "@/components/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { formatRent, myFlatQueryOptions, occupancyLabel } from "@/lib/flats";
import {
  formatDate,
  formatMonth,
  myRentRecordsQueryOptions,
  paymentStatusLabel,
  type PaymentStatus,
} from "@/lib/rent";

const statusVariant: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  paid: "default",
  unpaid: "secondary",
  overdue: "destructive",
};

function MyRentSection() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery(myRentRecordsQueryOptions(user?.id));
  const rows = data ?? [];

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold">Your rent bills</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading your rent bills…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not load your rent bills: {(error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No rent bill has been generated for this month.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-base font-semibold">
                    {formatMonth(row.billing_month)}
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatRent(row.base_rent)}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {formatDate(row.due_date)}
                  </p>
                </div>
                <Badge variant={statusVariant[row.payment_status]}>
                  {paymentStatusLabel[row.payment_status]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


export const Route = createFileRoute("/_authenticated/tenant/dashboard")({
  head: () => ({
    meta: [
      { title: "Tenant dashboard — AptPilot" },
      {
        name: "description",
        content: "Tenant workspace for your flat details, notices and requests on AptPilot.",
      },
      { property: "og:title", content: "Tenant dashboard — AptPilot" },
      { property: "og:description", content: "Your AptPilot tenant workspace." },
    ],
  }),
  component: TenantDashboard,
});

function AssignedFlatSection() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery(myFlatQueryOptions(user?.id));

  return (
    <section className="panel mt-6 p-6 sm:p-8">
      <h2 className="font-display text-lg font-semibold">Your flat</h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading your flat…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-destructive">
          Could not load your flat: {(error as Error).message}
        </p>
      ) : !data ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No flat has been assigned to your account yet.
        </p>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Building</dt>
            <dd className="mt-1 text-sm font-medium">{data.building?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
            <dd className="mt-1 text-sm font-medium">{data.building?.address || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Flat number</dt>
            <dd className="mt-1 text-sm font-medium">{data.flat.flat_number}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Floor</dt>
            <dd className="mt-1 text-sm font-medium">{data.flat.floor_number}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Monthly rent</dt>
            <dd className="mt-1 text-sm font-medium">{formatRent(data.flat.monthly_rent)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge
                variant={data.flat.occupancy_status === "occupied" ? "default" : "secondary"}
              >
                {occupancyLabel[data.flat.occupancy_status]}
              </Badge>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function TenantDashboard() {
  return (
    <DashboardShell
      role="tenant"
      title="Tenant dashboard"
      intro="This is your tenant workspace. Your flat details, notices and requests will live here."
    >
      <AssignedFlatSection />
    </DashboardShell>
  );
}
