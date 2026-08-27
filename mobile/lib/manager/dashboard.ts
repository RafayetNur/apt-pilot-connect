import { useCallback, useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDate, useAsyncState } from "@/lib/manager/shared";

/**
 * Manager dashboard summary. Mirrors the web app's
 * src/lib/dashboard.ts::dashboardSummaryQueryOptions query-for-query:
 * buildings / flats / rent_records / rent_payments / tenant_credits are
 * fetched with no manual "assigned building" filter because RLS already
 * scopes every one of those tables to the buildings assigned to this
 * manager. Only the totals math is duplicated client-side (grouping and
 * summing plain numbers already computed by the rent_records triggers) —
 * no accounting logic is recomputed.
 */

export type DashboardBuilding = { id: string; name: string; status: string };
export type DashboardFlat = { id: string; building_id: string; occupancy_status: "vacant" | "occupied"; tenant_id: string | null };

export type DashboardRecord = {
  id: string;
  building_id: string;
  building_name: string;
  flat_id: string;
  flat_number: string;
  tenant_id: string;
  tenant_name: string;
  billing_month: string;
  due_date: string;
  base_rent: number;
  individual_charges_total: number;
  total_payable: number;
  total_paid: number;
  remaining_due: number;
  payment_status: string;
};

export type DashboardPayment = {
  id: string;
  building_id: string;
  building_name: string;
  flat_number: string;
  tenant_name: string;
  amount_paid: number;
  payment_method: string;
  verification_status: string;
  submitted_at: string;
};

export type BuildingSummary = {
  id: string;
  name: string;
  totalFlats: number;
  occupied: number;
  payable: number;
  collected: number;
  remaining: number;
};

export type ManagerDashboardData = {
  totals: {
    totalBuildings: number;
    totalFlats: number;
    occupied: number;
    vacant: number;
    totalPayable: number;
    collected: number;
    remaining: number;
    overdue: number;
    pendingVerifications: number;
  };
  buildingSummaries: BuildingSummary[];
  needsChargeEntry: DashboardRecord[];
  recentSubmissions: DashboardPayment[];
};

function num(value: unknown) {
  return Number(value ?? 0);
}

export function useManagerDashboard(monthInput: string) {
  const { session } = useAuth();
  const state = useAsyncState<ManagerDashboardData | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const billingMonth = monthToDate(monthInput);

      const [buildingsRes, flatsRes, recordsRes, paymentsRes] = await Promise.all([
        supabase.from("buildings").select("id, name, status").order("name"),
        supabase.from("flats").select("id, building_id, occupancy_status, tenant_id"),
        supabase
          .from("rent_records")
          .select(
            "id, building_id, flat_id, tenant_id, billing_month, due_date, base_rent, individual_charges_total, total_payable, total_paid, remaining_due, payment_status, buildings(name), flats(flat_number), profiles(full_name)",
          )
          .eq("billing_month", billingMonth),
        supabase
          .from("rent_payments")
          .select(
            "id, building_id, amount_paid, payment_method, verification_status, submitted_at, buildings(name), flats(flat_number), tenant:profiles!rent_payments_tenant_id_fkey(full_name)",
          )
          .order("submitted_at", { ascending: false })
          .limit(60),
      ]);

      if (!state.mountedRef.current) return;

      const loadError = buildingsRes.error ?? flatsRes.error ?? recordsRes.error ?? paymentsRes.error;
      if (loadError) {
        state.setError(loadError.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }

      const buildings = (buildingsRes.data ?? []) as DashboardBuilding[];
      const flats = (flatsRes.data ?? []) as DashboardFlat[];

      const records: DashboardRecord[] = (recordsRes.data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          profiles?: { full_name: string } | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_id: row["flat_id"] as string,
          flat_number: row.flats?.flat_number ?? "—",
          tenant_id: row["tenant_id"] as string,
          tenant_name: row.profiles?.full_name ?? "—",
          billing_month: row["billing_month"] as string,
          due_date: row["due_date"] as string,
          base_rent: num(row["base_rent"]),
          individual_charges_total: num(row["individual_charges_total"]),
          total_payable: num(row["total_payable"]),
          total_paid: num(row["total_paid"]),
          remaining_due: num(row["remaining_due"]),
          payment_status: row["payment_status"] as string,
        };
      });

      const payments: DashboardPayment[] = (paymentsRes.data ?? []).map((raw) => {
        const row = raw as Record<string, unknown> & {
          buildings?: { name: string } | null;
          flats?: { flat_number: string } | null;
          tenant?: { full_name: string } | null;
        };
        return {
          id: row["id"] as string,
          building_id: row["building_id"] as string,
          building_name: row.buildings?.name ?? "—",
          flat_number: row.flats?.flat_number ?? "—",
          tenant_name: row.tenant?.full_name ?? "—",
          amount_paid: num(row["amount_paid"]),
          payment_method: row["payment_method"] as string,
          verification_status: row["verification_status"] as string,
          submitted_at: row["submitted_at"] as string,
        };
      });

      const today = new Date().toISOString().slice(0, 10);
      const occupied = flats.filter((flat) => flat.occupancy_status === "occupied").length;
      const totalFlats = flats.length;

      const totalPayable = records.reduce((sum, row) => sum + row.total_payable, 0);
      const collected = records.reduce((sum, row) => sum + row.total_paid, 0);
      const remaining = records.reduce((sum, row) => sum + row.remaining_due, 0);
      const overdue = records
        .filter((row) => row.remaining_due > 0 && row.due_date < today)
        .reduce((sum, row) => sum + row.remaining_due, 0);

      const buildingSummaries: BuildingSummary[] = buildings.map((building) => {
        const buildingFlats = flats.filter((flat) => flat.building_id === building.id);
        const buildingRecords = records.filter((row) => row.building_id === building.id);
        return {
          id: building.id,
          name: building.name,
          totalFlats: buildingFlats.length,
          occupied: buildingFlats.filter((flat) => flat.occupancy_status === "occupied").length,
          payable: buildingRecords.reduce((sum, row) => sum + row.total_payable, 0),
          collected: buildingRecords.reduce((sum, row) => sum + row.total_paid, 0),
          remaining: buildingRecords.reduce((sum, row) => sum + row.remaining_due, 0),
        };
      });

      state.setData({
        totals: {
          totalBuildings: buildings.length,
          totalFlats,
          occupied,
          vacant: totalFlats - occupied,
          totalPayable,
          collected,
          remaining,
          overdue,
          pendingVerifications: payments.filter((p) => p.verification_status === "pending").length,
        },
        buildingSummaries,
        needsChargeEntry: records.filter((row) => row.individual_charges_total === 0),
        recentSubmissions: payments.slice(0, 6),
      });
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, monthInput],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}
