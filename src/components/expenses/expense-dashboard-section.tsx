import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { DashboardSection, EmptyState, StatCard } from "@/components/dashboard/parts";
import { Badge } from "@/components/ui/badge";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { formatRent } from "@/lib/flats";
import { formatDate, formatMonth } from "@/lib/rent";
import {
  expenseCategoryLabel,
  expenseStatusLabel,
  monthExpensesQueryOptions,
  summarizeExpenses,
  totalsByBuilding,
} from "@/lib/expenses";

/**
 * Real expense figures for the selected month. Owners see approved totals and
 * pending approvals; managers see what they recorded and what needs correction.
 * Never rendered for tenants.
 */
export function ExpenseDashboardSection({ role, month }: { role: AppRole; month: string }) {
  const { user } = useAuth();
  const query = useQuery(monthExpensesQueryOptions(month));
  const rows = query.data ?? [];
  const summary = summarizeExpenses(rows);
  const perBuilding = totalsByBuilding(rows);
  const expensesPath = role === "owner" ? "/owner/expenses" : "/manager/expenses";

  const mine = rows.filter((row) => row.created_by === user?.id);
  const myPending = mine.filter((row) => row.approval_status === "pending");
  const myRejected = mine.filter((row) => row.approval_status === "rejected");

  return (
    <DashboardSection
      title="Building expenses"
      description={`${formatMonth(`${month}-01`)} · only approved expenses count in official totals.`}
      action={
        <Link
          to={expensesPath}
          className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          Open expenses
        </Link>
      }
    >
      {query.isLoading ? (
        <EmptyState>Loading expenses…</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {role === "owner" ? (
              <>
                <StatCard
                  label="Approved this month"
                  value={formatRent(summary.approvedTotal)}
                  hint={`${summary.approvedCount} entries`}
                  tone="positive"
                />
                <StatCard
                  label="Pending approvals"
                  value={String(summary.pendingCount)}
                  hint={formatRent(summary.pendingTotal)}
                  tone="warning"
                />
              </>
            ) : (
              <>
                <StatCard
                  label="Recorded this month"
                  value={formatRent(summary.approvedTotal + summary.pendingTotal)}
                  hint={`${summary.approvedCount} approved · ${summary.pendingCount} pending`}
                />
                <StatCard
                  label="My pending submissions"
                  value={String(myPending.length)}
                  hint={formatRent(myPending.reduce((sum, row) => sum + row.amount, 0))}
                  tone="warning"
                />
              </>
            )}
            <StatCard
              label="Top category"
              value={
                summary.topCategory
                  ? expenseCategoryLabel[summary.topCategory.category]
                  : "No data yet"
              }
              hint={summary.topCategory ? formatRent(summary.topCategory.total) : undefined}
            />
            {role === "owner" ? (
              <StatCard
                label="Cancelled"
                value={String(summary.cancelledCount)}
                hint={formatRent(summary.cancelledTotal)}
              />
            ) : (
              <StatCard
                label="Rejected needing correction"
                value={String(myRejected.length)}
                tone={myRejected.length > 0 ? "danger" : "default"}
              />
            )}
          </div>

          {role === "owner" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Top expense categories</h3>
                {summary.byCategory.length === 0 ? (
                  <EmptyState>No approved expenses for this month yet.</EmptyState>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {summary.byCategory.slice(0, 5).map((item) => (
                      <li
                        key={item.category}
                        className="flex justify-between rounded-lg bg-surface px-3 py-2"
                      >
                        <span>{expenseCategoryLabel[item.category]}</span>
                        <span className="font-medium">{formatRent(item.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold">Approved total by building</h3>
                {perBuilding.length === 0 ? (
                  <EmptyState>No approved expenses for this month yet.</EmptyState>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {perBuilding.map((item) => (
                      <li
                        key={item.buildingId}
                        className="flex justify-between rounded-lg bg-surface px-3 py-2"
                      >
                        <span>{item.buildingName}</span>
                        <span className="font-medium">{formatRent(item.approvedTotal)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold">My submissions this month</h3>
              {mine.length === 0 ? (
                <EmptyState>You have not recorded any expenses for this month.</EmptyState>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {mine.slice(0, 6).map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                    >
                      <span>
                        {formatDate(row.expense_date)} · {row.building_name} ·{" "}
                        {expenseCategoryLabel[row.category]}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{formatRent(row.amount)}</span>
                        <Badge
                          variant={row.approval_status === "approved" ? "default" : "secondary"}
                        >
                          {expenseStatusLabel[row.approval_status]}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </DashboardSection>
  );
}
