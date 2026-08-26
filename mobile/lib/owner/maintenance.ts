import { useCallback, useEffect } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/owner/shared";
import { describeMaintenanceError, type MaintenancePriority } from "@/lib/manager/maintenance";

/**
 * Owner maintenance queue + work orders + assignment. The request/work-order
 * queries, status-change RPC and allowed-transition map are identical
 * between owner and manager (same `maintenance_requests` table, same
 * `maintenance_change_status` / `work_order_*` RPCs, same
 * maintenance_transition_allowed rules) — re-exported from
 * mobile/lib/manager/maintenance.ts rather than duplicated. Assigning a
 * request to a person (`maintenance_assign`) is added here: the manager
 * mobile screens never added an assignment UI, but the web app's
 * src/lib/maintenance.ts exposes it to both roles, and the spec for this
 * pass calls out "assignment" explicitly for the owner.
 */
export {
  allowedTransitions,
  describeMaintenanceError,
  openStatuses,
  maintenanceCategoryLabel,
  maintenanceStatusLabel,
  changeMaintenanceStatus,
  createWorkOrder,
  updateWorkOrderStatus,
  useManagerMaintenance as useOwnerMaintenance,
  useMaintenanceDetail,
  useWorkOrders,
  type MaintenanceRow,
  type MaintenanceStatus,
  type MaintenancePriority,
  type MaintenanceStatusFilter,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/lib/manager/maintenance";

export const maintenancePriorityLabel: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  emergency: "Emergency",
};

export type AssignableUser = { id: string; full_name: string; role: string };

/** Owner + manager profiles, for the "assign to" picker on a request —
 * mirrors the web app's src/lib/maintenance.ts assignableUsersQueryOptions(). */
export function useAssignableUsers() {
  const { session } = useAuth();
  const state = useAsyncState<AssignableUser[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    state.setLoading(true);
    state.setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["owner", "manager"])
      .order("full_name", { ascending: true });
    if (!state.mountedRef.current) return;
    if (error) {
      state.setError(error.message);
    } else {
      state.setData((data ?? []) as AssignableUser[]);
    }
    state.setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return { users: state.data, loading: state.loading, error: state.error, refresh: load };
}

/** `maintenance_assign`'s `_assigned_to` argument is non-nullable in the
 * database function signature, so this only ever assigns to someone —
 * there is no supported "unassign" call. */
export async function assignMaintenanceRequest(requestId: string, assignedTo: string, priority?: MaintenancePriority) {
  const args: Record<string, unknown> = { _request_id: requestId, _assigned_to: assignedTo };
  if (priority) args["_priority"] = priority;
  const { error } = await supabase.rpc("maintenance_assign", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}
