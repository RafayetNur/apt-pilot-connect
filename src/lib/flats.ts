import { queryOptions } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

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

/**
 * A tenant may legitimately occupy more than one flat — this is normal
 * business state, not a data-integrity problem, so this is a plural list
 * (never `.single()`/`.maybeSingle()`). Mirrors the mobile
 * `TenantFlatProvider` (mobile/lib/tenant/flats.tsx): 0, 1 or many rows are
 * all valid outcomes here.
 */
export type TenantFlatSummary = {
  id: string;
  flat_number: string;
  building_id: string;
  building_name: string;
  occupancy_status: OccupancyStatus;
};

export const myTenantFlatsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-flats", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TenantFlatSummary[]> => {
      const { data, error } = await supabase
        .from("flats")
        .select("id, flat_number, building_id, occupancy_status, buildings(name)")
        .eq("tenant_id", userId!)
        .order("flat_number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown> & { buildings?: { name: string } | null };
        return {
          id: r["id"] as string,
          flat_number: r["flat_number"] as string,
          building_id: r["building_id"] as string,
          building_name: r.buildings?.name ?? "Your building",
          occupancy_status: r["occupancy_status"] as OccupancyStatus,
        };
      });
    },
  });

const SELECTED_FLAT_STORAGE_KEY = "aptpilot.tenant.selectedFlatId";

function readStoredFlatId(): string | null {
  try {
    return localStorage.getItem(SELECTED_FLAT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing, disabled site data). The
    // selection still works for the rest of this session.
    return null;
  }
}

function writeStoredFlatId(id: string) {
  try {
    localStorage.setItem(SELECTED_FLAT_STORAGE_KEY, id);
  } catch {
    // Best-effort persistence only.
  }
}

/**
 * Resolves which of the tenant's flats is "selected", the same rules the
 * mobile selector uses: zero flats → no selection; exactly one → it is
 * auto-selected, no picker needed; more than one → the tenant's last choice
 * (persisted in localStorage) if it is still among their current flats,
 * otherwise no selection until they pick one. A stale persisted id (the
 * tenant was removed from that flat since) is simply not found and falls
 * back to "no selection" rather than being used.
 */
export function useSelectedTenantFlat(flats: TenantFlatSummary[]) {
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredFlatId());

  const selectedFlat = useMemo<TenantFlatSummary | null>(() => {
    if (flats.length === 0) return null;
    if (flats.length === 1) return flats[0] ?? null;
    return flats.find((flat) => flat.id === selectedId) ?? null;
  }, [flats, selectedId]);

  const selectFlat = useCallback((id: string) => {
    setSelectedId(id);
    writeStoredFlatId(id);
  }, []);

  return { selectedFlat, selectFlat };
}
