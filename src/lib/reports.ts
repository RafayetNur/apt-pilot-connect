import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ExpenseCategory } from "@/lib/expenses";
import type { PaymentMethod } from "@/lib/payments";
import { monthToDate, type PaymentStatus } from "@/lib/rent";
import type { MonthClosureStatus } from "@/lib/closings";

/**
 * Reporting layer. Every query here calls a read-only SECURITY DEFINER
 * reporting function in the database, which validates auth.uid() and building
 * access itself. Nothing in this module writes financial data.
 */

export type ReportBuilding = { id: string; name: string; is_owner: boolean };

export const reportBuildingsQueryOptions = () =>
  queryOptions({
    queryKey: ["report-buildings"],
    queryFn: async (): Promise<ReportBuilding[]> => {
      const { data, error } = await supabase.rpc("report_accessible_buildings");
      if (error) throw error;
      return (data ?? []) as ReportBuilding[];
    },
  });

export type MonthlyStatement = {
  building_id: string;
  building_name: string;
  billing_month: string;
  month_status: MonthClosureStatus;
  closed_at: string | null;
  reopened_at: string | null;
  flats_total: number;
  flats_occupied: number;
  rent_records: number;
  base_rent: number;
  individual_charges: number;
  shared_charges: number;
  adjustments_net: number;
  total_billed: number;
  total_paid: number;
  remaining_due: number;
  collection_rate: number;
  credits_held: number;
  approved_expenses: number;
  cash_received_in_month: number;
  pending_payments: number;
  pending_adjustments: number;
  pending_expenses: number;
  flats_fully_paid: number;
  flats_partially_paid: number;
  flats_unpaid: number;
  flats_overdue: number;
};

export const monthlyStatementQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["report-monthly-statement", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<MonthlyStatement> => {
      const { data, error } = await supabase.rpc("report_monthly_statement", {
        _building_id: buildingId,
        _billing_month: monthToDate(month),
      });
      if (error) throw error;
      return data as unknown as MonthlyStatement;
    },
  });

export type CashFlowReport = {
  building_id: string;
  building_name: string;
  date_from: string;
  date_to: string;
  rent_cash_received: number;
  credit_created: number;
  gross_verified_amount: number;
  approved_expenses: number;
  method_breakdown: Array<{
    method: PaymentMethod;
    applied: number;
    credit: number;
    count: number;
  }>;
  expense_breakdown: Array<{ category: ExpenseCategory; total: number; count: number }>;
  trend: Array<{ period: string; received: number; expenses: number }>;
};

export const cashFlowQueryOptions = (buildingId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["report-cash-flow", buildingId, from, to],
    enabled: Boolean(buildingId) && Boolean(from) && Boolean(to),
    queryFn: async (): Promise<CashFlowReport> => {
      const { data, error } = await supabase.rpc("report_cash_flow", {
        _building_id: buildingId,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return data as unknown as CashFlowReport;
    },
  });

export type OutstandingRow = {
  rent_record_id: string;
  tenant_name: string;
  flat_number: string;
  billing_month: string;
  due_date: string;
  total_billed: number;
  total_paid: number;
  remaining_due: number;
  days_overdue: number;
  payment_status: PaymentStatus;
  last_verified_payment: string | null;
};

export type OutstandingFilters = {
  buildingId: string;
  fromMonth: string;
  toMonth: string;
  tenantId: string; // "all"
  flatId: string; // "all"
  status: PaymentStatus | "all";
  includeSettled: boolean;
};

export const outstandingQueryOptions = (filters: OutstandingFilters) =>
  queryOptions({
    queryKey: ["report-outstanding", filters],
    enabled: Boolean(filters.buildingId),
    queryFn: async (): Promise<OutstandingRow[]> => {
      const { data, error } = await supabase.rpc("report_outstanding", {
        _building_id: filters.buildingId,
        _from_month: monthToDate(filters.fromMonth),
        _to_month: monthToDate(filters.toMonth),
        ...(filters.tenantId === "all" ? {} : { _tenant_id: filters.tenantId }),
        ...(filters.flatId === "all" ? {} : { _flat_id: filters.flatId }),
        ...(filters.status === "all" ? {} : { _status: filters.status }),
        _include_settled: filters.includeSettled,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as unknown as OutstandingRow),
        total_billed: Number((row as Record<string, unknown>)["total_billed"] ?? 0),
        total_paid: Number((row as Record<string, unknown>)["total_paid"] ?? 0),
        remaining_due: Number((row as Record<string, unknown>)["remaining_due"] ?? 0),
      }));
    },
  });

export type CollectionRow = {
  building_id: string;
  building_name: string;
  billing_month: string;
  total_billed: number;
  collected: number;
  outstanding: number;
  collection_rate: number;
  fully_paid: number;
  partially_paid: number;
  unpaid: number;
  overdue: number;
};

export const collectionQueryOptions = (fromMonth: string, toMonth: string, buildingId: string) =>
  queryOptions({
    queryKey: ["report-collection", fromMonth, toMonth, buildingId],
    queryFn: async (): Promise<CollectionRow[]> => {
      const { data, error } = await supabase.rpc("report_collection", {
        _from_month: monthToDate(fromMonth),
        _to_month: monthToDate(toMonth),
        ...(buildingId === "all" ? {} : { _building_id: buildingId }),
      });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const raw = row as Record<string, unknown>;
        return {
          ...(row as unknown as CollectionRow),
          total_billed: Number(raw["total_billed"] ?? 0),
          collected: Number(raw["collected"] ?? 0),
          outstanding: Number(raw["outstanding"] ?? 0),
          collection_rate: Number(raw["collection_rate"] ?? 0),
        };
      });
    },
  });

export type ExpenseReport = {
  from_month: string;
  to_month: string;
  approved_total: number;
  approved_count: number;
  pending_total: number;
  pending_count: number;
  cancelled_total: number;
  cancelled_count: number;
  rejected_total: number;
  by_category: Array<{ category: ExpenseCategory; total: number; count: number }>;
  by_vendor: Array<{ vendor: string; total: number; count: number }>;
  by_building: Array<{ building: string; total: number; count: number }>;
  trend: Array<{ period: string; total: number }>;
};

export const expenseReportQueryOptions = (fromMonth: string, toMonth: string, buildingId: string) =>
  queryOptions({
    queryKey: ["report-expenses", fromMonth, toMonth, buildingId],
    queryFn: async (): Promise<ExpenseReport> => {
      const { data, error } = await supabase.rpc("report_expenses", {
        _from_month: monthToDate(fromMonth),
        _to_month: monthToDate(toMonth),
        ...(buildingId === "all" ? {} : { _building_id: buildingId }),
      });
      if (error) throw error;
      return data as unknown as ExpenseReport;
    },
  });

export type LedgerMonth = {
  rent_record_id: string;
  building_name: string;
  flat_number: string;
  billing_month: string;
  due_date: string;
  base_rent: number;
  total_billed: number;
  total_paid: number;
  remaining_due: number;
  payment_status: PaymentStatus;
  charges: Array<{
    type: string;
    amount: number;
    provider: string | null;
    description: string | null;
  }>;
  shared_allocations: Array<{ category: string; amount: number }>;
  adjustments: Array<{
    type: "debit" | "credit";
    category: string;
    amount: number;
    reason: string;
    posted_month: string;
  }>;
  payments: Array<{
    verified_at: string | null;
    amount_paid: number;
    applied_amount: number;
    credit_amount: number;
    method: PaymentMethod;
    receipt_number: string | null;
  }>;
  audit_payments: Array<{
    submitted_at: string;
    amount_paid: number;
    status: string;
    method: PaymentMethod;
  }>;
};

export type TenantLedger = {
  tenant_id: string;
  tenant_name: string;
  credit_remaining: number;
  months: LedgerMonth[];
};

export const tenantLedgerQueryOptions = (tenantId: string | null, flatId: string | null) =>
  queryOptions({
    queryKey: ["report-tenant-ledger", tenantId ?? "none", flatId ?? "all"],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<TenantLedger> => {
      const { data, error } = await supabase.rpc("report_tenant_ledger", {
        _tenant_id: tenantId!,
        ...(flatId ? { _flat_id: flatId } : {}),
      });
      if (error) throw error;
      return data as unknown as TenantLedger;
    },
  });

export type OwnerSummary = {
  from_month: string;
  to_month: string;
  buildings_count: number;
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
  approved_expenses: number;
  cash_received: number;
  net_cash: number;
  collection_rate: number;
  by_building: Array<{
    building_id: string;
    building_name: string;
    billed: number;
    collected: number;
    outstanding: number;
    received: number;
    expenses: number;
    net_cash: number;
    collection_rate: number;
  }>;
  incomplete_billing_months: Array<{
    building_id: string;
    building_name: string;
    billing_month: string;
    occupied_flats: number;
    rent_records: number;
  }>;
  closed_months_with_dues: Array<{
    building_id: string;
    building_name: string;
    billing_month: string;
    status: string;
    remaining_due: number;
  }>;
};

export const ownerSummaryQueryOptions = (fromMonth: string, toMonth: string, enabled: boolean) =>
  queryOptions({
    queryKey: ["report-owner-summary", fromMonth, toMonth],
    enabled,
    queryFn: async (): Promise<OwnerSummary> => {
      const { data, error } = await supabase.rpc("report_owner_summary", {
        _from_month: monthToDate(fromMonth),
        _to_month: monthToDate(toMonth),
      });
      if (error) throw error;
      return data as unknown as OwnerSummary;
    },
  });

export type Reconciliation = {
  billing_month: string;
  record_total_mismatch: Array<{
    rent_record_id: string;
    total_billed: number;
    total_paid: number;
    remaining_due: number;
  }>;
  payment_split_mismatch: Array<{
    payment_id: string;
    amount_paid: number;
    applied_amount: number;
    credit_amount: number;
  }>;
  shared_charge_mismatch: Array<{
    shared_charge_id: string;
    category: string;
    total_amount: number;
    allocated_total: number;
  }>;
  unallocated_shared_charges: Array<{
    shared_charge_id: string;
    category: string;
    total_amount: number;
  }>;
};

export const reconciliationQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["report-reconciliation", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<Reconciliation> => {
      const { data, error } = await supabase.rpc("report_reconciliation", {
        _building_id: buildingId,
        _billing_month: monthToDate(month),
      });
      if (error) throw error;
      return data as unknown as Reconciliation;
    },
  });

export function reconciliationIssueCount(data: Reconciliation | undefined) {
  if (!data) return 0;
  return (
    data.record_total_mismatch.length +
    data.payment_split_mismatch.length +
    data.shared_charge_mismatch.length +
    data.unallocated_shared_charges.length
  );
}

/** Collection rate helper — safe against a zero billed amount. */
export function collectionRate(billed: number, collected: number) {
  if (billed <= 0) return 0;
  return Math.round((collected / billed) * 10000) / 100;
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

/** CSV export. Never include receipt or payment-proof URLs here. */
export function exportCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
) {
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartInput(monthInput: string) {
  return `${monthInput}-01`;
}

export function monthEndInput(monthInput: string) {
  const [year, month] = monthInput.split("-").map(Number);
  if (!year || !month) return todayInput();
  const last = new Date(year, month, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(
    last.getDate(),
  ).padStart(2, "0")}`;
}

export function monthsAgoInput(count: number) {
  const now = new Date();
  now.setMonth(now.getMonth() - count);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
