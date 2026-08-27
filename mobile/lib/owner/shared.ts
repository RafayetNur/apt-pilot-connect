import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

/**
 * Shared owner formatting + fetch-state helpers. The formatting functions
 * and `useAsyncState` are pure, role-agnostic utilities already written for
 * the manager screens (see mobile/lib/manager/shared.ts) — re-exported here
 * instead of duplicated, matching AGENTS.md's "reuse Manager utilities where
 * permissions and semantics are genuinely shared" guidance. Nothing here
 * writes to mobile/lib/manager/*.
 */
export {
  formatBDT,
  formatMonthLabel,
  formatDateSafe,
  formatDateTimeSafe,
  currentMonthInput,
  monthToDate,
  shiftMonthInput,
  useAsyncState,
} from "@/lib/manager/shared";

export type OwnerBuilding = { id: string; name: string; status: string };

/**
 * Buildings owned by the signed-in owner. No explicit `.eq("owner_id", ...)`
 * filter is applied — RLS scopes the `buildings` table server-side to rows
 * where `owner_id = auth.uid()`, exactly like the web app's src/lib/buildings.ts
 * and the manager mobile screens' useManagerBuildings().
 */
export function useOwnerBuildings() {
  const { session } = useAuth();
  const mountedRef = useRef(true);
  const [buildings, setBuildings] = useState<OwnerBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("buildings")
      .select("id, name, status")
      .order("name", { ascending: true });
    if (!mountedRef.current) return;
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBuildings(data ?? []);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { buildings, loading, error, refresh: load };
}
