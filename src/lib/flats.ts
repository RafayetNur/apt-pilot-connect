import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type OccupancyStatus = "vacant" | "occupied";

export type Flat = {
  id: string;
  building_id: string;
  flat_number: string;
  floor_number: number;
  bedroom_count: number;
  bathroom_count: number;
  size_sqft: number;
  monthly_rent: number;
  occupancy_status: OccupancyStatus;
  tenant_id: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type FlatInput = {
  flat_number: string;
  floor_number: number;
  bedroom_count: number;
  bathroom_count: number;
  size_sqft: number;
  monthly_rent: number;
  occupancy_status: OccupancyStatus;
  notes: string;
};

export const occupancyLabel: Record<OccupancyStatus, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
};

function normalizeRow(row: Record<string, unknown>): Flat {
  return {
    ...(row as unknown as Flat),
    monthly_rent: Number(row["monthly_rent"] ?? 0),
  };
}

export const flatsQueryOptions = (buildingId: string) =>
  queryOptions({
    queryKey: ["flats", buildingId],
    queryFn: async (): Promise<Flat[]> => {
      const { data, error } = await supabase
        .from("flats")
        .select("*")
        .eq("building_id", buildingId)
        .order("flat_number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
    },
  });

function friendlyError(message: string) {
  if (message.toLowerCase().includes("flats_unique_number_per_building")) {
    return new Error("A flat with this number already exists in this building.");
  }
  return new Error(message);
}

export async function createFlat(buildingId: string, input: FlatInput) {
  const { error } = await supabase.from("flats").insert({ ...input, building_id: buildingId });
  if (error) throw friendlyError(error.message);
}

export async function updateFlat(id: string, input: FlatInput) {
  const { error } = await supabase.from("flats").update(input).eq("id", id);
  if (error) throw friendlyError(error.message);
}

export async function deleteFlat(id: string) {
  const { error } = await supabase.from("flats").delete().eq("id", id);
  if (error) throw friendlyError(error.message);
}

export function formatRent(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export type TenantProfile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
};

export const tenantProfilesQueryOptions = () =>
  queryOptions({
    queryKey: ["tenant-profiles"],
    queryFn: async (): Promise<TenantProfile[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("role", "tenant")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TenantProfile[];
    },
  });

export const flatTenantsQueryOptions = (tenantIds: string[]) =>
  queryOptions({
    queryKey: ["flat-tenants", [...tenantIds].sort().join(",")],
    queryFn: async (): Promise<Record<string, TenantProfile>> => {
      if (tenantIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", tenantIds);
      if (error) throw error;
      const map: Record<string, TenantProfile> = {};
      for (const row of (data ?? []) as TenantProfile[]) map[row.id] = row;
      return map;
    },
  });

export async function assignTenant(flatId: string, tenantId: string) {
  const { error } = await supabase
    .from("flats")
    .update({ tenant_id: tenantId, occupancy_status: "occupied" })
    .eq("id", flatId);
  if (error) throw friendlyError(error.message);
}

export async function removeTenant(flatId: string) {
  const { error } = await supabase
    .from("flats")
    .update({ tenant_id: null, occupancy_status: "vacant" })
    .eq("id", flatId);
  if (error) throw friendlyError(error.message);
}

export type MyFlat = {
  flat: Flat;
  building: { name: string; address: string } | null;
};

export const myFlatQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-flat", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<MyFlat | null> => {
      const { data, error } = await supabase
        .from("flats")
        .select("*, buildings(name, address)")
        .eq("tenant_id", userId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const building = (row["buildings"] as { name: string; address: string } | null) ?? null;
      return { flat: normalizeRow(row), building };
    },
  });
