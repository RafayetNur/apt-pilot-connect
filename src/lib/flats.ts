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
