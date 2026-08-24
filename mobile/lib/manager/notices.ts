import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/manager/shared";

/**
 * Manager notices for assigned buildings. Mirrors the web app's
 * src/lib/communication.ts notice functions: `notice_create` (draft) then
 * `notice_publish`, both SECURITY DEFINER RPCs that validate the caller's
 * building access and role server-side — this module never writes
 * `building_notices` rows directly.
 *
 * Audience is limited to "all_tenants" and "owner_manager_only" here (no
 * flat/tenant picker) — see the Manager integration report for why
 * selected_flats/selected_tenants was left out of this first pass.
 */

export type NoticePriority = Database["public"]["Enums"]["notice_priority"];
export type NoticeStatus = Database["public"]["Enums"]["notice_status"];
export type NoticeAudience = Database["public"]["Enums"]["notice_audience_type"];

export const noticePriorityLabel: Record<NoticePriority, string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  emergency: "Emergency",
};
export const noticePriorityOptions = Object.keys(noticePriorityLabel) as NoticePriority[];

export const noticeAudienceLabel: Record<Extract<NoticeAudience, "all_tenants" | "owner_manager_only">, string> = {
  all_tenants: "All tenants in the building",
  owner_manager_only: "Owner and managers only",
};

export type ManagerNotice = {
  id: string;
  notice_number: string;
  building_id: string;
  building_name: string;
  title: string;
  content: string;
  priority: NoticePriority;
  status: NoticeStatus;
  audience_type: NoticeAudience;
  published_at: string | null;
  created_at: string;
};

const NOTICE_COLUMNS =
  "id, notice_number, building_id, title, content, priority, status, audience_type, published_at, created_at, buildings(name)";

function mapNotice(raw: unknown): ManagerNotice {
  const row = raw as Record<string, unknown> & { buildings?: { name: string } | null };
  return {
    id: row["id"] as string,
    notice_number: row["notice_number"] as string,
    building_id: row["building_id"] as string,
    building_name: row.buildings?.name ?? "—",
    title: row["title"] as string,
    content: row["content"] as string,
    priority: row["priority"] as NoticePriority,
    status: row["status"] as NoticeStatus,
    audience_type: row["audience_type"] as NoticeAudience,
    published_at: (row["published_at"] as string | null) ?? null,
    created_at: row["created_at"] as string,
  };
}

export function useManagerNotices(buildingId: string) {
  const { session } = useAuth();
  const state = useAsyncState<ManagerNotice[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      let query = supabase.from("building_notices").select(NOTICE_COLUMNS).order("created_at", { ascending: false });
      if (buildingId && buildingId !== "all") query = query.eq("building_id", buildingId);

      const { data, error } = await query;
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }
      state.setData((data ?? []).map(mapNotice));
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { notices: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

export function describeNoticeError(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "You are not allowed to create notices for this building.";
  }
  return message;
}

export type NoticeInput = {
  buildingId: string;
  title: string;
  content: string;
  priority: NoticePriority;
  audienceType: Extract<NoticeAudience, "all_tenants" | "owner_manager_only">;
};

/** Creates a draft notice and immediately publishes it — the manager UI has
 * no separate draft-review step, matching the ported Sanjida flow where a
 * new notice posts straight to the board. */
export async function createAndPublishNotice(input: NoticeInput) {
  if (!input.title.trim() || !input.content.trim()) {
    throw new Error("Title and content are required.");
  }
  const { data, error } = await supabase.rpc("notice_create", {
    _building_id: input.buildingId,
    _title: input.title.trim(),
    _content: input.content.trim(),
    _priority: input.priority,
    _audience_type: input.audienceType,
    _requires_acknowledgement: false,
  });
  if (error) throw new Error(describeNoticeError(error.message));

  const notice = data as { id: string };
  const { error: publishError } = await supabase.rpc("notice_publish", { _notice_id: notice.id, _confirmed: true });
  if (publishError) throw new Error(describeNoticeError(publishError.message));
}
