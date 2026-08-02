import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "overdue";

export type RentRecord = {
  id: string;
  building_id: string;
  flat_id: string;
  tenant_id: string;
  billing_month: string;
  base_rent: number;
  due_date: string;
  payment_status: PaymentStatus;
  total_paid: number;
  remaining_due: number;
  individual_charges_total: number;
  shared_charges_total: number;
  total_payable: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RentRow = RentRecord & {
  building_name: string;
  flat_number: string;
  tenant_name: string;
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

export function formatMonth(value: string) {
  const [year, month] = value.split("-");
  if (!year || !month) return value;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function monthToDate(monthInput: string) {
  return `${monthInput}-01`;
}

export function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type RawRentRow = Record<string, unknown> & {
  buildings?: { name: string } | null;
  flats?: { flat_number: string } | null;
  profiles?: { full_name: string } | null;
};

function normalizeRow(row: RawRentRow): RentRow {
  return {
    ...(row as unknown as RentRecord),
    base_rent: Number(row["base_rent"] ?? 0),
    total_paid: Number(row["total_paid"] ?? 0),
    remaining_due: Number(row["remaining_due"] ?? 0),
    individual_charges_total: Number(row["individual_charges_total"] ?? 0),
    shared_charges_total: Number(row["shared_charges_total"] ?? 0),
    total_payable: Number(row["total_payable"] ?? 0),
    building_name: row.buildings?.name ?? "—",
    flat_number: row.flats?.flat_number ?? "—",
    tenant_name: row.profiles?.full_name ?? "—",
  };
}

export type RentFilters = {
  buildingId: string; // "all" for every building
  month: string; // "" for every month (yyyy-MM)
  status: PaymentStatus | "all";
};

export const rentRecordsQueryOptions = (filters: RentFilters) =>
  queryOptions({
    queryKey: ["rent-records", filters.buildingId, filters.month, filters.status],
    queryFn: async (): Promise<RentRow[]> => {
      let query = supabase
        .from("rent_records")
        .select(
          "*, buildings(name), flats(flat_number), profiles(full_name)"
        )
        .order("billing_month", { ascending: false });

      if (filters.buildingId !== "all") query = query.eq("building_id", filters.buildingId);
      if (filters.month) query = query.eq("billing_month", monthToDate(filters.month));
      if (filters.status !== "all") query = query.eq("payment_status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => normalizeRow(row as RawRentRow));
    },
  });

export const myRentRecordsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-rent-records", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<RentRecord[]> => {
      const { data, error } = await supabase
        .from("rent_records")
        .select("*")
        .eq("tenant_id", userId!)
        .order("billing_month", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as unknown as RentRecord),
        base_rent: Number((row as Record<string, unknown>)["base_rent"] ?? 0),
        total_paid: Number((row as Record<string, unknown>)["total_paid"] ?? 0),
        remaining_due: Number((row as Record<string, unknown>)["remaining_due"] ?? 0),
        individual_charges_total: Number(
          (row as Record<string, unknown>)["individual_charges_total"] ?? 0
        ),
        shared_charges_total: Number(
          (row as Record<string, unknown>)["shared_charges_total"] ?? 0
        ),
        total_payable: Number((row as Record<string, unknown>)["total_payable"] ?? 0),
      }));
    },
  });

export type GenerateResult = { created: number; skipped: number; eligible: number };

export async function generateMonthlyRent(params: {
  buildingId: string;
  month: string; // yyyy-MM
  dueDate: string; // yyyy-MM-dd
}): Promise<GenerateResult> {
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
