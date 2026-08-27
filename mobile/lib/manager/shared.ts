import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

/**
 * Shared formatting + fetch-state helpers for the manager screens. Mirrors
 * the web app's src/lib/rent.ts + src/lib/flats.ts formatting conventions
 * (see AptPilot-architecture-comparison.md-style comments across
 * mobile/app/(tenant)) so mobile and web read the same numbers the same way.
 */

export function formatBDT(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

/** `rent_records.billing_month` etc. come back as a plain "YYYY-MM-DD" date
 * string. Parse the year/month numerically and build a local Date instead of
 * string-concatenating, which avoids "Invalid Date" and timezone shifts. */
export function formatMonthLabel(value: string | null | undefined) {
  if (!value) return "—";
  const [yearPart, monthPart] = value.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!yearPart || !monthPart || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return "—";
  }
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDateSafe(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTimeSafe(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "YYYY-MM" input, matching the web app's currentMonthInput(). */
export function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM" -> "YYYY-MM-01", the plain date format `billing_month` columns store. */
export function monthToDate(monthInput: string) {
  return `${monthInput}-01`;
}

export function shiftMonthInput(monthInput: string, delta: number) {
  const [yearPart, monthPart] = monthInput.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return currentMonthInput();
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type ManagerBuilding = { id: string; name: string; status: string };

/**
 * Buildings visible to the signed-in manager. No explicit
 * `.eq("assigned_manager", ...)` filter is applied here on purpose — RLS
 * scopes the `buildings` table server-side to the manager's assigned
 * buildings, exactly like the web app's src/lib/buildings.ts /
 * src/lib/dashboard.ts queries.
 */
export function useManagerBuildings() {
  const { session } = useAuth();
  const mountedRef = useRef(true);
  const [buildings, setBuildings] = useState<ManagerBuilding[]>([]);
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

/** Generic async load-state container used by the manager data hooks below,
 * so every screen gets the same loading/error/refresh shape and none of
 * them can set state after the component unmounts. */
export function useAsyncState<T>(initial: T) {
  const mountedRef = useRef(true);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, setData, loading, setLoading, refreshing, setRefreshing, error, setError, mountedRef };
}
