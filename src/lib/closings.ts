import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { monthToDate } from "@/lib/rent";

export type MonthClosureStatus = "open" | "closed" | "reopened";

export const closureStatusLabel: Record<MonthClosureStatus, string> = {
  open: "Open",
  closed: "Closed",
  reopened: "Reopened",
};

export type MonthClosure = {
  id: string;
  building_id: string;
  billing_month: string;
  status: MonthClosureStatus;
  closed_by: string | null;
  closed_at: string | null;
  closing_note: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  reopening_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ClosureEvent = {
  id: string;
  closure_id: string;
  building_id: string;
  billing_month: string;
  action: "closed" | "reopened";
  performed_by: string;
  reason_or_note: string | null;
  created_at: string;
  performer_name: string;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

/** Closure row for one building + month ("open" when no row exists yet). */
export const monthClosureQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["month-closure", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<MonthClosure | null> => {
      const { data, error } = await supabase
        .from("building_month_closures")
        .select("*")
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month))
        .maybeSingle();
      if (error) throw error;
      return (data as MonthClosure | null) ?? null;
    },
  });

/** All closures visible to the signed-in user (owner/manager buildings, tenant months). */
export const closuresQueryOptions = () =>
  queryOptions({
    queryKey: ["month-closures"],
    queryFn: async (): Promise<MonthClosure[]> => {
      const { data, error } = await supabase
        .from("building_month_closures")
        .select("*")
        .order("billing_month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthClosure[];
    },
  });

export const closureEventsQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["month-closure-events", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<ClosureEvent[]> => {
      const { data, error } = await supabase
        .from("building_month_closure_events")
        .select("*, performer:profiles!building_month_closure_events_performed_by_fkey(full_name)")
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          performer?: { full_name: string } | null;
        };
        return {
          ...(row as unknown as ClosureEvent),
          performer_name: row.performer?.full_name ?? "—",
        };
      });
    },
  });

export type ClosingChecklist = {
  rentRecordCount: number;
  totalPayable: number;
  verifiedPaid: number;
  remainingDue: number;
  overdue: number;
  pendingPayments: number;
  pendingAdjustments: number;
  flatsWithoutRent: number;
  flatsMissingBills: number;
  unallocatedSharedCharges: number;
  inconsistentRecords: number;
  blockers: string[];
};

/** Read-only preview of everything checked before a month can be closed. */
export const closingChecklistQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["closing-checklist", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<ClosingChecklist> => {
      const billingMonth = monthToDate(month);

      const [recordsRes, flatsRes, paymentsRes, adjustmentsRes, sharedRes, chargesRes] =
        await Promise.all([
          supabase
            .from("rent_records")
            .select(
              "id, flat_id, base_rent, individual_charges_total, shared_charges_total, adjustment_total, total_payable, total_paid, remaining_due, due_date",
            )
            .eq("building_id", buildingId)
            .eq("billing_month", billingMonth),
          supabase
            .from("flats")
            .select("id, occupancy_status, tenant_id")
            .eq("building_id", buildingId),
          supabase
            .from("rent_payments")
            .select("id, verification_status, rent_record_id")
            .eq("building_id", buildingId)
            .eq("verification_status", "pending"),
          supabase
            .from("bill_adjustments")
            .select("id")
            .eq("building_id", buildingId)
            .eq("posted_billing_month", billingMonth)
            .eq("approval_status", "pending"),
          supabase
            .from("shared_building_charges")
            .select("id, shared_charge_allocations(id)")
            .eq("building_id", buildingId)
            .eq("billing_month", billingMonth),
          supabase
            .from("flat_bill_charges")
            .select("rent_record_id")
            .eq("building_id", buildingId)
            .eq("billing_month", billingMonth),
        ]);

      for (const res of [
        recordsRes,
        flatsRes,
        paymentsRes,
        adjustmentsRes,
        sharedRes,
        chargesRes,
      ]) {
        if (res.error) throw res.error;
      }

      const records = (recordsRes.data ?? []) as Array<Record<string, unknown>>;
      const recordIds = new Set(records.map((row) => row["id"] as string));
      const flats = (flatsRes.data ?? []) as Array<Record<string, unknown>>;
      const today = new Date().toISOString().slice(0, 10);

      const billedFlatIds = new Set(records.map((row) => row["flat_id"] as string));
      const occupiedFlats = flats.filter(
        (flat) => flat["occupancy_status"] === "occupied" && flat["tenant_id"],
      );

      const chargeRecordIds = new Set(
        (chargesRes.data ?? []).map((row) => (row as Record<string, unknown>)["rent_record_id"]),
      );

      const unallocatedSharedCharges = (sharedRes.data ?? []).filter((raw) => {
        const row = raw as Record<string, unknown> & {
          shared_charge_allocations?: Array<{ id: string }> | null;
        };
        return (row.shared_charge_allocations ?? []).length === 0;
      }).length;

      const pendingPayments = (paymentsRes.data ?? []).filter((row) =>
        recordIds.has((row as Record<string, unknown>)["rent_record_id"] as string),
      ).length;
      const pendingAdjustments = (adjustmentsRes.data ?? []).length;

      const flatsWithoutRent = occupiedFlats.filter(
        (flat) => !billedFlatIds.has(flat["id"] as string),
      ).length;

      const flatsMissingBills = records.filter(
        (row) => !chargeRecordIds.has(row["id"] as string),
      ).length;

      const inconsistentRecords = records.filter((row) => {
        const expectedPayable = Math.max(
          num(row["base_rent"]) +
            num(row["individual_charges_total"]) +
            num(row["shared_charges_total"]) +
            num(row["adjustment_total"]),
          0,
        );
        const expectedRemaining = Math.max(expectedPayable - num(row["total_paid"]), 0);
        return (
          Math.abs(num(row["total_payable"]) - expectedPayable) > 0.009 ||
          Math.abs(num(row["remaining_due"]) - expectedRemaining) > 0.009
        );
      }).length;

      const blockers: string[] = [];
      if (pendingPayments > 0)
        blockers.push(`${pendingPayments} pending payment submission(s) must be reviewed first.`);
      if (pendingAdjustments > 0)
        blockers.push(`${pendingAdjustments} bill adjustment(s) are still awaiting approval.`);
      if (unallocatedSharedCharges > 0)
        blockers.push(`${unallocatedSharedCharges} shared charge(s) are not split among the flats.`);
      if (flatsWithoutRent > 0)
        blockers.push(`${flatsWithoutRent} occupied flat(s) have no rent record for this month.`);
      if (inconsistentRecords > 0)
        blockers.push(`${inconsistentRecords} rent record(s) have inconsistent totals.`);

      return {
        rentRecordCount: records.length,
        totalPayable: records.reduce((sum, row) => sum + num(row["total_payable"]), 0),
        verifiedPaid: records.reduce((sum, row) => sum + num(row["total_paid"]), 0),
        remainingDue: records.reduce((sum, row) => sum + num(row["remaining_due"]), 0),
        overdue: records
          .filter(
            (row) => num(row["remaining_due"]) > 0 && (row["due_date"] as string) < today,
          )
          .reduce((sum, row) => sum + num(row["remaining_due"]), 0),
        pendingPayments,
        pendingAdjustments,
        flatsWithoutRent,
        flatsMissingBills,
        unallocatedSharedCharges,
        inconsistentRecords,
        blockers,
      };
    },
  });

export async function closeBuildingMonth(buildingId: string, month: string, note: string) {
  const trimmed = note.trim();
  const { error } = await supabase.rpc("close_building_month", {
    _building_id: buildingId,
    _billing_month: monthToDate(month),
    ...(trimmed ? { _note: trimmed } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function reopenBuildingMonth(buildingId: string, month: string, reason: string) {
  if (!reason.trim()) throw new Error("A reopening reason is required.");
  const { error } = await supabase.rpc("reopen_building_month", {
    _building_id: buildingId,
    _billing_month: monthToDate(month),
    _reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
}

/** Friendly message for the database-side closed-month guard. */
export function describeClosedMonthError(message: string) {
  if (!message.includes("month_closed")) return message;
  return "This billing month is closed. Reopen the month, or post a bill adjustment to the next open month instead.";
}
