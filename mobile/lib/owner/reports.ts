import { useCallback, useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { monthToDate, useAsyncState } from "@/lib/owner/shared";

/**
 * Owner financial rollup. Wraps the read-only `report_owner_summary`
 * SECURITY DEFINER RPC — the same one the web app's src/lib/reports.ts
 * ownerSummaryQueryOptions() calls. All of the accounting (billed,
 * collected, outstanding, cash received, net cash, collection rate) is
 * computed inside that database function; this module only shapes the
 * request and passes the result through.
 *
 * The web Reports page also offers monthly-statement, cash-flow,
 * outstanding-filter, collection-trend, tenant-ledger and reconciliation
 * views plus CSV export — those are left for the web app in this mobile
 * pass (see the Owner integration report): they are dense, filter-heavy
 * analyst tools that need more screen space than a phone gives them, and
 * CSV export relies on a browser download API `react-native` does not have.
 */

export type OwnerSummary = {
  from_month: string;
  to_month: string;
  buildings_count: number;
  total_billed: number;
  total_collected: number;
  total_outstanding: number;
  approved_expenses: number;
  cash_received: number;
  net_cash: number;
  collection_rate: number;
  by_building: {
    building_id: string;
    building_name: string;
    billed: number;
    collected: number;
    outstanding: number;
    received: number;
    expenses: number;
    net_cash: number;
    collection_rate: number;
  }[];
  incomplete_billing_months: {
    building_id: string;
    building_name: string;
    billing_month: string;
    occupied_flats: number;
    rent_records: number;
  }[];
  closed_months_with_dues: {
    building_id: string;
    building_name: string;
    billing_month: string;
    status: string;
    remaining_due: number;
  }[];
};

export function useOwnerSummary(fromMonth: string, toMonth: string) {
  const { session } = useAuth();
  const state = useAsyncState<OwnerSummary | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !fromMonth || !toMonth) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase.rpc("report_owner_summary", {
        _from_month: monthToDate(fromMonth),
        _to_month: monthToDate(toMonth),
      });
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData(data as unknown as OwnerSummary);
      }
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, fromMonth, toMonth],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { summary: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}
