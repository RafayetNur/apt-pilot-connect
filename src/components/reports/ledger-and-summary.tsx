import { useQuery } from "@tanstack/react-query";

import { StatCard } from "@/components/dashboard/parts";
import {
  ReportEmpty,
  ReportError,
  ReportLoading,
  ReportPanel,
  ReportTable,
} from "@/components/reports/parts";
import { Button } from "@/components/ui/button";
import { formatRent } from "@/lib/flats";
import { paymentMethodLabel } from "@/lib/payments";
import { formatDate, formatMonth, paymentStatusLabel } from "@/lib/rent";
import {
  exportCsv,
  formatPercent,
  ownerSummaryQueryOptions,
  tenantLedgerQueryOptions,
} from "@/lib/reports";

/* ---------------------------------- F ---------------------------------- */

export function TenantLedgerView({
  tenantId,
  flatId,
}: {
  tenantId: string | null;
  flatId: string | null;
}) {
  const query = useQuery(tenantLedgerQueryOptions(tenantId, flatId));
  const data = query.data;

  if (!tenantId) return <ReportEmpty>Select a tenant to build their ledger.</ReportEmpty>;
  if (query.isError) return <ReportError error={query.error} />;
  if (query.isLoading || !data) return <ReportLoading />;
  if (data.months.length === 0)
    return <ReportEmpty>No bills exist for this tenant yet.</ReportEmpty>;

  let runningBalance = 0;
  const rows = data.months.map((month) => {
    const verifiedApplied = month.payments.reduce((acc, p) => acc + p.applied_amount, 0);
    runningBalance += month.total_billed - verifiedApplied;
    return { month, verifiedApplied, balance: runningBalance };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tenant" value={data.tenant_name} />
        <StatCard label="Credit remaining" value={formatRent(data.credit_remaining)} hint="Advance held · not income until applied" />
        <StatCard
          label="Running bill balance"
          value={formatRent(runningBalance)}
          tone={runningBalance > 0 ? "danger" : "positive"}
        />
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCsv(
              `tenant-ledger-${data.tenant_name.replace(/\s+/g, "-")}`,
              [
                "Billing month",
                "Building",
                "Flat",
                "Due date",
                "Base rent",
                "Total billed",
                "Verified applied",
                "Credit created",
                "Remaining due",
                "Running balance",
                "Receipt numbers",
              ],
              rows.map(({ month, verifiedApplied, balance }) => [
                formatMonth(month.billing_month.slice(0, 7)),
                month.building_name,
                month.flat_number,
                formatDate(month.due_date),
                month.base_rent,
                month.total_billed,
                verifiedApplied,
                month.payments.reduce((acc, p) => acc + p.credit_amount, 0),
                month.remaining_due,
                balance,
                month.payments
                  .map((p) => p.receipt_number)
                  .filter(Boolean)
                  .join(" / "),
              ]),
            )
          }
        >
          Export CSV
        </Button>
      </div>

      {rows.map(({ month, verifiedApplied, balance }) => (
        <ReportPanel
          key={month.rent_record_id}
          title={`${formatMonth(month.billing_month.slice(0, 7))} · Flat ${month.flat_number}`}
          description={`${month.building_name} · due ${formatDate(month.due_date)} · ${
            paymentStatusLabel[month.payment_status]
          }`}
        >
          <ReportTable headers={["Line", "Detail", "Amount"]} minWidth="min-w-[560px]">
            <tr className="border-t border-border/50">
              <td className="px-3 py-2">Base rent</td>
              <td className="px-3 py-2 text-muted-foreground">Monthly rent snapshot</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(month.base_rent)}</td>
            </tr>
            {month.charges.map((charge, index) => (
              <tr key={`c-${index}`} className="border-t border-border/50">
                <td className="px-3 py-2">Individual charge</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {charge.type}
                  {charge.provider ? ` · ${charge.provider}` : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(charge.amount)}</td>
              </tr>
            ))}
            {month.shared_allocations.map((alloc, index) => (
              <tr key={`s-${index}`} className="border-t border-border/50">
                <td className="px-3 py-2">Shared charge</td>
                <td className="px-3 py-2 text-muted-foreground">{alloc.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(alloc.amount)}</td>
              </tr>
            ))}
            {month.adjustments.map((adj, index) => (
              <tr key={`a-${index}`} className="border-t border-border/50">
                <td className="px-3 py-2">
                  {adj.type === "debit" ? "Debit adjustment" : "Credit adjustment"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{adj.reason}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {adj.type === "debit" ? "" : "− "}
                  {formatRent(adj.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border/50 bg-surface font-medium">
              <td className="px-3 py-2">Total billed</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(month.total_billed)}</td>
            </tr>
            {month.payments.map((payment, index) => (
              <tr key={`p-${index}`} className="border-t border-border/50">
                <td className="px-3 py-2">Verified payment</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {paymentMethodLabel[payment.method]}
                  {payment.verified_at
                    ? ` · ${new Date(payment.verified_at).toLocaleDateString("en-GB")}`
                    : ""}
                  {payment.receipt_number ? ` · ${payment.receipt_number}` : ""}
                  {payment.credit_amount > 0
                    ? ` · credit created ${formatRent(payment.credit_amount)}`
                    : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  − {formatRent(payment.applied_amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border/50 bg-surface font-medium">
              <td className="px-3 py-2">Applied this month</td>
              <td className="px-3 py-2 text-muted-foreground">Remaining due {formatRent(month.remaining_due)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(verifiedApplied)}</td>
            </tr>
            <tr className="border-t border-border/50 font-medium">
              <td className="px-3 py-2">Running bill balance</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">{formatRent(balance)}</td>
            </tr>
          </ReportTable>

          {month.audit_payments.length > 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Audit only — excluded from the balance</p>
              <ul className="mt-1 space-y-1">
                {month.audit_payments.map((p, index) => (
                  <li key={`ap-${index}`}>
                    {new Date(p.submitted_at).toLocaleDateString("en-GB")} ·{" "}
                    {paymentMethodLabel[p.method]} · {formatRent(p.amount_paid)} · {p.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </ReportPanel>
      ))}
    </div>
  );
}

/* --------------------------- Owner-wide summary --------------------------- */

export function OwnerSummaryView({
  fromMonth,
  toMonth,
  enabled,
}: {
  fromMonth: string;
  toMonth: string;
  enabled: boolean;
}) {
  const query = useQuery(ownerSummaryQueryOptions(fromMonth, toMonth, enabled));
  const data = query.data;

  if (!enabled)
    return <ReportEmpty>The multi-building summary is available to owners only.</ReportEmpty>;
  if (query.isError) return <ReportError error={query.error} />;
  if (query.isLoading || !data) return <ReportLoading />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total billed" value={formatRent(data.total_billed)} />
        <StatCard label="Total collected" value={formatRent(data.total_collected)} tone="positive" />
        <StatCard label="Total outstanding" value={formatRent(data.total_outstanding)} tone="danger" />
        <StatCard label="Collection rate" value={formatPercent(data.collection_rate)} />
        <StatCard label="Approved expenses" value={formatRent(data.approved_expenses)} />
        <StatCard label="Cash received" value={formatRent(data.cash_received)} hint="Verified applied, by verification date" />
        <StatCard
          label="Net cash movement"
          value={formatRent(data.net_cash)}
          tone={data.net_cash >= 0 ? "positive" : "danger"}
        />
        <StatCard label="Buildings" value={String(data.buildings_count)} />
      </div>

      <ReportPanel
        title="Comparison by building"
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={data.by_building.length === 0}
            onClick={() =>
              exportCsv(
                `owner-summary-${fromMonth}-to-${toMonth}`,
                [
                  "Building",
                  "Billed",
                  "Collected",
                  "Outstanding",
                  "Cash received",
                  "Approved expenses",
                  "Net cash",
                  "Collection %",
                ],
                data.by_building.map((row) => [
                  row.building_name,
                  row.billed,
                  row.collected,
                  row.outstanding,
                  row.received,
                  row.expenses,
                  row.net_cash,
                  row.collection_rate,
                ]),
              )
            }
          >
            Export CSV
          </Button>
        }
      >
        {data.by_building.length === 0 ? (
          <ReportEmpty>No buildings yet.</ReportEmpty>
        ) : (
          <ReportTable
            headers={[
              "Building",
              "Billed",
              "Collected",
              "Outstanding",
              "Cash received",
              "Expenses",
              "Net cash",
              "Collection %",
            ]}
          >
            {data.by_building.map((row) => (
              <tr key={row.building_id} className="border-t border-border/50">
                <td className="px-3 py-2">{row.building_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.billed)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.collected)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.outstanding)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.received)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.expenses)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRent(row.net_cash)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatPercent(row.collection_rate)}
                </td>
              </tr>
            ))}
          </ReportTable>
        )}
      </ReportPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportPanel title="Months with incomplete billing">
          {data.incomplete_billing_months.length === 0 ? (
            <ReportEmpty>Every month in range has rent records for all occupied flats.</ReportEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.incomplete_billing_months.map((row) => (
                <li key={`${row.building_id}-${row.billing_month}`}>
                  {row.building_name} · {formatMonth(row.billing_month.slice(0, 7))} —{" "}
                  {row.rent_records} of {row.occupied_flats} occupied flats billed
                </li>
              ))}
            </ul>
          )}
        </ReportPanel>
        <ReportPanel title="Closed months with remaining dues">
          {data.closed_months_with_dues.length === 0 ? (
            <ReportEmpty>No closed month carries an unpaid balance.</ReportEmpty>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.closed_months_with_dues.map((row) => (
                <li key={`${row.building_id}-${row.billing_month}`}>
                  {row.building_name} · {formatMonth(row.billing_month.slice(0, 7))} —{" "}
                  {formatRent(row.remaining_due)} still due
                </li>
              ))}
            </ul>
          )}
        </ReportPanel>
      </div>
    </div>
  );
}
