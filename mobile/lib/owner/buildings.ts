import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/owner/shared";

/**
 * Owner building CRUD. Mirrors the web app's src/lib/buildings.ts
 * query-for-query: same `buildings` table, same columns, `owner_id` set from
 * the signed-in user on create (never taken from client input), and no
 * "manager assignment" workflow beyond the same free-text `assigned_manager`
 * label the web app's building form uses — see mobile/app/(owner)/managers.tsx
 * for why (the web app has no manager-account picker or assignment table
 * either).
 */

export type BuildingStatus = Database["public"]["Enums"]["building_status"];

export type OwnerBuildingRow = {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  area: string;
  floors: number;
  total_flats: number;
  assigned_manager: string;
  status: BuildingStatus;
  created_at: string;
  updated_at: string;
};

export type BuildingInput = {
  name: string;
  address: string;
  area: string;
  floors: number;
  total_flats: number;
  assigned_manager: string;
  status: BuildingStatus;
};

export const buildingStatusLabel: Record<BuildingStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export type OwnerBuildingSummary = OwnerBuildingRow & { flatsTotal: number; flatsOccupied: number };

/** Owner's buildings enriched with a flat count + occupied count, for the
 * Properties list. Two RLS-scoped queries (buildings, flats), joined
 * client-side — the same shape the owner dashboard already computes. */
export function useOwnerBuildingsList() {
  const { session } = useAuth();
  const state = useAsyncState<OwnerBuildingSummary[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const [buildingsRes, flatsRes] = await Promise.all([
        supabase.from("buildings").select("*").order("created_at", { ascending: false }),
        supabase.from("flats").select("id, building_id, occupancy_status"),
      ]);

      if (!state.mountedRef.current) return;
      const loadError = buildingsRes.error ?? flatsRes.error;
      if (loadError) {
        state.setError(loadError.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const flats = (flatsRes.data ?? []) as { id: string; building_id: string; occupancy_status: string }[];
      const rows: OwnerBuildingSummary[] = ((buildingsRes.data ?? []) as OwnerBuildingRow[]).map((building) => {
        const buildingFlats = flats.filter((flat) => flat.building_id === building.id);
        return {
          ...building,
          flatsTotal: buildingFlats.length,
          flatsOccupied: buildingFlats.filter((flat) => flat.occupancy_status === "occupied").length,
        };
      });

      state.setData(rows);
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { buildings: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export function useOwnerBuildingDetail(buildingId: string | null) {
  const { session } = useAuth();
  const state = useAsyncState<OwnerBuildingRow | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !buildingId) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase.from("buildings").select("*").eq("id", buildingId).maybeSingle();
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData((data as OwnerBuildingRow | null) ?? null);
      }
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { building: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

function friendlyError(message: string): Error {
  if (message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("permission denied")) {
    return new Error("You are not allowed to change this building.");
  }
  return new Error(message);
}

export async function createBuilding(input: BuildingInput) {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("You must be signed in to add a building.");
  if (!input.name.trim()) throw new Error("Building name is required.");
  if (!input.address.trim()) throw new Error("Full address is required.");
  const { error } = await supabase.from("buildings").insert({ ...input, owner_id: ownerId });
  if (error) throw friendlyError(error.message);
}

export async function updateBuilding(id: string, input: BuildingInput) {
  if (!input.name.trim()) throw new Error("Building name is required.");
  if (!input.address.trim()) throw new Error("Full address is required.");
  const { error } = await supabase.from("buildings").update(input).eq("id", id);
  if (error) throw friendlyError(error.message);
}

export async function deleteBuilding(id: string) {
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) throw friendlyError(error.message);
}
