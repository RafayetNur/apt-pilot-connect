import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { StatCard } from "@/components/dashboard/parts";
import {
  BarList,
  ReportEmpty,
  ReportError,
  ReportLoading,
  ReportPanel,
  ReportTable,
  TrendBars,
} from "@/components/reports/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { closureStatusLabel } from "@/lib/closings";
import { expenseCategoryLabel } from "@/lib/expenses";
import { flatsQueryOptions, formatRent } from "@/lib/flats";
import { paymentMethodLabel } from "@/lib/payments";
import { formatDate, formatMonth, paymentStatusLabel } from "@/lib/rent";
import {
  cashFlowQueryOptions,
  collectionQueryOptions,
  expenseReportQueryOptions,
  exportCsv,
  formatPercent,
  monthlyStatementQueryOptions,
  outstandingQueryOptions,
  reconciliationIssueCount,
  reconciliationQueryOptions,
  type OutstandingFilters,
} from "@/lib/reports";

/* ---------------------------------- A ---------------------------------- */

export function MonthlyStatementView({
  buildingId,
  month,
  canSeeDiagnostics,
}: {
  buildingId: string;
  month: string;
  canSeeDiagnostics: boolean;
}) {
  const statementQuery = useQuery(monthlyStatementQueryOptions(buildingId, month));
  const reconQuery = useQuery(reconciliationQueryOptions(buildingId, month));
  const data = statementQuery.data;

  if (statementQuery.isError) return <ReportError error={statementQuery.error} />;
  if (statementQuery.isLoading || !data) return <ReportLoading />;

  const issues = reconciliationIssueCount(reconQuery.data);
  const billingSurplus = data.total_billed - data.approved_expenses;
  const netCash = data.cash_received_in_month - data.approved_expenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={data.month_status === "closed" ? "default" : "secondary"}>
          Month status: {closureStatusLabel[data.month_status]}
        </Badge>
        {data.month_status === "reopened" ? (
          <span className="text-xs text-muted-foreground">
            This month was reopened — totals may differ from the earlier closed statement.
          </span>
        ) : null}
        {issues > 0 ? (
          <Badge variant="destructive">Reconciliation issue ({issues})</Badge>
        ) : (
          <Badge variant="secondary">Reconciliation checks passed</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total billed" value={formatRent(data.total_billed)} hint="Base rent + charges + approved adjustments" />
        <StatCard label="Verified paid" value={formatRent(data.total_paid)} tone="positive" hint="Applied to this month's bills" />
        <StatCard label="Remaining due" value={formatRent(data.remaining_due)} tone="danger" />
        <StatCard label="Collection rate" value={formatPercent(data.collection_rate)} />
        <StatCard label="Approved expenses" value={formatRent(data.approved_expenses)} hint="Posted to this accounting month" />
        <StatCard label="Cash received in month" value={formatRent(data.cash_received_in_month)} hint="Verified payments applied (cash basis)" />
        <StatCard label="Net cash result" value={formatRent(netCash)} tone={netCash >= 0 ? "positive" : "danger"} hint="Cash received − approved expenses" />
        <StatCard label="Billing surplus indicator" value={formatRent(billingSurplus)} hint="Billed − approved expenses · not final accounting profit" />
        <StatCard label="Advance credits held" value={formatRent(data.credits_held)} hint="Not income until applied" />
        <StatCard label="Flats" value={`${data.flats_occupied} / ${data.flats_total}`} hint="Occupied / total" />
        <StatCard label="Rent records generated" value={String(data.rent_records)} />
        <StatCard
          label="Pending items"
          value={`${data.pending_payments + data.pending_adjustments + data.pending_expenses}`}
          tone="warning"
          hint={`${data.pending_payments} payments · ${data.pending_adjustments} adjustments · ${data.pending_expenses} expenses`}
        />
      </div>

      <ReportPanel title="Billed breakdown" description="Cash basis statement — billed components for this billing month.">
        <ReportTable headers={["Component", "Amount"]} minWidth="min-w-[420px]">
          {[
            ["Base rent", data.base_rent],
            ["Individual utility / manual charges", data.individual_charges],
            ["Allocated shared charges", data.shared_charges],
            ["Approved adjustments (debit − credit)", data.adjustments_net],
            ["Total billed", data.total_billed],
          ].map(([label, value]) => (
            <tr key={String(label)} className="border-t border-border/50">
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {formatRent(Number(value))}
              </td>
            </tr>
          ))}
        </ReportTable>
      </ReportPanel>

      <ReportPanel title="Flat payment status">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Fully paid" value={String(data.flats_fully_paid)} tone="positive" />
          <StatCard label="Partially paid" value={String(data.flats_partially_paid)} tone="warning" />
          <StatCard label="Unpaid" value={String(data.flats_unpaid)} />
          <StatCard label="Overdue" value={String(data.flats_overdue)} tone="danger" />
        </div>
      </ReportPanel>

      {canSeeDiagnostics && issues > 0 && reconQuery.data ? (
        <ReportPanel
          title="Reconciliation diagnostics"
          description={`${data.building_name} · ${formatMonth(month)} — nothing has been corrected automatically.`}
        >
          <ul className="space-y-2 text-sm">
            {reconQuery.data.record_total_mismatch.map((row) => (
              <li key={row.rent_record_id}>
                Rent record {row.rent_record_id.slice(0, 8)}: billed {formatRent(row.total_billed)}, paid{" "}
                {formatRent(row.total_paid)}, remaining {formatRent(row.remaining_due)} — totals do not reconcile.
              </li>
            ))}
            {reconQuery.data.payment_split_mismatch.map((row) => (
              <li key={row.payment_id}>
                Payment {row.payment_id.slice(0, 8)}: applied {formatRent(row.applied_amount)} + credit{" "}
                {formatRent(row.credit_amount)} ≠ verified {formatRent(row.amount_paid)}.
              </li>
            ))}
            {reconQuery.data.shared_charge_mismatch.map((row) => (
              <li key={row.shared_charge_id}>
                Shared charge {row.category}: allocated {formatRent(row.allocated_total)} vs charge{" "}
                {formatRent(row.total_amount)}.
              </li>
            ))}
            {reconQuery.data.unallocated_shared_charges.map((row) => (
              <li key={row.shared_charge_id}>
                Shared charge {row.category} ({formatRent(row.total_amount)}) has not been split among flats.
              </li>
            ))}
          </ul>
        </ReportPanel>
      ) : null}
    </div>
  );
}

/* ---------------------------------- B ---------------------------------- */

export function CashFlowView({
  buildingId,
  dateFrom,
  dateTo,
}: {
  buildingId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const query = useQuery(cashFlowQueryOptions(buildingId, dateFrom, dateTo));
  const data = query.data;

  if (query.isError) return <ReportError error={query.error} />;
  if (query.isLoading || !data) return <ReportLoading />;

  const net = data.rent_cash_received - data.approved_expenses;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Verified rent cash received" value={formatRent(data.rent_cash_received)} tone="positive" hint="Applied amount, by verification date" />
        <StatCard label="Approved expenses" value={formatRent(data.approved_expenses)} hint="By accounting month" />
        <StatCard label="Net cash movement" value={formatRent(net)} tone={net >= 0 ? "positive" : "danger"} />
        <StatCard label="Credit created" value={formatRent(data.credit_created)} hint="Overpayment held as advance · not income" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPanel title="Payment method breakdown">
          <BarList
            items={data.method_breakdown.map((row) => ({
              label: `${paymentMethodLabel[row.method]} (${row.count})`,
              value: row.applied,
            }))}
            emptyLabel="No verified payments in this range."
          />
        </ReportPanel>
        <ReportPanel title="Expense category breakdown">
          <BarList
            items={data.expense_breakdown.map((row) => ({
              label: `${expenseCategoryLabel[row.category]} (${row.count})`,
              value: row.total,
            }))}
            emptyLabel="No approved expenses in this range."
          />
        </ReportPanel>
      </div>

      <ReportPanel
        title="Monthly trend"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                `cash-flow-${data.building_name}-${dateFrom}-to-${dateTo}`,
                ["Period", "Cash received", "Approved expenses", "Net"],
                data.trend.map((row) => [
                  row.period,
                  row.received,
                  row.expenses,
                  row.received - row.expenses,
                ]),
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        <TrendBars items={data.trend} />
      </ReportPanel>
    </div>
  );
}

/* ---------------------------------- C ---------------------------------- */

export function OutstandingView({
  filters,
  onFiltersChange,
}: {
  filters: OutstandingFilters;
  onFiltersChange: (next: OutstandingFilters) => void;
}) {
  const query = useQuery(outstandingQueryOptions(filters));
  const flatsQuery = useQuery(flatsQueryOptions(filters.buildingId));
  const rows = query.data ?? [];

  const flats = flatsQuery.data ?? [];
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          billed: acc.billed + row.total_billed,
          paid: acc.paid + row.total_paid,
          due: acc.due + row.remaining_due,
        }),
        { billed: 0, paid: 0, due: 0 },
      ),
    [rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.includeSettled}
            onChange={(event) =>
              onFiltersChange({ ...filters, includeSettled: event.target.checked })
            }
          />
          Include settled records
        </label>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={filters.flatId}
          onChange={(event) => onFiltersChange({ ...filters, flatId: event.target.value })}
        >
          <option value="all">All flats</option>
          {flats.map((flat) => (
            <option key={flat.id} value={flat.id}>
              Flat {flat.flat_number}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ ...filters, status: event.target.value as OutstandingFilters["status"] })
          }
        >
          <option value="all">All statuses</option>
          {(["unpaid", "partially_paid", "paid", "overdue"] as const).map((status) => (
            <option key={status} value={status}>
              {paymentStatusLabel[status]}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={() =>
            exportCsv(
              `outstanding-rent-${filters.fromMonth}-to-${filters.toMonth}`,
              [
                "Tenant",
                "Flat",
                "Billing month",
                "Due date",
                "Total billed",
                "Total paid",
                "Remaining due",
                "Days overdue",
                "Status",
                "Last verified payment",
              ],
              rows.map((row) => [
                row.tenant_name,
                row.flat_number,
                formatMonth(row.billing_month.slice(0, 7)),
                formatDate(row.due_date),
                row.total_billed,
                row.total_paid,
                row.remaining_due,
                row.remaining_due > 0 ? row.days_overdue : 0,
                paymentStatusLabel[row.payment_status],
                row.last_verified_payment
                  ? new Date(row.last_verified_payment).toLocaleString("en-GB")
                  : "—",
              ]),
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Billed (filtered)" value={formatRent(totals.billed)} />
        <StatCard label="Paid (filtered)" value={formatRent(totals.paid)} tone="positive" />
        <StatCard label="Remaining due (filtered)" value={formatRent(totals.due)} tone="danger" />
      </div>

      {query.isError ? (
        <ReportError error={query.error} />
      ) : query.isLoading ? (
        <ReportLoading />
      ) : rows.length === 0 ? (
        <ReportEmpty>No rent records match these filters.</ReportEmpty>
      ) : (
        <section className="panel p-0">
          <ReportTable
            headers={[
              "Tenant",
              "Flat",
              "Billing month",
              "Due date",
              "Billed",
              "Paid",
              "Remaining",
              "Days overdue",
              "Status",
              "Last verified payment",
            ]}
          >
            {rows.map((row) => (
              <tr key={row.rent_record_id} className="border-t border-border/50">
                <td className="px-3 py-2">{row.tenant_name}</td>
                <td className="px-3 py-2">{row.flat_number}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatMonth(row.billing_month.slice(0, 7))}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.due_date)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.total_billed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.total_paid)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatRent(row.remaining_due)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {row.remaining_due > 0 ? row.days_overdue : 0}
                </td>
                <td className="px-3 py-2">{paymentStatusLabel[row.payment_status]}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.last_verified_payment
                    ? new Date(row.last_verified_payment).toLocaleDateString("en-GB")
                    : "—"}
                </td>
              </tr>
            ))}
          </ReportTable>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------- D ---------------------------------- */

export function CollectionView({
  buildingId,
  fromMonth,
  toMonth,
}: {
  buildingId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const query = useQuery(collectionQueryOptions(fromMonth, toMonth, buildingId));
  const rows = query.data ?? [];

  if (query.isError) return <ReportError error={query.error} />;
  if (query.isLoading) return <ReportLoading />;
  if (rows.length === 0) return <ReportEmpty>No rent records in this month range.</ReportEmpty>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCsv(
              `collection-${fromMonth}-to-${toMonth}`,
              [
                "Building",
                "Billing month",
                "Total billed",
                "Collected",
                "Outstanding",
                "Collection %",
                "Fully paid",
                "Partially paid",
                "Unpaid",
                "Overdue",
              ],
              rows.map((row) => [
                row.building_name,
                formatMonth(row.billing_month.slice(0, 7)),
                row.total_billed,
                row.collected,
                row.outstanding,
                row.collection_rate,
                row.fully_paid,
                row.partially_paid,
                row.unpaid,
                row.overdue,
              ]),
            )
          }
        >
          Export CSV
        </Button>
      </div>
      <section className="panel p-0">
        <ReportTable
          headers={[
            "Building",
            "Month",
            "Billed",
            "Collected",
            "Outstanding",
            "Collection %",
            "Fully paid",
            "Partial",
            "Unpaid",
            "Overdue",
          ]}
        >
          {rows.map((row) => (
            <tr key={`${row.building_id}-${row.billing_month}`} className="border-t border-border/50">
              <td className="px-3 py-2">{row.building_name}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatMonth(row.billing_month.slice(0, 7))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.total_billed)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.collected)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.outstanding)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPercent(row.collection_rate)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.fully_paid}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.partially_paid}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.unpaid}</td>
              <td className="px-3 py-2 text-right tabular-nums">{row.overdue}</td>
            </tr>
          ))}
        </ReportTable>
      </section>
    </div>
  );
}

/* ---------------------------------- E ---------------------------------- */

export function ExpenseReportView({
  buildingId,
  fromMonth,
  toMonth,
}: {
  buildingId: string;
  fromMonth: string;
  toMonth: string;
}) {
  const query = useQuery(expenseReportQueryOptions(fromMonth, toMonth, buildingId));
  const data = query.data;

  if (query.isError) return <ReportError error={query.error} />;
  if (query.isLoading || !data) return <ReportLoading />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approved expense total" value={formatRent(data.approved_total)} hint={`${data.approved_count} approved entries`} />
        <StatCard label="Pending (excluded)" value={formatRent(data.pending_total)} tone="warning" hint={`${data.pending_count} awaiting approval`} />
        <StatCard label="Cancelled (excluded)" value={formatRent(data.cancelled_total)} hint={`${data.cancelled_count} cancelled`} />
        <StatCard label="Rejected (excluded)" value={formatRent(data.rejected_total)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPanel title="By category">
          <BarList
            items={data.by_category.map((row) => ({
              label: `${expenseCategoryLabel[row.category]} (${row.count})`,
              value: row.total,
            }))}
          />
        </ReportPanel>
        <ReportPanel title="By vendor">
          <BarList items={data.by_vendor.map((row) => ({ label: row.vendor, value: row.total }))} />
        </ReportPanel>
        <ReportPanel title="By building">
          <BarList items={data.by_building.map((row) => ({ label: row.building, value: row.total }))} />
        </ReportPanel>
        <ReportPanel
          title="Monthly trend"
          action={
            <Button
              variant="outline"
              size="sm"
              disabled={data.trend.length === 0}
              onClick={() =>
                exportCsv(
                  `expenses-${fromMonth}-to-${toMonth}`,
                  ["Period", "Approved total"],
                  data.trend.map((row) => [row.period, row.total]),
                )
              }
            >
              Export CSV
            </Button>
          }
        >
          <BarList items={data.trend.map((row) => ({ label: row.period, value: row.total }))} />
        </ReportPanel>
      </div>
    </div>
  );
}
