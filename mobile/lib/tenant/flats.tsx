import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

/**
 * Shared tenant flat-selection state, used by every flat-specific Tenant
 * screen (Home, Bills, Repairs, Profile, Emergency).
 *
 * A tenant may legitimately be assigned to more than one flat — this is a
 * normal business state, not a data-integrity problem. This provider is
 * the single place that:
 *  - fetches the tenant's full `flats` list (never `.single()`/
 *    `.maybeSingle()` — 0, 1 or many rows are all valid outcomes here);
 *  - resolves which one flat is "selected": zero flats → no selection;
 *    exactly one → auto-selected, no picker needed; more than one → the
 *    tenant's last choice (remembered via AsyncStorage) if it's still
 *    among their current flats, otherwise no selection until they pick;
 *  - exposes `selectFlat` so any screen's picker can change it, and every
 *    screen sharing this context re-renders (and can refetch) together.
 *
 * Screens must scope every flat-specific query
 * (`rent_records`/`rent_payments`/`tenant_credits`/`maintenance_requests`/
 * etc.) by `selectedFlat.id`, never just `tenant_id` alone, so switching
 * flats never combines data across flats.
 */

const SELECTED_FLAT_STORAGE_KEY = "aptpilot.tenant.selectedFlatId";

export type TenantFlat = {
  id: string;
  flat_number: string;
  building_id: string;
  building_name: string;
};

type TenantFlatContextValue = {
  flats: TenantFlat[];
  selectedFlat: TenantFlat | null;
  selectFlat: (flatId: string) => void;
  /** True until the flats list has been fetched at least once. */
  loading: boolean;
  /** A real query failure fetching the flats list — never a row-count artifact. */
  error: string | null;
  refresh: () => Promise<void>;
};

const TenantFlatContext = createContext<TenantFlatContextValue | undefined>(undefined);

export function TenantFlatProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [flats, setFlats] = useState<TenantFlat[]>([]);
  const [selectedFlatId, setSelectedFlatIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read any previously-remembered flat id once. It's validated against the
  // live flats list below (via `selectedFlat`'s useMemo) before ever being
  // used — a stale id (the tenant was removed from that flat since) is
  // simply not found and falls back to "no selection".
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SELECTED_FLAT_STORAGE_KEY)
      .then((stored) => {
        if (active) setSelectedFlatIdState(stored);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    const { data, error: flatsError } = await supabase
      .from("flats")
      .select("id, flat_number, building_id, buildings(name)")
      .eq("tenant_id", session.user.id)
      .order("flat_number", { ascending: true });

    if (flatsError) {
      // A real query failure (network/RLS/etc.) — never shown raw to the
      // user; screens render their own friendly wrapper around this state.
      setError(flatsError.message);
      setLoading(false);
      return;
    }

    const rows: TenantFlat[] = (data ?? []).map((row) => {
      const buildings = row.buildings as { name: string } | null;
      return {
        id: row.id,
        flat_number: row.flat_number,
        building_id: row.building_id,
        building_name: buildings?.name ?? "Your building",
      };
    });
    setFlats(rows);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const selectFlat = useCallback((flatId: string) => {
    setSelectedFlatIdState(flatId);
    AsyncStorage.setItem(SELECTED_FLAT_STORAGE_KEY, flatId).catch(() => {
      // Best-effort persistence only — the in-memory selection still works
      // for the rest of this session even if storage is unavailable.
    });
  }, []);

  const selectedFlat = useMemo<TenantFlat | null>(() => {
    if (!hydrated || loading || flats.length === 0) return null;
    if (flats.length === 1) return flats[0];
    return flats.find((flat) => flat.id === selectedFlatId) ?? null;
  }, [hydrated, loading, flats, selectedFlatId]);

  const value = useMemo<TenantFlatContextValue>(
    () => ({ flats, selectedFlat, selectFlat, loading: loading || !hydrated, error, refresh: load }),
    [flats, selectedFlat, selectFlat, loading, hydrated, error, load],
  );

  return <TenantFlatContext.Provider value={value}>{children}</TenantFlatContext.Provider>;
}

export function useTenantFlat() {
  const ctx = useContext(TenantFlatContext);
  if (!ctx) throw new Error("useTenantFlat must be used within a TenantFlatProvider");
  return ctx;
}
