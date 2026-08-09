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
import { formatDate, currentMonthInput, formatMonth, paymentStatusLabel } from "@/lib/rent";
import { formatDateTime, paymentMethodLabel, verificationStatusLabel } from "@/lib/payments";

export const Route = createFileRoute("/_authenticated/owner/dashboard")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — AptPilot" },
      {
        name: "description",
        content:
          "Owner overview of occupancy, monthly payable, verified collection, dues and pending payment verifications across your AptPilot buildings.",
      },
      { property: "og:title", content: "Owner dashboard — AptPilot" },
      {
        property: "og:description",
        content: "Live occupancy and collection summary for your apartment buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const [month, setMonth] = useState(currentMonthInput());
  const { data, isLoading, error } = useQuery(dashboardSummaryQueryOptions(month));

  const totals = data?.totals;

  return (
    <DashboardShell
      role="owner"
      title="Owner dashboard"
      intro="A live summary of your buildings, monthly payable, verified collection and outstanding dues. Every number comes from your own records."
      action={<MonthPicker month={month} onChange={setMonth} />}
    >
      <section className="mt-6">
        <QuickActions
          items={[
            { label: "Add building", to: "/owner/buildings" },
            { label: "Manage flats", to: "/owner/buildings" },
            { label: "Generate monthly rent", to: "/owner/rent" },
            { label: "Enter flat bills", to: "/owner/bills" },
            { label: "Add shared charge", to: "/owner/bills" },
            { label: "Review payments", to: "/owner/payments" },
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
            <StatCard
              label="Buildings"
              value={String(totals.totalBuildings)}
              to="/owner/buildings"
            />
            <StatCard
              label="Flats"
              value={String(totals.totalFlats)}
              hint={`${totals.occupied} occupied · ${totals.vacant} vacant`}
              to="/owner/buildings"
            />
            <StatCard label="Occupancy" value={`${totals.occupancyPct}%`} />
            <StatCard
              label="Pending verifications"
              value={String(totals.pendingVerifications)}
              to="/owner/payments"
            />
            <StatCard
              label={`Total payable · ${formatMonth(`${month}-01`)}`}
              value={formatRent(totals.totalPayable)}
              hint="Rent + flat bills + shared charges"
              to="/owner/rent"
            />
            <StatCard
              label="Verified collection"
              value={formatRent(totals.collected)}
              tone="positive"
              to="/owner/payments"
            />
            <StatCard
              label="Remaining due"
              value={formatRent(totals.remaining)}
              tone="danger"
              to="/owner/rent"
            />
            <StatCard
              label="Overdue"
              value={formatRent(totals.overdue)}
              hint="Past due date with money still owed"
              tone="danger"
            />
            <StatCard
              label="Tenant advance credit"
              value={formatRent(totals.availableCredit)}
              hint="From overpayments, not applied automatically"
            />
          </div>

          <DashboardSection
            title="Monthly closing status"
            description={`Whether ${formatMonth(`${month}-01`)} is still open for bill edits. Close a month from the Rent or Bills page.`}
          >
            {data.buildings.length === 0 ? (
              <EmptyState>No buildings yet.</EmptyState>
            ) : (
              <ClosureStatusStrip month={month} buildings={data.buildings} />
            )}
          </DashboardSection>

          <FinancialDashboardSection role="owner" />

          <ExpenseDashboardSection role="owner" month={month} />



          <DashboardSection
            title="Building-wise summary"
            description={`Occupancy and collection for ${formatMonth(`${month}-01`)}.`}
          >

            {data.buildingSummaries.length === 0 ? (
              <EmptyState>No buildings yet. Add your first building to get started.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-sm">
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

          <div className="grid gap-0 lg:grid-cols-2 lg:gap-6">
            <DashboardSection
              title="Recent payment submissions"
              description="Latest tenant submissions across your buildings."
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

            <DashboardSection
              title="Latest verified payments & receipts"
              description="Verified money with its receipt number."
            >
              {data.latestVerified.length === 0 ? (
                <EmptyState>No payment has been verified yet.</EmptyState>
              ) : (
                <ul className="grid gap-2">
                  {data.latestVerified.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                    >
                      <span>
                        {payment.tenant_name} · Flat {payment.flat_number}
                        <span className="block text-xs text-muted-foreground">
                          Verified {formatDateTime(payment.verified_at)}
                          {payment.receipt_number ? ` · ${payment.receipt_number}` : ""}
                        </span>
                      </span>
                      <span className="font-medium">{formatRent(payment.amount_paid)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </DashboardSection>
          </div>

          <DashboardSection
            title="Flats with outstanding dues"
            description={`Unpaid balance for ${formatMonth(`${month}-01`)}.`}
          >
            {data.outstanding.length === 0 ? (
              <EmptyState>
                No outstanding due for this month — or rent has not been generated yet.
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {data.outstanding.slice(0, 10).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm"
                  >
                    <span>
                      {row.building_name} · Flat {row.flat_number} · {row.tenant_name}
                      <span className="block text-xs text-muted-foreground">
                        Payable {formatRent(row.total_payable)} · Paid {formatRent(row.total_paid)} ·
                        Due {formatDate(row.due_date)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{paymentStatusLabel[row.payment_status]}</Badge>
                      <span className="font-medium">{formatRent(row.remaining_due)}</span>
                    </span>
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
