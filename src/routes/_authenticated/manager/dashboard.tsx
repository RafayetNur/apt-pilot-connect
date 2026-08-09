import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ClosureStatusStrip } from "@/components/closings/closure-status-strip";
import { ExpenseDashboardSection } from "@/components/expenses/expense-dashboard-section";
import { FinancialDashboardSection } from "@/components/reports/financial-dashboard-section";
import { DashboardShell } from "@/components/dashboard-shell";

import {
  DashboardSection,
  EmptyState,
  MonthPicker,
  QuickActions,
  StatCard,
} from "@/components/dashboard/parts";
import { Badge } from "@/components/ui/badge";
import { dashboardSummaryQueryOptions } from "@/lib/dashboard";
import { formatRent } from "@/lib/flats";
import { currentMonthInput, formatMonth } from "@/lib/rent";
import { formatDateTime, paymentMethodLabel, verificationStatusLabel } from "@/lib/payments";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({
    meta: [
      { title: "Manager dashboard — AptPilot" },
      {
        name: "description",
        content:
          "Manager overview of assigned buildings: occupancy, monthly payable, verified collection, dues and bills that still need charge entry.",
      },
      { property: "og:title", content: "Manager dashboard — AptPilot" },
      {
        property: "og:description",
        content: "Daily operations summary for the buildings assigned to you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManagerDashboard,
});

function ManagerDashboard() {
  const [month, setMonth] = useState(currentMonthInput());
  const { data, isLoading, error } = useQuery(dashboardSummaryQueryOptions(month));
  const totals = data?.totals;

  return (
    <DashboardShell
      role="manager"
      title="Manager dashboard"
      intro="Everything below covers only the buildings assigned to you."
      action={<MonthPicker month={month} onChange={setMonth} />}
    >
      <section className="mt-6">
        <QuickActions
          items={[
            { label: "Enter flat bills", to: "/manager/bills" },
            { label: "Add shared charge", to: "/manager/bills" },
            { label: "Record cash payment", to: "/manager/payments" },
            { label: "Review payments", to: "/manager/payments" },
          ]}
        />
      </section>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading your summary…</p>
      ) : error ? (
        <p className="mt-6 text-sm text-destructive">
          Could not load your summary: {(error as Error).message}
        </p>
      ) : !totals || !data ? null : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Assigned buildings" value={String(totals.totalBuildings)} />
            <StatCard
              label="Flats"
              value={String(totals.totalFlats)}
              hint={`${totals.occupied} occupied · ${totals.vacant} vacant`}
            />
            <StatCard
              label={`Total payable · ${formatMonth(`${month}-01`)}`}
              value={formatRent(totals.totalPayable)}
              hint="Rent + flat bills + shared charges"
            />
            <StatCard
              label="Verified collection"
              value={formatRent(totals.collected)}
              tone="positive"
            />
            <StatCard
              label="Remaining due"
              value={formatRent(totals.remaining)}
              tone="danger"
            />
            <StatCard label="Overdue" value={formatRent(totals.overdue)} tone="danger" />
            <StatCard
              label="Pending verifications"
              value={String(totals.pendingVerifications)}
              to="/manager/payments"
            />
            <StatCard
              label="Bills needing entry"
              value={String(data.needsChargeEntry.length)}
              hint="Billed flats with no flat charge yet"
              to="/manager/bills"
            />
          </div>

          <DashboardSection
            title="Monthly closing status"
            description={`Read-only. Only the building owner can close or reopen ${formatMonth(`${month}-01`)}.`}
          >
            {data.buildings.length === 0 ? (
              <EmptyState>No building has been assigned to you yet.</EmptyState>
            ) : (
              <ClosureStatusStrip month={month} buildings={data.buildings} />
            )}
          </DashboardSection>

          <FinancialDashboardSection role="manager" />

          <ExpenseDashboardSection role="manager" month={month} />



          <DashboardSection
            title="Building-wise summary"
            description={`Assigned buildings for ${formatMonth(`${month}-01`)}.`}
          >

            {data.buildingSummaries.length === 0 ? (
              <EmptyState>No building has been assigned to you yet.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Building</th>
                      <th className="py-2 pr-3">Flats</th>
                      <th className="py-2 pr-3">Payable</th>
                      <th className="py-2 pr-3">Collected</th>
                      <th className="py-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.buildingSummaries.map((row) => (
                      <tr key={row.id} className="border-t border-border/60">
                        <td className="py-2 pr-3 font-medium">{row.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {row.occupied}/{row.totalFlats} occupied
                        </td>
                        <td className="py-2 pr-3">{formatRent(row.payable)}</td>
                        <td className="py-2 pr-3">{formatRent(row.collected)}</td>
                        <td className="py-2">{formatRent(row.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>

          <DashboardSection
            title="Flats still needing manual charge entry"
            description="Billed flats with no electricity, gas, water, internet or other charge recorded for this month."
          >
            {data.needsChargeEntry.length === 0 ? (
              <EmptyState>
                Every billed flat has at least one charge recorded for this month.
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {data.needsChargeEntry.slice(0, 12).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <span>
                      {row.building_name} · Flat {row.flat_number} · {row.tenant_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Rent {formatRent(row.base_rent)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>

          <DashboardSection
            title="Recent tenant payment submissions"
            description="Latest submissions waiting for your review."
          >
            {data.recentSubmissions.length === 0 ? (
              <EmptyState>No payment has been submitted yet.</EmptyState>
            ) : (
              <ul className="grid gap-2">
                {data.recentSubmissions.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <span>
                      {payment.tenant_name} · Flat {payment.flat_number} ·{" "}
                      {formatRent(payment.amount_paid)}
                      <span className="block text-xs text-muted-foreground">
                        {paymentMethodLabel[payment.payment_method]} ·{" "}
                        {formatDateTime(payment.submitted_at)}
                      </span>
                    </span>
                    <Badge
                      variant={
                        payment.verification_status === "verified"
                          ? "default"
                          : payment.verification_status === "pending"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {verificationStatusLabel[payment.verification_status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </DashboardSection>
        </>
      )}
    </DashboardShell>
  );
}
