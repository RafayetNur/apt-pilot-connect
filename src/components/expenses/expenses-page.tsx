import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ExpenseDetailDialog } from "@/components/expenses/expense-detail-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { StatCard } from "@/components/dashboard/parts";
import { Badge } from "@/components/ui/badge";
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
import { buildingsQueryOptions } from "@/lib/buildings";
import { formatRent } from "@/lib/flats";
import { currentMonthInput, formatDate, formatMonth } from "@/lib/rent";
import {
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseMethodLabel,
  expensesQueryOptions,
  expenseStatusLabel,
  summarizeExpenses,
  type BuildingExpense,
  type ExpenseApprovalStatus,
  type ExpenseCategory,
  type ExpenseFilters,
} from "@/lib/expenses";

const statusOptions: ExpenseApprovalStatus[] = ["pending", "approved", "rejected", "cancelled"];

export function ExpensesPage({ role }: { role: AppRole }) {
  const { user } = useAuth();
  const [buildingId, setBuildingId] = useState("all");
  const [month, setMonth] = useState(currentMonthInput());
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [status, setStatus] = useState<ExpenseApprovalStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingExpense | null>(null);
  const [replacing, setReplacing] = useState<BuildingExpense | null>(null);
  const [selected, setSelected] = useState<BuildingExpense | null>(null);

  const buildingsQuery = useQuery(buildingsQueryOptions());
  const buildings = buildingsQuery.data ?? [];

  const filters: ExpenseFilters = useMemo(
    () => ({ buildingId, month, category, status, dateFrom, dateTo, search }),
    [buildingId, month, category, status, dateFrom, dateTo, search],
  );

  const expensesQuery = useQuery(expensesQueryOptions(filters));
  const rows = expensesQuery.data ?? [];
  const summary = useMemo(() => summarizeExpenses(rows), [rows]);

  // Keep the selected row in sync with refreshed data.
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find((row) => row.id === selected.id);
    if (fresh && fresh.updated_at !== selected.updated_at) setSelected(fresh);
  }, [rows, selected]);

  const openCreate = () => {
    setEditing(null);
    setReplacing(null);
    setFormOpen(true);
  };

  const defaultBuildingId = buildingId !== "all" ? buildingId : (buildings[0]?.id ?? "");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Building expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record what the building actually spent. Expenses are accounting records only — they
            never change tenant bills or shared charges.
          </p>
        </div>
        <Button onClick={openCreate} disabled={buildings.length === 0}>
          Add expense
        </Button>
      </header>

      <section className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="expense-filter-building">Building</Label>
          <Select value={buildingId} onValueChange={setBuildingId}>
            <SelectTrigger id="expense-filter-building">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buildings</SelectItem>
              {buildings.map((building) => (
                <SelectItem key={building.id} value={building.id}>
                  {building.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-filter-month">Accounting month</Label>
          <Input
            id="expense-filter-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-filter-category">Category</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as ExpenseCategory | "all")}
          >
            <SelectTrigger id="expense-filter-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {expenseCategoryOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {expenseCategoryLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-filter-status">Approval status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as ExpenseApprovalStatus | "all")}
          >
            <SelectTrigger id="expense-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {expenseStatusLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-filter-from">Expense date from</Label>
          <Input
            id="expense-filter-from"
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-filter-to">Expense date to</Label>
          <Input
            id="expense-filter-to"
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="expense-filter-search">Search description, vendor or reference</Label>
          <Input
            id="expense-filter-search"
            value={search}
            placeholder="e.g. guard salary, Sunrise Traders, TRX123"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Approved expenses"
          value={formatRent(summary.approvedTotal)}
          hint="Official expense total"
          tone="positive"
        />
        <StatCard
          label="Pending expenses"
          value={formatRent(summary.pendingTotal)}
          hint={`${summary.pendingCount} awaiting approval (not counted)`}
          tone="warning"
        />
        <StatCard
          label="Cancelled expenses"
          value={formatRent(summary.cancelledTotal)}
          hint={`${summary.cancelledCount} cancelled · kept in history`}
        />
        <StatCard
          label="Largest category"
          value={
            summary.topCategory ? expenseCategoryLabel[summary.topCategory.category] : "No data yet"
          }
          hint={summary.topCategory ? formatRent(summary.topCategory.total) : undefined}
        />
        <StatCard label="Approved entries" value={String(summary.approvedCount)} />
      </section>

      <section className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Posted month</th>
              <th className="px-3 py-3">Related month</th>
              <th className="px-3 py-3">Building</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3">Description</th>
              <th className="px-3 py-3">Vendor</th>
              <th className="px-3 py-3 text-right">Amount</th>
              <th className="px-3 py-3">Method</th>
              <th className="px-3 py-3">Reference</th>
              <th className="px-3 py-3">Creator</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Reviewer</th>
              <th className="px-3 py-3">Receipt</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expensesQuery.isLoading ? (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                  Loading expenses…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-3 py-6 text-center text-muted-foreground">
                  No expenses match these filters yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border/50">
                  <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.expense_date)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatMonth(row.accounting_month)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {row.related_month ? formatMonth(row.related_month) : "—"}
                  </td>
                  <td className="px-3 py-3">{row.building_name}</td>
                  <td className="px-3 py-3">{expenseCategoryLabel[row.category]}</td>
                  <td className="max-w-[16rem] px-3 py-3">{row.description}</td>
                  <td className="px-3 py-3">{row.vendor_name ?? "—"}</td>
                  <td className="px-3 py-3 text-right font-medium">{formatRent(row.amount)}</td>
                  <td className="px-3 py-3">{expenseMethodLabel[row.payment_method]}</td>
                  <td className="px-3 py-3">{row.transaction_reference ?? "—"}</td>
                  <td className="px-3 py-3">{row.creator_name}</td>
                  <td className="px-3 py-3">
                    <Badge variant={row.approval_status === "approved" ? "default" : "secondary"}>
                      {expenseStatusLabel[row.approval_status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{row.reviewer_name ?? "—"}</td>
                  <td className="px-3 py-3">{row.receipt_document_url ? "Attached" : "—"}</td>
                  <td className="px-3 py-3">
                    <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setReplacing(null);
          }
        }}
        role={role}
        buildings={buildings}
        defaultBuildingId={defaultBuildingId}
        defaultMonth={month}
        expense={editing}
        replacesExpense={replacing}
      />

      <ExpenseDetailDialog
        expense={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        role={role}
        currentUserId={user?.id}
        onEdit={(expense) => {
          setSelected(null);
          setReplacing(null);
          setEditing(expense);
          setFormOpen(true);
        }}
        onReplace={(expense) => {
          setSelected(null);
          setEditing(null);
          setReplacing(expense);
          setFormOpen(true);
        }}
      />
    </div>
  );
}
