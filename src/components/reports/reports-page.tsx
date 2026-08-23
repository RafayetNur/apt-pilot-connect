import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  CashFlowView,
  CollectionView,
  ExpenseReportView,
  MonthlyStatementView,
  OutstandingView,
} from "@/components/reports/report-views";
import { OwnerSummaryView, TenantLedgerView } from "@/components/reports/ledger-and-summary";
import { ReportEmpty, ReportPanel } from "@/components/reports/parts";
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
import { flatTenantsQueryOptions, flatsQueryOptions } from "@/lib/flats";
import { currentMonthInput, formatMonth } from "@/lib/rent";
import {
  monthStartInput,
  monthsAgoInput,
  reportBuildingsQueryOptions,
  todayInput,
  type OutstandingFilters,
} from "@/lib/reports";

type ReportType =
  | "statement"
  | "cash_flow"
  | "outstanding"
  | "collection"
  | "expenses"
  | "ledger"
  | "owner_summary";

const reportLabels: Array<{ value: ReportType; label: string; ownerOnly?: boolean }> = [
  { value: "statement", label: "Monthly building statement" },
  { value: "cash_flow", label: "Cash flow report" },
  { value: "outstanding", label: "Outstanding rent report" },
  { value: "collection", label: "Collection report" },
  { value: "expenses", label: "Expense report" },
  { value: "ledger", label: "Tenant ledger" },
  { value: "owner_summary", label: "All-buildings owner summary", ownerOnly: true },
];

export function ReportsPage({ role }: { role: AppRole }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = role === "owner";

  const buildingsQuery = useQuery(reportBuildingsQueryOptions());
  const buildings = buildingsQuery.data ?? [];

  const [reportType, setReportType] = useState<ReportType>("statement");
  const [buildingId, setBuildingId] = useState("");
  const [month, setMonth] = useState(currentMonthInput());
  const [fromMonth, setFromMonth] = useState(monthsAgoInput(5));
  const [toMonth, setToMonth] = useState(currentMonthInput());
  const [dateFrom, setDateFrom] = useState(monthStartInput(currentMonthInput()));
  const [dateTo, setDateTo] = useState(todayInput());
  const [tenantId, setTenantId] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());

  const activeBuildingId = buildingId || buildings[0]?.id || "";
  const activeBuilding = buildings.find((building) => building.id === activeBuildingId);

  const flatsQuery = useQuery({
    ...flatsQueryOptions(activeBuildingId),
    enabled: Boolean(activeBuildingId),
  });
  const flats = flatsQuery.data ?? [];
  const tenantIds = useMemo(
    () => flats.map((flat) => flat.tenant_id).filter((id): id is string => Boolean(id)),
    [flats],
  );
  const tenantsQuery = useQuery(flatTenantsQueryOptions(tenantIds));
  const tenants = tenantsQuery.data ?? {};
  const activeTenantId = tenantId || tenantIds[0] || "";
  const activeTenantFlat = flats.find((flat) => flat.tenant_id === activeTenantId);

  const [outstandingExtras, setOutstandingExtras] = useState({
    flatId: "all",
    status: "all" as OutstandingFilters["status"],
    includeSettled: false,
  });

  const outstandingFilters: OutstandingFilters = {
    buildingId: activeBuildingId,
    fromMonth,
    toMonth,
    tenantId: "all",
    flatId: outstandingExtras.flatId,
    status: outstandingExtras.status,
    includeSettled: outstandingExtras.includeSettled,
  };

  const availableReports = reportLabels.filter((item) => !item.ownerOnly || isOwner);

  const period =
    reportType === "statement"
      ? formatMonth(month)
      : reportType === "cash_flow"
        ? `${dateFrom} → ${dateTo}`
        : reportType === "ledger"
          ? "Full history"
          : `${formatMonth(fromMonth)} → ${formatMonth(toMonth)}`;

  async function refresh() {
    await queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0]).startsWith("report-"),
    });
    setRefreshedAt(new Date());
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-semibold">Financial reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cash basis. Rental income is recognised only when a payment is verified and applied;
            unpaid rent is never shown as income and advance credit is not income until it is
            applied. Reports are read-only and never change financial records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </div>
      </header>

      <section className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <div className="space-y-2">
          <Label htmlFor="report-type">Report</Label>
          <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
            <SelectTrigger id="report-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableReports.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {reportType !== "owner_summary" ? (
          <div className="space-y-2">
            <Label htmlFor="report-building">Building</Label>
            <Select value={activeBuildingId} onValueChange={setBuildingId}>
              <SelectTrigger id="report-building">
                <SelectValue placeholder="Select building" />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {reportType === "statement" ? (
          <div className="space-y-2">
            <Label htmlFor="report-month">Billing month</Label>
            <Input
              id="report-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        ) : null}

        {reportType === "cash_flow" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="report-date-from">Date from</Label>
              <Input
                id="report-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-date-to">Date to</Label>
              <Input
                id="report-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {["outstanding", "collection", "expenses", "owner_summary"].includes(reportType) ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="report-from-month">From month</Label>
              <Input
                id="report-from-month"
                type="month"
                value={fromMonth}
                onChange={(event) => setFromMonth(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to-month">To month</Label>
              <Input
                id="report-to-month"
                type="month"
                value={toMonth}
                onChange={(event) => setToMonth(event.target.value)}
              />
            </div>
          </>
        ) : null}

        {reportType === "ledger" ? (
          <div className="space-y-2">
            <Label htmlFor="report-tenant">Tenant</Label>
            <Select value={activeTenantId} onValueChange={setTenantId}>
              <SelectTrigger id="report-tenant">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenantIds.map((id) => {
                  const flat = flats.find((item) => item.tenant_id === id);
                  return (
                    <SelectItem key={id} value={id}>
                      {tenants[id]?.full_name ?? "Tenant"}
                      {flat ? ` · Flat ${flat.flat_number}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </section>

      <section id="aptpilot-report" className="panel space-y-5 p-4 sm:p-6">
        <header className="border-b border-border/60 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            AptPilot · Cash basis financial report
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {availableReports.find((item) => item.value === reportType)?.label}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {reportType === "owner_summary"
              ? "All buildings you own"
              : (activeBuilding?.name ?? "No building selected")}{" "}
            · Period: {period}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {refreshedAt.toLocaleString("en-GB")} by{" "}
            {profile?.full_name || profile?.email || "signed-in user"} · Last refreshed{" "}
            {refreshedAt.toLocaleTimeString("en-GB")}
          </p>
        </header>

        {buildingsQuery.isLoading ? (
          <ReportEmpty>Loading your buildings…</ReportEmpty>
        ) : buildings.length === 0 ? (
          <ReportEmpty>
            You do not have any building assigned yet, so there is nothing to report on.
          </ReportEmpty>
        ) : reportType === "statement" ? (
          <MonthlyStatementView
            buildingId={activeBuildingId}
            month={month}
            canSeeDiagnostics={isOwner}
          />
        ) : reportType === "cash_flow" ? (
          <CashFlowView buildingId={activeBuildingId} dateFrom={dateFrom} dateTo={dateTo} />
        ) : reportType === "outstanding" ? (
          <OutstandingView
            filters={outstandingFilters}
            onFiltersChange={(next) =>
              setOutstandingExtras({
                flatId: next.flatId,
                status: next.status,
                includeSettled: next.includeSettled,
              })
            }
          />
        ) : reportType === "collection" ? (
          <CollectionView
            buildingId={activeBuildingId}
            fromMonth={fromMonth}
            toMonth={toMonth}
          />
        ) : reportType === "expenses" ? (
          <ExpenseReportView
            buildingId={activeBuildingId}
            fromMonth={fromMonth}
            toMonth={toMonth}
          />
        ) : reportType === "ledger" ? (
          <TenantLedgerView
            tenantId={activeTenantId || null}
            flatId={activeTenantFlat?.id ?? null}
          />
        ) : (
          <OwnerSummaryView fromMonth={fromMonth} toMonth={toMonth} enabled={isOwner} />
        )}
      </section>

      {reportType === "statement" ? (
        <ReportPanel
          title="How these numbers are calculated"
          description="Billing performance uses billing_month; cash movement uses the payment verification date. They are deliberately reported separately."
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Total billed = base rent + individual charges + shared allocations + approved debit adjustments − approved credit adjustments.</li>
            <li>Verified paid = amount actually applied to that month&apos;s rent records.</li>
            <li>Collection rate = verified paid ÷ total billed × 100 (0% when nothing is billed).</li>
            <li>Approved expenses = approved, non-cancelled expenses posted to that accounting month.</li>
            <li>Net cash result = verified cash applied in the period − approved expenses for the period.</li>
          </ul>
        </ReportPanel>
      ) : null}

      <p className="text-xs text-muted-foreground print:hidden">
        Exports contain only the data you are authorised to see and never include receipt or
        payment-proof links. PDF is produced through your browser&apos;s print dialog (Save as PDF)
        so no extra dependency is required.
      </p>
    </div>
  );
}
