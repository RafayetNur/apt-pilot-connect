import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/manager/shared";

/**
 * Manager maintenance queue + work orders for assigned buildings. Mirrors
 * the web app's src/lib/maintenance.ts: same `maintenance_requests` select
 * with joins, same status/assignment/work-order RPCs (never writes `status`
 * directly — always through `maintenance_change_status` /
 * `maintenance_assign` / `work_order_*`, which enforce the allowed
 * transitions and tenant/building isolation server-side).
 */

export type MaintenanceCategory = Database["public"]["Enums"]["maintenance_category"];
export type MaintenancePriority = Database["public"]["Enums"]["maintenance_priority"];
export type MaintenanceStatus = Database["public"]["Enums"]["maintenance_status"];
export type WorkOrderStatus = Database["public"]["Enums"]["work_order_status"];

export const maintenanceCategoryLabel: Record<MaintenanceCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  gas: "Gas",
  water: "Water supply",
  appliance: "Appliance",
  structural: "Structural",
  lift: "Lift",
  security: "Security",
  cleanliness: "Cleanliness",
  common_area: "Common area",
  internet: "Internet",
  pest_control: "Pest control",
  other: "Other",
};

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  assigned: "Assigned",
  in_progress: "In progress",
  waiting_for_parts: "Waiting for parts",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  reopened: "Reopened",
};

/** Mirrors public.maintenance_transition_allowed — used to only show valid next steps. */
export const allowedTransitions: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  submitted: ["acknowledged", "rejected", "cancelled"],
  acknowledged: ["assigned", "rejected", "cancelled"],
  assigned: ["in_progress"],
  in_progress: ["waiting_for_parts", "resolved"],
  waiting_for_parts: ["in_progress"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  rejected: [],
  cancelled: [],
  reopened: ["acknowledged", "assigned", "in_progress"],
};

export const openStatuses: MaintenanceStatus[] = ["submitted", "acknowledged", "assigned", "in_progress", "waiting_for_parts", "reopened"];

export type MaintenanceRow = {
  id: string;
  request_number: string;
  building_id: string;
  building_name: string;
  flat_id: string | null;
  flat_number: string | null;
  tenant_name: string | null;
  category: MaintenanceCategory;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  is_common_area: boolean;
  assigned_to: string | null;
  assignee_name: string | null;
  created_at: string;
};

const REQUEST_SELECT =
  "id, request_number, building_id, flat_id, category, title, description, priority, status, is_common_area, assigned_to, created_at, buildings(name), flats(flat_number), tenant:profiles!maintenance_requests_tenant_id_fkey(full_name), assignee:profiles!maintenance_requests_assigned_to_fkey(full_name)";

function normalizeRequest(raw: unknown): MaintenanceRow {
  const row = raw as Record<string, unknown> & {
    buildings?: { name: string } | null;
    flats?: { flat_number: string } | null;
    tenant?: { full_name: string } | null;
    assignee?: { full_name: string } | null;
  };
  return {
    id: row["id"] as string,
    request_number: row["request_number"] as string,
    building_id: row["building_id"] as string,
    building_name: row.buildings?.name ?? "—",
    flat_id: (row["flat_id"] as string | null) ?? null,
    flat_number: row.flats?.flat_number ?? null,
    tenant_name: row.tenant?.full_name ?? null,
    category: row["category"] as MaintenanceCategory,
    title: row["title"] as string,
    description: row["description"] as string,
    priority: row["priority"] as MaintenancePriority,
    status: row["status"] as MaintenanceStatus,
    is_common_area: Boolean(row["is_common_area"]),
    assigned_to: (row["assigned_to"] as string | null) ?? null,
    assignee_name: row.assignee?.full_name ?? null,
    created_at: row["created_at"] as string,
  };
}

export type MaintenanceStatusFilter = "open" | MaintenanceStatus | "all";

export function useManagerMaintenance(buildingId: string, statusFilter: MaintenanceStatusFilter) {
  const { session } = useAuth();
  const state = useAsyncState<MaintenanceRow[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      let query = supabase.from("maintenance_requests").select(REQUEST_SELECT).order("created_at", { ascending: false });
      if (buildingId && buildingId !== "all") query = query.eq("building_id", buildingId);
      if (statusFilter === "open") query = query.in("status", openStatuses);
      else if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }
      const rows = (data ?? []).map(normalizeRequest);
      rows.sort((a, b) => {
        const priorityRank: Record<MaintenancePriority, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
        const p = priorityRank[a.priority] - priorityRank[b.priority];
        if (p !== 0) return p;
        return b.created_at.localeCompare(a.created_at);
      });
      state.setData(rows);
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId, statusFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { requests: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export function useMaintenanceDetail(requestId: string | null) {
  const { session } = useAuth();
  const state = useAsyncState<MaintenanceRow | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !requestId) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase.from("maintenance_requests").select(REQUEST_SELECT).eq("id", requestId).maybeSingle();
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData(data ? normalizeRequest(data) : null);
      }
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, requestId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { request: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export type WorkOrder = {
  id: string;
  work_order_number: string;
  status: WorkOrderStatus;
  vendor_name: string | null;
  technician_name: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_cost: number | null;
  work_description: string;
};

export function useWorkOrders(requestId: string | null) {
  const { session } = useAuth();
  const state = useAsyncState<WorkOrder[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session || !requestId) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      const { data, error } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, vendor_name, technician_name, scheduled_date, scheduled_time, estimated_cost, work_description")
        .eq("maintenance_request_id", requestId)
        .order("created_at", { ascending: true });
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
      } else {
        state.setData(
          (data ?? []).map((row) => ({
            ...row,
            estimated_cost: row.estimated_cost == null ? null : Number(row.estimated_cost),
          })),
        );
      }
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, requestId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { workOrders: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export function describeMaintenanceError(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to perform this maintenance action.";
  }
  if (message.includes("append-only")) {
    return "Maintenance history cannot be edited or deleted.";
  }
  return message;
}

export async function changeMaintenanceStatus(requestId: string, status: MaintenanceStatus, note?: string) {
  const args: Record<string, unknown> = { _request_id: requestId, _new_status: status };
  if (note?.trim()) args["_note"] = note.trim();
  const { error } = await supabase.rpc("maintenance_change_status", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function createWorkOrder(requestId: string, input: {
  workDescription: string;
  vendorName: string;
  technicianName: string;
  scheduledDate: string;
  estimatedCost: string;
}) {
  if (input.workDescription.trim().length < 3) throw new Error("Describe the work that needs to be done.");
  const estimated = input.estimatedCost.trim() ? Number(input.estimatedCost) : null;
  if (estimated != null && (!Number.isFinite(estimated) || estimated < 0)) {
    throw new Error("Estimated cost cannot be negative.");
  }
  const args: Record<string, unknown> = {
    _maintenance_request_id: requestId,
    _work_description: input.workDescription.trim(),
  };
  if (input.vendorName.trim()) args["_vendor_name"] = input.vendorName.trim();
  if (input.technicianName.trim()) args["_technician_name"] = input.technicianName.trim();
  if (input.scheduledDate) args["_scheduled_date"] = input.scheduledDate;
  if (estimated != null) args["_estimated_cost"] = estimated;

  const { error } = await supabase.rpc("work_order_create", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}

export async function updateWorkOrderStatus(workOrderId: string, status: WorkOrderStatus, note?: string) {
  const args: Record<string, unknown> = { _work_order_id: workOrderId, _new_status: status };
  if (note?.trim()) args["_note"] = note.trim();
  const { error } = await supabase.rpc("work_order_update_status", args as never);
  if (error) throw new Error(describeMaintenanceError(error.message));
}
