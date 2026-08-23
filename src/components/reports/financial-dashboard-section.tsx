import { useQuery } from "@tanstack/react-query";

import { DashboardSection, EmptyState, StatCard } from "@/components/dashboard/parts";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatRent } from "@/lib/flats";
import { currentMonthInput, formatMonth } from "@/lib/rent";
import {
  cashFlowQueryOptions,
  collectionQueryOptions,
  expenseReportQueryOptions,
  formatPercent,
  monthEndInput,
  monthStartInput,
  reportBuildingsQueryOptions,
} from "@/lib/reports";

/**
 * Current-month financial snapshot for owner/manager dashboards. Every number
 * comes from the read-only reporting functions, scoped to the buildings the
 * signed-in user may review.
 */
export function FinancialDashboardSection({ role }: { role: "owner" | "manager" }) {
  const month = currentMonthInput();
  const buildingsQuery = useQuery(reportBuildingsQueryOptions());
  const buildings = buildingsQuery.data ?? [];
  const firstBuildingId = buildings[0]?.id ?? "";

  const collectionQuery = useQuery(collectionQueryOptions(month, month, "all"));
  const expensesQuery = useQuery(expenseReportQueryOptions(month, month, "all"));
  const cashQuery = useQuery({
    ...cashFlowQueryOptions(firstBuildingId, monthStartInput(month), monthEndInput(month)),
    enabled: buildings.length === 1 && Boolean(firstBuildingId),
  });

  const rows = collectionQuery.data ?? [];
  const billed = rows.reduce((acc, row) => acc + row.total_billed, 0);
  const collected = rows.reduce((acc, row) => acc + row.collected, 0);
  const outstanding = rows.reduce((acc, row) => acc + row.outstanding, 0);
  const expenses = expensesQuery.data?.approved_total ?? 0;
  const rate = billed > 0 ? Math.round((collected / billed) * 10000) / 100 : 0;
  const reportsPath = role === "owner" ? "/owner/reports" : "/manager/reports";

  const netCash =
    buildings.length === 1 && cashQuery.data
      ? cashQuery.data.rent_cash_received - cashQuery.data.approved_expenses
      : collected - expenses;

  return (
    <DashboardSection
      title={`Financial snapshot · ${formatMonth(month)}`}
      description="Cash basis. Unpaid rent is never counted as income and pending records are excluded."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={reportsPath}>
            {role === "owner" ? "Open full reports" : "Assigned-building reports"}
          </Link>
        </Button>
      }
    >
      {collectionQuery.isLoading ? (
        <EmptyState>Loading this month&apos;s figures…</EmptyState>
      ) : buildings.length === 0 ? (
        <EmptyState>No buildings are available to you yet.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Billed this month" value={formatRent(billed)} />
          <StatCard label="Collected this month" value={formatRent(collected)} tone="positive" />
          <StatCard label="Current outstanding" value={formatRent(outstanding)} tone="danger" />
          <StatCard label="Approved expenses" value={formatRent(expenses)} />
          <StatCard
            label="Net cash movement"
            value={formatRent(netCash)}
            tone={netCash >= 0 ? "positive" : "danger"}
            hint="Verified cash applied − approved expenses"
          />
          <StatCard label="Collection rate" value={formatPercent(rate)} />
        </div>
      )}
    </DashboardSection>
  );
}
