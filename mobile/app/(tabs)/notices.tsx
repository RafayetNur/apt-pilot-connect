import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

type Notice = Database["public"]["Tables"]["building_notices"]["Row"] & {
  buildings?: { name: string } | null;
};
type Acknowledgement = Database["public"]["Tables"]["notice_acknowledgements"]["Row"];
type Role = Database["public"]["Enums"]["app_role"];

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

export default function NoticesScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setRole(null);
      setNotices([]);
      setAcknowledgements([]);
      setLoading(false);
      return;
    }
    loadNotices(session.user.id);
  }, [session]);

  async function loadNotices(userId: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setRole(profile.role);
    if (profile.role !== "tenant") {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [{ data: noticeRows, error: noticesError }, { data: ackRows, error: acksError }] =
      await Promise.all([
        supabase
          .from("building_notices")
          .select("id, notice_number, building_id, title, content, priority, status, audience_type, published_at, requires_acknowledgement, expires_at, buildings(name)")
          .order("published_at", { ascending: false }),
        supabase
          .from("notice_acknowledgements")
          .select("id, notice_id, tenant_id, acknowledged_at")
          .eq("tenant_id", userId),
      ]);
    if (noticesError || acksError) {
      setError((noticesError ?? acksError)?.message ?? "Unable to load notices.");
    } else {
      setNotices((noticeRows ?? []) as Notice[]);
      setAcknowledgements(ackRows ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function acknowledge(noticeId: string) {
    setAcknowledgingId(noticeId);
    const { error: acknowledgeError } = await supabase.rpc("notice_acknowledge", {
      _notice_id: noticeId,
    });
    if (acknowledgeError) {
      Alert.alert("Could not acknowledge notice", acknowledgeError.message);
    } else if (session) {
      await loadNotices(session.user.id, true);
    }
    setAcknowledgingId(null);
  }

  if (!session) {
    return <MessageScreen title="Log in to view notices" message="Open the Home tab to log in." />;
  }
  if (!loading && role !== null && role !== "tenant") {
    return (
      <MessageScreen
        title="Notices workspace coming later"
        message="Owner and manager notices tools will be added in a future milestone."
      />
    );
  }

  const acknowledgedIds = new Set(acknowledgements.map((ack) => ack.notice_id));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => session && loadNotices(session.user.id, true)}
            tintColor="#639873"
          />
        }>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.title}>Notices</Text>
        <Text style={styles.subtitle}>Updates from your building owner or manager.</Text>

        {loading ? (
          <StateBox title="Loading notices..." loading />
        ) : error ? (
          <StateBox title="Unable to load notices" message={error} />
        ) : notices.length === 0 ? (
          <StateBox title="No notices yet" message="Notices shared with you will appear here." />
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
      </ScrollView>
    </SafeAreaView>
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
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.priority}>{priorityLabels[notice.priority]}</Text>
        <Text style={styles.number}>{notice.notice_number}</Text>
      </View>
      <Text style={styles.titleText}>{notice.title}</Text>
      <Text style={styles.metadata}>
        {notice.buildings?.name ?? "Building information unavailable"} · {audienceLabels[notice.audience_type]}
      </Text>
      <Text style={styles.metadata}>
        Published {formatDate(notice.published_at)}
        {notice.expires_at ? ` · Until ${formatDate(notice.expires_at)}` : ""}
      </Text>
      <Text style={styles.contentText}>{notice.content}</Text>
      {notice.requires_acknowledgement ? (
        acknowledged ? (
          <Text style={styles.acknowledged}>Acknowledged</Text>
        ) : (
          <Pressable style={styles.button} onPress={onAcknowledge} disabled={acknowledging}>
            {acknowledging ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>I have read this</Text>
            )}
          </Pressable>
        )
      ) : null}
    </View>
  );
}

function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.messageScreen}>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function StateBox({ title, message, loading = false }: { title: string; message?: string; loading?: boolean }) {
  return (
    <View style={styles.stateBox}>
      {loading ? <ActivityIndicator color="#639873" size="large" /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateText}>{message}</Text> : null}
    </View>
  );
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "Not published";
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF7F2" },
  content: { padding: 24, paddingBottom: 44 },
  eyebrow: { color: "#639873", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 8, color: "#292332", fontSize: 36, fontWeight: "800" },
  subtitle: { marginTop: 8, marginBottom: 22, color: "#777184", fontSize: 16 },
  stateBox: { padding: 22, marginBottom: 16, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center" },
  stateTitle: { marginTop: 8, color: "#292332", fontSize: 17, fontWeight: "800", textAlign: "center" },
  stateText: { marginTop: 8, color: "#777184", fontSize: 14, lineHeight: 20, textAlign: "center" },
  card: { marginBottom: 12, padding: 18, borderWidth: 1, borderColor: "#E8E0D8", borderRadius: 16, backgroundColor: "#FFFFFF" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  priority: { color: "#639873", fontSize: 12, fontWeight: "800" },
  number: { color: "#8A8492", fontSize: 12 },
  titleText: { marginTop: 10, color: "#292332", fontSize: 19, fontWeight: "800" },
  metadata: { marginTop: 6, color: "#777184", fontSize: 12, lineHeight: 18 },
  contentText: { marginTop: 15, color: "#3B3543", fontSize: 15, lineHeight: 23 },
  button: { height: 48, marginTop: 16, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#639873" },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  acknowledged: { marginTop: 16, color: "#639873", fontSize: 14, fontWeight: "800" },
  messageScreen: { flex: 1, justifyContent: "center", padding: 26 },
  messageTitle: { marginTop: 12, color: "#292332", fontSize: 27, fontWeight: "800" },
  messageText: { marginTop: 10, color: "#777184", fontSize: 16, lineHeight: 23 },
});
