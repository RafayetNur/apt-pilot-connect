import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDate, useAsyncState } from "@/lib/owner/shared";

/**
 * Owner rent records + monthly rent generation + month open/closed status.
 * Mirrors the web app's src/lib/rent.ts (rentRecordsQueryOptions,
 * generateMonthlyRent) and src/lib/closings.ts (month closure row +
 * close/reopen RPCs) query-for-query. generateMonthlyRent is the same
 * client-side orchestration the web app itself uses — reading occupied
 * flats, skipping flats already billed this month, then inserting new
 * `rent_records` rows — it does not compute totals; those come from the
 * database's rent_records triggers. Close/reopen call the same
 * `close_building_month` / `reopen_building_month` SECURITY DEFINER RPCs the
 * web app uses, which validate everything (pending payments, unallocated
 * shared charges, etc.) server-side.
 */

export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

export type OwnerRentRow = {
  id: string;
  building_id: string;
  building_name: string;
  flat_id: string;
  flat_number: string;
  tenant_name: string;
  billing_month: string;
  due_date: string;
  base_rent: number;
  total_payable: number;
  total_paid: number;
  remaining_due: number;
  payment_status: PaymentStatus;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export function useOwnerRentRecords(buildingId: string, monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<OwnerRentRow[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      let query = supabase
        .from("rent_records")
        .select(
          "id, building_id, flat_id, billing_month, due_date, base_rent, total_payable, total_paid, remaining_due, payment_status, buildings(name), flats(flat_number), profiles(full_name)",
        )
        .order("billing_month", { ascending: false });
      if (buildingId && buildingId !== "all") query = query.eq("building_id", buildingId);
      if (monthInput) query = query.eq("billing_month", monthToDate(monthInput));

      const { data, error } = await query;
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const rows: OwnerRentRow[] = (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          profiles?: { full_name: string } | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_id: row["flat_id"] as string,
          flat_number: row.flats?.flat_number ?? "—",
          tenant_name: row.profiles?.full_name ?? "—",
          billing_month: row["billing_month"] as string,
          due_date: row["due_date"] as string,
          base_rent: num(row["base_rent"]),
          total_payable: num(row["total_payable"]),
          total_paid: num(row["total_paid"]),
          remaining_due: num(row["remaining_due"]),
          payment_status: row["payment_status"] as PaymentStatus,
        };
      });
      state.setData(rows);
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId, monthInput],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { records: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export type GenerateResult = { created: number; skipped: number; eligible: number };

export async function generateMonthlyRent(params: { buildingId: string; month: string; dueDate: string }): Promise<GenerateResult> {
  const billingMonth = monthToDate(params.month);

  const { data: auth } = await supabase.auth.getUser();
  const createdBy = auth.user?.id;
  if (!createdBy) throw new Error("You must be signed in to generate rent.");

  const { data: flats, error: flatsError } = await supabase
    .from("flats")
    .select("id, building_id, monthly_rent, tenant_id, occupancy_status")
    .eq("building_id", params.buildingId)
    .eq("occupancy_status", "occupied")
    .not("tenant_id", "is", null);
  if (flatsError) throw flatsError;

  const eligible = flats ?? [];
  if (eligible.length === 0) return { created: 0, skipped: 0, eligible: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("rent_records")
    .select("flat_id")
    .eq("building_id", params.buildingId)
    .eq("billing_month", billingMonth);
  if (existingError) throw existingError;

  const alreadyBilled = new Set((existing ?? []).map((row) => row.flat_id as string));
  const toInsert = eligible
    .filter((flat) => !alreadyBilled.has(flat.id as string))
    .map((flat) => ({
      building_id: params.buildingId,
      flat_id: flat.id as string,
      tenant_id: flat.tenant_id as string,
      billing_month: billingMonth,
      base_rent: Number(flat.monthly_rent ?? 0),
      due_date: params.dueDate,
      payment_status: "unpaid" as const,
      created_by: createdBy,
    }));

  const skipped = eligible.length - toInsert.length;
  if (toInsert.length === 0) return { created: 0, skipped, eligible: eligible.length };

  const { data: inserted, error } = await supabase
    .from("rent_records")
    .upsert(toInsert, { onConflict: "flat_id,billing_month", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;

  const created = (inserted ?? []).length;
  return { created, skipped: eligible.length - created, eligible: eligible.length };
}

export type MonthClosureStatus = Database["public"]["Enums"]["month_closure_status"];

export const closureStatusLabel: Record<MonthClosureStatus, string> = {
  open: "Open",
  closed: "Closed",
  reopened: "Reopened",
};

export function useMonthClosure(buildingId: string, monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<MonthClosureStatus>("open");

  const load = useCallback(
    async () => {
      if (!session || !buildingId || buildingId === "all" || !monthInput) return;
      state.setLoading(true);
      state.setError(null);
      const { data, error } = await supabase
        .from("building_month_closures")
        .select("status")
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(monthInput))
        .maybeSingle();
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData((data?.status as MonthClosureStatus) ?? "open");
      }
      state.setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId, monthInput],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { status: state.data, loading: state.loading, error: state.error, refresh: load };
}

export async function closeBuildingMonth(buildingId: string, month: string, note: string) {
  const trimmed = note.trim();
  const { error } = await supabase.rpc("close_building_month", {
    _building_id: buildingId,
    _billing_month: monthToDate(month),
    ...(trimmed ? { _note: trimmed } : {}),
  });
  if (error) throw new Error(describeClosedMonthError(error.message));
}

export async function reopenBuildingMonth(buildingId: string, month: string, reason: string) {
  if (!reason.trim()) throw new Error("A reopening reason is required.");
  const { error } = await supabase.rpc("reopen_building_month", {
    _building_id: buildingId,
    _billing_month: monthToDate(month),
    _reason: reason.trim(),
  });
  if (error) throw new Error(describeClosedMonthError(error.message));
}

export function describeClosedMonthError(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to close or reopen this building's month.";
  }
  return message;
}
