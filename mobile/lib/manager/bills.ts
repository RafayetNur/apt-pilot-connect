import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDate, useAsyncState } from "@/lib/manager/shared";

/**
 * Flat bill entry + shared building charges. Mirrors the web app's
 * src/lib/charges.ts: same tables (`flat_bill_charges`,
 * `shared_building_charges`, `shared_charge_allocations`), same
 * `allocate_shared_charge` RPC for splitting, same "locked" rule (a flat's
 * charges cannot change once a payment is pending or verified for that
 * month) and the same charges_locked_by_payment / unique-type-per-record
 * constraint names surfaced as friendly errors.
 */

export type FlatChargeType = Database["public"]["Enums"]["flat_charge_type"];
export const bulkChargeTypes: FlatChargeType[] = ["electricity", "gas", "water", "internet", "other"];
export const flatChargeLabel: Record<FlatChargeType, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  internet: "Internet",
  flat_repair: "Flat repair",
  other: "Other",
};

export type SharedChargeCategory = Database["public"]["Enums"]["shared_charge_category"];
export const sharedCategoryLabel: Record<SharedChargeCategory, string> = {
  guard_salary: "Guard salary",
  cleaner_salary: "Cleaner salary",
  generator: "Generator",
  lift_maintenance: "Lift maintenance",
  common_electricity: "Common electricity",
  water_pump: "Water pump",
  waste_management: "Waste management",
  cctv_internet: "CCTV / internet",
  other: "Other",
};
export const sharedCategoryOptions = Object.keys(sharedCategoryLabel) as SharedChargeCategory[];

export type BillEntryRow = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  billingMonth: string;
  flatNumber: string;
  tenantName: string;
  baseRent: number;
  totalPayable: number;
  locked: boolean;
  lockReason: string;
  amounts: Partial<Record<FlatChargeType, number>>;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export function friendlyChargeError(message: string): Error {
  if (message.includes("charges_locked_by_payment")) {
    return new Error("These charges are locked because a payment for this month is already pending or verified.");
  }
  if (message.includes("flat_bill_charges_unique_type_per_record")) {
    return new Error("This charge type is already recorded for that flat and month.");
  }
  if (message.includes("month_closed")) {
    return new Error("This billing month is closed. Ask the owner to reopen it before changing charges.");
  }
  return new Error(message);
}

export function useBillEntryRows(buildingId: string, monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<BillEntryRow[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !buildingId || !monthInput) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase
        .from("rent_records")
        .select(
          "id, building_id, flat_id, tenant_id, billing_month, base_rent, total_payable, flats(flat_number), profiles(full_name), flat_bill_charges(charge_type, amount), rent_payments!rent_payments_rent_record_id_fkey(verification_status)",
        )
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(monthInput));

      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const rows: BillEntryRow[] = (data ?? [])
        .map((raw) => {
          const row = raw as Record<string, unknown> & {
            flats?: { flat_number: string } | null;
            profiles?: { full_name: string } | null;
            flat_bill_charges?: { charge_type: FlatChargeType; amount: number }[] | null;
            rent_payments?: { verification_status: string }[] | null;
          };
          const amounts: Partial<Record<FlatChargeType, number>> = {};
          for (const charge of row.flat_bill_charges ?? []) {
            amounts[charge.charge_type] = num(charge.amount);
          }
          const locked = (row.rent_payments ?? []).some(
            (p) => p.verification_status === "pending" || p.verification_status === "verified",
          );
          return {
            rentRecordId: row["id"] as string,
            buildingId: row["building_id"] as string,
            flatId: row["flat_id"] as string,
            tenantId: row["tenant_id"] as string,
            billingMonth: row["billing_month"] as string,
            flatNumber: row.flats?.flat_number ?? "—",
            tenantName: row.profiles?.full_name ?? "—",
            baseRent: num(row["base_rent"]),
            totalPayable: num(row["total_payable"]),
            locked,
            lockReason: locked
              ? "A payment for this month is pending or verified, so charges can no longer be changed."
              : "",
            amounts,
          };
        })
        .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }));

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

  return { rows: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

/** Saves one flat's charge amounts. Empty/blank string clears that charge type. */
export async function saveFlatCharges(row: BillEntryRow, amounts: Partial<Record<FlatChargeType, string>>) {
  const { data: auth } = await supabase.auth.getUser();
  const enteredBy = auth.user?.id;
  if (!enteredBy) throw new Error("You must be signed in to enter bills.");

  const upserts: {
    rent_record_id: string;
    building_id: string;
    flat_id: string;
    tenant_id: string;
    billing_month: string;
    charge_type: FlatChargeType;
    amount: number;
    entered_by: string;
  }[] = [];
  const clears: FlatChargeType[] = [];

  for (const type of bulkChargeTypes) {
    const raw = (amounts[type] ?? "").trim();
    if (raw === "") {
      clears.push(type);
      continue;
    }
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Enter a valid amount for ${flatChargeLabel[type]}.`);
    }
    upserts.push({
      rent_record_id: row.rentRecordId,
      building_id: row.buildingId,
      flat_id: row.flatId,
      tenant_id: row.tenantId,
      billing_month: row.billingMonth,
      charge_type: type,
      amount,
      entered_by: enteredBy,
    });
  }

  for (const chargeType of clears) {
    const { error } = await supabase
      .from("flat_bill_charges")
      .delete()
      .eq("rent_record_id", row.rentRecordId)
      .eq("charge_type", chargeType);
    if (error) throw friendlyChargeError(error.message);
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("flat_bill_charges")
      .upsert(upserts, { onConflict: "rent_record_id,charge_type" });
    if (error) throw friendlyChargeError(error.message);
  }
}

export type SharedChargeAllocation = { id: string; allocated_amount: number; flat_number: string };
export type SharedCharge = {
  id: string;
  category: SharedChargeCategory;
  total_amount: number;
  description: string | null;
  created_at: string;
  allocations: SharedChargeAllocation[];
};

export function useSharedCharges(buildingId: string, monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<SharedCharge[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !buildingId || !monthInput) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase
        .from("shared_building_charges")
        .select("id, category, total_amount, description, created_at, shared_charge_allocations(id, allocated_amount, flats(flat_number))")
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(monthInput))
        .order("created_at", { ascending: false });

      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const rows: SharedCharge[] = (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          shared_charge_allocations?: (Record<string, unknown> & { flats?: { flat_number: string } | null })[] | null;
        };
        return {
          id: row["id"] as string,
          category: row["category"] as SharedChargeCategory,
          total_amount: num(row["total_amount"]),
          description: (row["description"] as string | null) ?? null,
          created_at: row["created_at"] as string,
          allocations: (row.shared_charge_allocations ?? []).map((allocation) => ({
            id: allocation["id"] as string,
            allocated_amount: num(allocation["allocated_amount"]),
            flat_number: allocation.flats?.flat_number ?? "—",
          })),
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

  return { charges: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export async function createSharedCharge(input: {
  buildingId: string;
  monthInput: string;
  category: SharedChargeCategory;
  totalAmount: number;
  description: string;
}) {
  if (!(input.totalAmount > 0)) throw new Error("Total shared amount must be greater than zero.");

  const { data: auth } = await supabase.auth.getUser();
  const createdBy = auth.user?.id;
  if (!createdBy) throw new Error("You must be signed in to add a shared charge.");

  const { data, error } = await supabase
    .from("shared_building_charges")
    .insert({
      building_id: input.buildingId,
      billing_month: monthToDate(input.monthInput),
      category: input.category,
      total_amount: input.totalAmount,
      description: input.description.trim() || null,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw friendlyChargeError(error.message);

  const chargeId = (data as { id: string }).id;
  const { error: allocationError } = await supabase.rpc("allocate_shared_charge", { _shared_charge_id: chargeId });
  if (allocationError) {
    // Nothing was split, so do not leave an unallocated charge behind.
    await supabase.from("shared_building_charges").delete().eq("id", chargeId);
    throw friendlyChargeError(allocationError.message);
  }
}

/** Whether this building+month is closed for editing (checked before letting
 * a manager enter bills or shared charges — only the owner can close/reopen). */
export async function isMonthClosed(buildingId: string, monthInput: string) {
  const { data, error } = await supabase.rpc("is_month_closed", {
    _building_id: buildingId,
    _billing_month: monthToDate(monthInput),
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
