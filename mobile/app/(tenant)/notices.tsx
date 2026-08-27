import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Bell } from "lucide-react-native";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

type Notice = Database["public"]["Tables"]["building_notices"]["Row"] & {
  buildings?: { name: string } | null;
};
type Acknowledgement = Database["public"]["Tables"]["notice_acknowledgements"]["Row"];

const priorityLabels: Record<Database["public"]["Enums"]["notice_priority"], string> = {
  normal: "Normal",
  important: "Important",
  urgent: "Urgent",
  emergency: "Emergency",
};
const audienceLabels: Record<Database["public"]["Enums"]["notice_audience_type"], string> = {
  all_tenants: "All tenants",
  selected_flats: "Selected flats",
  selected_tenants: "Selected tenants",
  owner_manager_only: "Owner and managers",
};

/**
 * Ported to Sanjida's visual language from the currently-tested
 * mobile/app/(tabs)/notices.tsx — same live, RLS-scoped notices query and
 * `notice_acknowledge` RPC. The Sanjida reference's mock frontend had no
 * notices screen at all; this adds one to the tenant tab bar so the feature
 * isn't lost (see AptPilot-architecture-comparison.md §9/§10).
 */
export default function TenantNotices() {
  const colors = useThemeColors();
  const { session } = useAuth();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      const userId = session.user.id;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [{ data: noticeRows, error: noticesError }, { data: ackRows, error: acksError }] = await Promise.all([
        supabase
          .from("building_notices")
          .select(
            "id, notice_number, building_id, title, content, priority, status, audience_type, published_at, requires_acknowledgement, expires_at, buildings(name)",
          )
          .order("published_at", { ascending: false }),
        supabase.from("notice_acknowledgements").select("id, notice_id, tenant_id, acknowledged_at").eq("tenant_id", userId),
      ]);

      if (noticesError || acksError) {
        setError((noticesError ?? acksError)?.message ?? "Unable to load notices.");
      } else {
        setNotices((noticeRows ?? []) as Notice[]);
        setAcknowledgements(ackRows ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [session],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function acknowledge(noticeId: string) {
    setAcknowledgingId(noticeId);
    const { error: acknowledgeError } = await supabase.rpc("notice_acknowledge", { _notice_id: noticeId });
    if (acknowledgeError) {
      Alert.alert("Could not acknowledge notice", acknowledgeError.message);
    } else {
      await load(true);
    }
    setAcknowledgingId(null);
  }

  const acknowledgedIds = new Set(acknowledgements.map((ack) => ack.notice_id));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>Notices</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Updates from your building owner or manager</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Unable to load notices</Text>
            <Text style={[styles.emptyText, { color: colors.textSub }]}>{error}</Text>
          </View>
        ) : notices.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Bell color={colors.textSub} size={28} />
            <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 10 }]}>No notices yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSub }]}>Notices shared with you will appear here.</Text>
          </View>
        ) : (
          notices.map((notice) => (
            <NoticeCard
              key={notice.id}
              notice={notice}
              acknowledged={acknowledgedIds.has(notice.id)}
              acknowledging={acknowledgingId === notice.id}
              onAcknowledge={() => acknowledge(notice.id)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function NoticeCard({
  notice,
  acknowledged,
  acknowledging,
  onAcknowledge,
}: {
  notice: Notice;
  acknowledged: boolean;
  acknowledging: boolean;
  onAcknowledge: () => void;
}) {
  const colors = useThemeColors();
  const isUrgent = notice.priority === "urgent" || notice.priority === "emergency";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.priorityBadge,
            isUrgent ? { backgroundColor: colors.dangerBg, borderColor: colors.danger } : { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.priorityText, { color: isUrgent ? colors.danger : colors.primary }]}>
            {priorityLabels[notice.priority]}
          </Text>
        </View>
        <Text style={[styles.number, { color: colors.textSub }]}>{notice.notice_number}</Text>
      </View>
      <Text style={[styles.noticeTitle, { color: colors.text }]}>{notice.title}</Text>
      <Text style={[styles.metadata, { color: colors.textSub }]}>
        {notice.buildings?.name ?? "Building information unavailable"} · {audienceLabels[notice.audience_type]}
      </Text>
      <Text style={[styles.metadata, { color: colors.textSub }]}>
        Published {formatDate(notice.published_at)}
        {notice.expires_at ? ` · Until ${formatDate(notice.expires_at)}` : ""}
      </Text>
      <Text style={[styles.contentText, { color: colors.text }]}>{notice.content}</Text>

      {notice.requires_acknowledgement ? (
        acknowledged ? (
          <Text style={[styles.acknowledged, { color: colors.success }]}>Acknowledged</Text>
        ) : (
          <TouchableOpacity style={[styles.ackButton, { backgroundColor: colors.primary }]} onPress={onAcknowledge} disabled={acknowledging}>
            {acknowledging ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.ackButtonText}>I have read this</Text>}
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not published";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },

  content: { padding: 20, paddingBottom: 40, gap: 12 },

  emptyState: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyText: { marginTop: 6, fontSize: 14, textAlign: "center", lineHeight: 20 },

  card: { padding: 18, borderWidth: 1, borderRadius: 20 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  priorityText: { fontSize: 12, fontWeight: "800" },
  number: { fontSize: 12 },
  noticeTitle: { marginTop: 12, fontSize: 18, fontWeight: "800" },
  metadata: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  contentText: { marginTop: 14, fontSize: 15, lineHeight: 22 },

  ackButton: { height: 46, marginTop: 16, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ackButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  acknowledged: { marginTop: 16, fontSize: 13, fontWeight: "800" },
});
