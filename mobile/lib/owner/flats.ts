import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/owner/shared";

/**
 * Owner flat CRUD + tenant assignment. Mirrors the web app's
 * src/lib/flats.ts query-for-query: same `flats` table/columns, same
 * assignTenant/removeTenant behaviour (a plain `flats.tenant_id` +
 * `occupancy_status` update — there is no separate "lease" or "assignment"
 * table in this schema), and the same `profiles` role="tenant" query for the
 * assignment picker. Never assigns a flat by typing a name — always an
 * actual `profiles.id` chosen from that list.
 */

export type OccupancyStatus = Database["public"]["Enums"]["occupancy_status"];

export const occupancyLabel: Record<OccupancyStatus, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
};

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

function normalizeFlat(row: Record<string, unknown>): Flat {
  return {
    ...(row as unknown as Flat),
    monthly_rent: Number(row["monthly_rent"] ?? 0),
  };
}

function friendlyError(message: string): Error {
  if (message.toLowerCase().includes("flats_unique_number_per_building")) {
    return new Error("A flat with this number already exists in this building.");
  }
  if (message.toLowerCase().includes("row-level security") || message.toLowerCase().includes("permission denied")) {
    return new Error("You are not allowed to change this flat.");
  }
  return new Error(message);
}

export function useOwnerFlats(buildingId: string | null) {
  const { session } = useAuth();
  const state = useAsyncState<Flat[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !buildingId) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase
        .from("flats")
        .select("*")
        .eq("building_id", buildingId)
        .order("flat_number", { ascending: true });
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData((data ?? []).map((row) => normalizeFlat(row as Record<string, unknown>)));
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

  return { flats: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export type FlatDetail = { flat: Flat; buildingName: string; tenant: TenantProfile | null };

export function useOwnerFlatDetail(flatId: string | null) {
  const { session } = useAuth();
  const state = useAsyncState<FlatDetail | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !flatId) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      // There is no declared foreign key from flats.tenant_id to profiles
      // (see database.types.ts's `flats` Relationships array — it only
      // lists the building FK), so PostgREST cannot embed `profiles(...)`
      // directly on this table: it fails at request time with "Could not
      // find a relationship between 'flats' and 'profiles' in the schema
      // cache". `buildings(name)` stays embedded — flats_building_id_fkey
      // does exist. The tenant is resolved with a separate lookup below,
      // same as the web app's src/lib/flats.ts does not attempt this join.
      const { data, error } = await supabase
        .from("flats")
        .select("*, buildings(name)")
        .eq("id", flatId)
        .maybeSingle();
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }
      if (!data) {
        state.setData(null);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const row = data as unknown as Record<string, unknown> & {
        buildings?: { name: string } | null;
      };
      const flat = normalizeFlat(row);

      // Vacant flats (tenant_id null) need no second fetch, and never error.
      let tenant: TenantProfile | null = null;
      if (flat.tenant_id) {
        const { data: profileRow, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", flat.tenant_id)
          .maybeSingle();
        if (profileError) {
          // The flat itself loaded fine; do not fail the whole screen over
          // a tenant profile lookup (e.g. a stale/dangling tenant_id).
          console.warn("Could not load the assigned tenant's profile:", profileError.message);
        } else {
          tenant = (profileRow as TenantProfile | null) ?? null;
        }
      }

      if (!state.mountedRef.current) return;
      state.setData({
        flat,
        buildingName: row.buildings?.name ?? "—",
        tenant,
      });
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, flatId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { detail: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export async function createFlat(buildingId: string, input: FlatInput) {
  if (!input.flat_number.trim()) throw new Error("Flat number is required.");
  const { error } = await supabase.from("flats").insert({ ...input, building_id: buildingId });
  if (error) throw friendlyError(error.message);
}

export async function updateFlat(id: string, input: FlatInput) {
  if (!input.flat_number.trim()) throw new Error("Flat number is required.");
  const { error } = await supabase.from("flats").update(input).eq("id", id);
  if (error) throw friendlyError(error.message);
}

export async function deleteFlat(id: string) {
  const { error } = await supabase.from("flats").delete().eq("id", id);
  if (error) throw friendlyError(error.message);
}

export type TenantProfile = { id: string; full_name: string; email: string; phone: string };

/** Every tenant-role profile, for the "assign tenant" picker. Search is done
 * client-side over this list — the roster is small enough per app (tenant
 * signups), matching the web app's tenantProfilesQueryOptions(). */
export function useTenantProfiles() {
  const { session } = useAuth();
  const state = useAsyncState<TenantProfile[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    state.setLoading(true);
    state.setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("role", "tenant")
      .order("full_name", { ascending: true });
    if (!state.mountedRef.current) return;
    if (error) {
      state.setError(error.message);
    } else {
      state.setData((data ?? []) as TenantProfile[]);
    }
    state.setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { tenants: state.data, loading: state.loading, error: state.error, refresh: load };
}

export async function assignTenant(flatId: string, tenantId: string) {
  const { error } = await supabase.from("flats").update({ tenant_id: tenantId, occupancy_status: "occupied" }).eq("id", flatId);
  if (error) throw friendlyError(error.message);
}

export async function removeTenant(flatId: string) {
  const { error } = await supabase.from("flats").update({ tenant_id: null, occupancy_status: "vacant" }).eq("id", flatId);
  if (error) throw friendlyError(error.message);
}

export type TenantRosterRow = {
  flatId: string;
  buildingId: string;
  buildingName: string;
  flatNumber: string;
  monthlyRent: number;
  tenant: TenantProfile;
};

/** Every occupied flat across the owner's buildings, with its tenant — the
 * data behind the Tenants tab. RLS already scopes `flats` to owned
 * buildings, so this is one query with no manual building filter. */
export function useOwnerTenantRoster() {
  const { session } = useAuth();
  const state = useAsyncState<TenantRosterRow[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase
        .from("flats")
        .select("id, building_id, flat_number, monthly_rent, buildings(name), profiles(id, full_name, email, phone)")
        .not("tenant_id", "is", null)
        .order("flat_number", { ascending: true });
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const rows: TenantRosterRow[] = (data ?? [])
        .map((raw) => {
          // See the same `as unknown as` note in useOwnerFlatDetail above.
          const row = raw as unknown as Record<string, unknown> & {
            buildings?: { name: string } | null;
            profiles?: TenantProfile | null;
          };
          if (!row.profiles) return null;
          return {
            flatId: row["id"] as string,
            buildingId: row["building_id"] as string,
            buildingName: row.buildings?.name ?? "—",
            flatNumber: row["flat_number"] as string,
            monthlyRent: Number(row["monthly_rent"] ?? 0),
            tenant: row.profiles,
          };
        })
        .filter((row): row is TenantRosterRow => row !== null);

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

  return { tenants: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}
