import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { monthToDate } from "@/lib/rent";

export type FlatChargeType = "electricity" | "gas" | "water" | "internet" | "flat_repair" | "other";

export const flatChargeLabel: Record<FlatChargeType, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  internet: "Internet",
  flat_repair: "Flat repair",
  other: "Other",
};

/** Columns shown in the bulk-entry table. */
export const bulkChargeTypes: FlatChargeType[] = [
  "electricity",
  "gas",
  "water",
  "internet",
  "other",
];

export type SharedChargeCategory =
  | "guard_salary"
  | "cleaner_salary"
  | "generator"
  | "lift_maintenance"
  | "common_electricity"
  | "water_pump"
  | "waste_management"
  | "cctv_internet"
  | "other";

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

export type FlatBillCharge = {
  id: string;
  rent_record_id: string;
  building_id: string;
  flat_id: string;
  tenant_id: string;
  billing_month: string;
  charge_type: FlatChargeType;
  amount: number;
  provider_name: string | null;
  bill_reference: string | null;
  description: string | null;
  entered_by: string;
  created_at: string;
  updated_at: string;
};

export type BillEntryRow = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  billingMonth: string;
  flatNumber: string;
  tenantName: string;
  baseRent: number;
  individualTotal: number;
  sharedTotal: number;
  totalPayable: number;
  locked: boolean;
  lockReason: string;
  amounts: Partial<Record<FlatChargeType, number>>;
  notes: string;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export function friendlyChargeError(message: string): Error {
  if (message.includes("charges_locked_by_payment")) {
    return new Error(
      "These charges are locked because a payment for this month is already pending or verified.",
    );
  }
  if (message.includes("flat_bill_charges_unique_type_per_record")) {
    return new Error("This charge type is already recorded for that flat and month.");
  }
  return new Error(message);
}

type RawBillRecord = Record<string, unknown> & {
  flats?: { flat_number: string } | null;
  profiles?: { full_name: string } | null;
  flat_bill_charges?: Array<Record<string, unknown>> | null;
  rent_payments?: Array<{ verification_status: string }> | null;
};

export const billEntryRowsQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["bill-entry-rows", buildingId, month],
    enabled: Boolean(buildingId) && buildingId !== "all" && Boolean(month),
    queryFn: async (): Promise<BillEntryRow[]> => {
      const { data, error } = await supabase
        .from("rent_records")
        .select(
          "id, building_id, flat_id, tenant_id, billing_month, base_rent, individual_charges_total, shared_charges_total, total_payable, flats(flat_number), profiles(full_name), flat_bill_charges(id, charge_type, amount, description), rent_payments!rent_payments_rent_record_id_fkey(verification_status)",
        )
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month));
      if (error) throw error;

      const rows = (data ?? []).map((raw) => {
        const row = raw as RawBillRecord;
        const charges = row.flat_bill_charges ?? [];
        const amounts: Partial<Record<FlatChargeType, number>> = {};
        let notes = "";
        for (const charge of charges) {
          const type = charge["charge_type"] as FlatChargeType;
          amounts[type] = num(charge["amount"]);
          const description = (charge["description"] as string | null) ?? "";
          if (!notes && description) notes = description;
        }
        const payments = row.rent_payments ?? [];
        const locked = payments.some(
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
          individualTotal: num(row["individual_charges_total"]),
          sharedTotal: num(row["shared_charges_total"]),
          totalPayable: num(row["total_payable"]),
          locked,
          lockReason: locked
            ? "A payment for this month is pending or verified, so charges can no longer be changed."
            : "",
          amounts,
          notes,
        } satisfies BillEntryRow;
      });

      return rows.sort((a, b) =>
        a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }),
      );
    },
  });

export type SaveBillRowInput = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  billingMonth: string;
  /** Raw text inputs; "" means "remove this charge". */
  amounts: Partial<Record<FlatChargeType, string>>;
  notes: string;
};

export async function saveFlatBills(inputs: SaveBillRowInput[]) {
  const { data: auth } = await supabase.auth.getUser();
  const enteredBy = auth.user?.id;
  if (!enteredBy) throw new Error("You must be signed in to enter bills.");

  const upserts: Array<{
    rent_record_id: string;
    building_id: string;
    flat_id: string;
    tenant_id: string;
    billing_month: string;
    charge_type: FlatChargeType;
    amount: number;
    description: string | null;
    entered_by: string;
  }> = [];
  const clears: Array<{ rentRecordId: string; chargeType: FlatChargeType }> = [];

  for (const input of inputs) {
    for (const type of bulkChargeTypes) {
      const raw = (input.amounts[type] ?? "").trim();
      if (raw === "") {
        clears.push({ rentRecordId: input.rentRecordId, chargeType: type });
        continue;
      }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`Enter a valid amount for flat charges (${flatChargeLabel[type]}).`);
      }
      upserts.push({
        rent_record_id: input.rentRecordId,
        building_id: input.buildingId,
        flat_id: input.flatId,
        tenant_id: input.tenantId,
        billing_month: input.billingMonth,
        charge_type: type,
        amount,
        description: input.notes.trim() || null,
        entered_by: enteredBy,
      });
    }
  }

  for (const clear of clears) {
    const { error } = await supabase
      .from("flat_bill_charges")
      .delete()
      .eq("rent_record_id", clear.rentRecordId)
      .eq("charge_type", clear.chargeType);
    if (error) throw friendlyChargeError(error.message);
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("flat_bill_charges")
      .upsert(upserts, { onConflict: "rent_record_id,charge_type" });
    if (error) throw friendlyChargeError(error.message);
  }

  return { saved: upserts.length, removed: clears.length };
}

export type SharedChargeAllocation = {
  id: string;
  allocated_amount: number;
  flat_id: string;
  rent_record_id: string;
  flat_number: string;
};

export type SharedCharge = {
  id: string;
  building_id: string;
  billing_month: string;
  category: SharedChargeCategory;
  total_amount: number;
  description: string | null;
  created_at: string;
  allocations: SharedChargeAllocation[];
};

export const sharedChargesQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["shared-charges", buildingId, month],
    enabled: Boolean(buildingId) && buildingId !== "all" && Boolean(month),
    queryFn: async (): Promise<SharedCharge[]> => {
      const { data, error } = await supabase
        .from("shared_building_charges")
        .select(
          "*, shared_charge_allocations(id, allocated_amount, flat_id, rent_record_id, flats(flat_number))",
        )
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month))
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          shared_charge_allocations?: Array<
            Record<string, unknown> & { flats?: { flat_number: string } | null }
          > | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          billing_month: row["billing_month"] as string,
          category: row["category"] as SharedChargeCategory,
          total_amount: num(row["total_amount"]),
          description: (row["description"] as string | null) ?? null,
          created_at: row["created_at"] as string,
          allocations: (row.shared_charge_allocations ?? [])
            .map((allocation) => ({
              id: allocation["id"] as string,
              allocated_amount: num(allocation["allocated_amount"]),
              flat_id: allocation["flat_id"] as string,
              rent_record_id: allocation["rent_record_id"] as string,
              flat_number: allocation.flats?.flat_number ?? "—",
            }))
            .sort((a, b) =>
              a.flat_number.localeCompare(b.flat_number, undefined, { numeric: true }),
            ),
        } satisfies SharedCharge;
      });
    },
  });

export type EligibleFlat = {
  rentRecordId: string;
  flatId: string;
  flatNumber: string;
  tenantName: string;
};

export const eligibleFlatsQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["shared-charge-eligible-flats", buildingId, month],
    enabled: Boolean(buildingId) && buildingId !== "all" && Boolean(month),
    queryFn: async (): Promise<EligibleFlat[]> => {
      const { data, error } = await supabase
        .from("rent_records")
        .select("id, flat_id, flats!inner(flat_number, occupancy_status), profiles(full_name)")
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month))
        .eq("flats.occupancy_status", "occupied");
      if (error) throw error;
      return (data ?? [])
        .map((raw) => {
          const row = raw as Record<string, unknown> & {
            flats?: { flat_number: string } | null;
            profiles?: { full_name: string } | null;
          };
          return {
            rentRecordId: row["id"] as string,
            flatId: row["flat_id"] as string,
            flatNumber: row.flats?.flat_number ?? "—",
            tenantName: row.profiles?.full_name ?? "—",
          };
        })
        .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }));
    },
  });

/**
 * Mirrors the database split: everyone gets the amount truncated to 2 decimals
 * and the leftover paisa are handed out one by one, so the parts always add up
 * exactly to the entered total.
 */
export function computeEqualSplit(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, index) =>
    Number(((base + (index < remainder ? 1 : 0)) / 100).toFixed(2)),
  );
}

export type SharedChargeInput = {
  buildingId: string;
  month: string;
  category: SharedChargeCategory;
  totalAmount: number;
  description: string;
};

export async function createSharedCharge(input: SharedChargeInput) {
  if (!(input.totalAmount > 0)) throw new Error("Total shared amount must be greater than zero.");

  const { data: auth } = await supabase.auth.getUser();
  const createdBy = auth.user?.id;
  if (!createdBy) throw new Error("You must be signed in to add a shared charge.");

  const { data, error } = await supabase
    .from("shared_building_charges")
    .insert({
      building_id: input.buildingId,
      billing_month: monthToDate(input.month),
      category: input.category,
      total_amount: input.totalAmount,
      description: input.description.trim() || null,
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (error) throw friendlyChargeError(error.message);

  const chargeId = (data as { id: string }).id;
  const { data: allocated, error: allocationError } = await supabase.rpc("allocate_shared_charge", {
    _shared_charge_id: chargeId,
  });

  if (allocationError) {
    // Nothing was split, so do not leave an unallocated charge behind.
    await supabase.from("shared_building_charges").delete().eq("id", chargeId);
    throw friendlyChargeError(allocationError.message);
  }

  return { chargeId, flatCount: Number(allocated ?? 0) };
}

export async function deleteSharedCharge(id: string) {
  const { error } = await supabase.from("shared_building_charges").delete().eq("id", id);
  if (error) throw friendlyChargeError(error.message);
}

export type TenantBillCharge = {
  id: string;
  charge_type: FlatChargeType;
  amount: number;
  description: string | null;
};

export type TenantSharedShare = {
  id: string;
  allocated_amount: number;
  category: SharedChargeCategory;
  description: string | null;
};

export type TenantMonthlyBill = {
  id: string;
  building_id: string;
  building_name: string;
  flat_id: string;
  flat_number: string;
  tenant_id: string;
  billing_month: string;
  due_date: string;
  base_rent: number;
  individual_charges_total: number;
  shared_charges_total: number;
  total_payable: number;
  total_paid: number;
  remaining_due: number;
  payment_status: string;
  charges: TenantBillCharge[];
  sharedShares: TenantSharedShare[];
};

export const myMonthlyBillsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-monthly-bills", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TenantMonthlyBill[]> => {
      const { data, error } = await supabase
        .from("rent_records")
        .select(
          "id, building_id, flat_id, tenant_id, billing_month, due_date, base_rent, individual_charges_total, shared_charges_total, total_payable, total_paid, remaining_due, payment_status, buildings(name), flats(flat_number), flat_bill_charges(id, charge_type, amount, description), shared_charge_allocations(id, allocated_amount, shared_building_charges(category, description))",
        )
        .eq("tenant_id", userId!)
        .order("billing_month", { ascending: false });
      if (error) throw error;

      return (data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          flat_bill_charges?: Array<Record<string, unknown>> | null;
          shared_charge_allocations?: Array<
            Record<string, unknown> & {
              shared_building_charges?: {
                category: SharedChargeCategory;
                description: string | null;
              } | null;
            }
          > | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_id: row["flat_id"] as string,
          flat_number: row.flats?.flat_number ?? "—",
          tenant_id: row["tenant_id"] as string,
          billing_month: row["billing_month"] as string,
          due_date: row["due_date"] as string,
          base_rent: num(row["base_rent"]),
          individual_charges_total: num(row["individual_charges_total"]),
          shared_charges_total: num(row["shared_charges_total"]),
          total_payable: num(row["total_payable"]),
          total_paid: num(row["total_paid"]),
          remaining_due: num(row["remaining_due"]),
          payment_status: row["payment_status"] as string,
          charges: (row.flat_bill_charges ?? []).map((charge) => ({
            id: charge["id"] as string,
            charge_type: charge["charge_type"] as FlatChargeType,
            amount: num(charge["amount"]),
            description: (charge["description"] as string | null) ?? null,
          })),
          sharedShares: (row.shared_charge_allocations ?? []).map((allocation) => ({
            id: allocation["id"] as string,
            allocated_amount: num(allocation["allocated_amount"]),
            category: allocation.shared_building_charges?.category ?? "other",
            description: allocation.shared_building_charges?.description ?? null,
          })),
        } satisfies TenantMonthlyBill;
      });
    },
  });
