import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CreditCard, MessageCircleWarning, Sparkles, User } from "lucide-react-native";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

type RentRow = Pick<
  Database["public"]["Tables"]["rent_records"]["Row"],
  "billing_month" | "total_payable" | "total_paid" | "remaining_due" | "payment_status" | "due_date"
>;
type FlatLocation = { id: string; flat_number: string; building_id: string; building_name: string };
type NoticePreview = Pick<
  Database["public"]["Tables"]["building_notices"]["Row"],
  "id" | "title" | "content" | "priority" | "published_at"
>;

/**
 * Ported from the Sanjida reference's app/(tenant)/index.tsx (dashboard
 * card, quick services row, notices list), driving its data from the exact
 * same live queries as the currently-tested mobile/app/(tabs)/index.tsx —
 * profile + flat + building + latest rent record — via Supabase, instead of
 * the reference's mock rentRecords/announcements store.
 */
export default function TenantDashboard() {
  const router = useRouter();
  const colors = useThemeColors();
  const { session, profile } = useAuth();

  const [location, setLocation] = useState<FlatLocation | null>(null);
  const [rent, setRent] = useState<RentRow | null>(null);
  const [notices, setNotices] = useState<NoticePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      const userId = session.user.id;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const { data: flat, error: flatError } = await supabase
        .from("flats")
        .select("id, flat_number, building_id")
        .eq("tenant_id", userId)
        .maybeSingle();

      if (flatError) {
        setError(flatError.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!flat) {
        setLocation(null);
        setRent(null);
        setNotices([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [{ data: building, error: buildingError }, { data: rentRow, error: rentError }, { data: noticeRows, error: noticeError }] =
        await Promise.all([
          supabase.from("buildings").select("name").eq("id", flat.building_id).single(),
          supabase
            .from("rent_records")
            .select("billing_month, total_payable, total_paid, remaining_due, payment_status, due_date")
            .eq("tenant_id", userId)
            .eq("flat_id", flat.id)
            .order("billing_month", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("building_notices")
            .select("id, title, content, priority, published_at")
            .order("published_at", { ascending: false })
            .limit(3),
        ]);

      const loadError = buildingError ?? rentError ?? noticeError;
      if (loadError) {
        setError(loadError.message);
      } else {
        setLocation({
          id: flat.id,
          flat_number: flat.flat_number,
          building_id: flat.building_id,
          building_name: building?.name ?? "Your building",
        });
        setRent(rentRow ?? null);
        setNotices(noticeRows ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [session],
  );

  useEffect(() => {
    load();
  }, [load]);

  const isPaid = rent?.payment_status === "paid";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerText}>
          <Text style={[styles.greeting, { color: colors.textSub }]}>Welcome back</Text>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || "there"}</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>
            {location ? `Unit ${location.flat_number}` : "No assigned flat"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.profileIcon, { backgroundColor: colors.surface }]}
          onPress={() => router.push("/(tenant)/profile")}
        >
          <User color={colors.text} size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Unable to load dashboard</Text>
          <Text style={[styles.stateText, { color: colors.textSub }]}>{error}</Text>
        </View>
      ) : !location ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stateTitle, { color: colors.text }]}>No assigned flat</Text>
          <Text style={[styles.stateText, { color: colors.textSub }]}>
            Your assigned flat will appear here once a manager or owner links your account.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.textSub }]}>Bill Period</Text>
            <Text style={[styles.cardSubtitle, { color: colors.text }]}>
              {rent ? formatMonth(rent.billing_month) : "No rent record yet"}
            </Text>
          </View>
          {rent ? (
            <>
              <View style={styles.snapshotRow}>
                <View style={styles.snapshotItem}>
                  <Text style={[styles.snapshotLabel, { color: colors.textSub }]}>Total Payable</Text>
                  <Text style={[styles.snapshotValue, { color: colors.primary }]}>
                    ৳ {rent.total_payable.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.snapshotItem}>
                  <Text style={[styles.snapshotLabel, { color: colors.textSub }]}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isPaid
                        ? { backgroundColor: colors.successBg, borderColor: colors.success }
                        : { backgroundColor: colors.dangerBg, borderColor: colors.danger },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: isPaid ? colors.success : colors.danger }]}>
                      {rent.payment_status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              {!isPaid ? (
                <TouchableOpacity
                  style={[styles.payButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/(tenant)/bills")}
                >
                  <CreditCard color="#ffffff" size={20} />
                  <Text style={styles.payButtonText}>Pay Rent Now</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.paidMessage, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                  <Text style={[styles.paidMessageText, { color: colors.success }]}>Rent paid for this period</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.stateText, { color: colors.textSub }]}>No rent record available yet.</Text>
          )}
        </View>
      )}

      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Quick Services</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/(tenant)/bills")}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <CreditCard color={colors.primary} size={24} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Bills</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/(tenant)/ai")}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <Sparkles color={colors.primary} size={24} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>AptBot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/(tenant)/emergency")}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.dangerBg }]}>
            <MessageCircleWarning color={colors.danger} size={24} />
          </View>
          <Text style={[styles.actionText, { color: colors.text }]}>Emergency</Text>
        </TouchableOpacity>
      </ScrollView>

      <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Building Notices</Text>
      <View style={styles.noticesList}>
        {notices.length === 0 ? (
          <Text style={[styles.emptyNotices, { color: colors.textSub }]}>No notices yet.</Text>
        ) : (
          notices.map((notice) => (
            <View key={notice.id} style={[styles.noticeItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.noticeHeader}>
                <Text style={[styles.noticeTitle, { color: colors.text }]}>{notice.title}</Text>
                <Text style={[styles.noticeDate, { color: colors.textSub }]}>{formatDate(notice.published_at)}</Text>
              </View>
              <Text style={[styles.noticeContent, { color: colors.textSub }]} numberOfLines={2}>
                {notice.content}
              </Text>
            </View>
          ))
        )}
        <TouchableOpacity onPress={() => router.push("/(tenant)/notices")}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all notices</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function formatMonth(value: string | null | undefined) {
  // `billing_month` comes back from Supabase as a plain PostgreSQL date
  // string ("YYYY-MM-DD"), not "YYYY-MM" — appending "-01" onto it (the
  // previous logic) produced a malformed string and "Invalid Date". Parse
  // the year/month numerically instead (ignoring any day component) and
  // build the Date from local numeric parts, which also avoids any
  // UTC-parsing timezone shift. Mirrors the tested formatMonth in
  // src/lib/rent.ts (web app).
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
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, paddingBottom: 16 },
  headerText: { flex: 1 },
  profileIcon: { padding: 10, borderRadius: 20 },
  greeting: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  name: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  subtitle: { fontSize: 14, marginTop: 4 },

  stateBox: { padding: 40, alignItems: "center" },
  stateTitle: { fontSize: 17, fontWeight: "800" },
  stateText: { marginTop: 8, fontSize: 14, lineHeight: 20 },

  card: {
    margin: 20,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: "600" },
  cardSubtitle: { fontSize: 14, fontWeight: "700" },
  snapshotRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  snapshotItem: { gap: 4 },
  snapshotLabel: { fontSize: 12, fontWeight: "500" },
  snapshotValue: { fontSize: 24, fontWeight: "800" },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: "700" },

  payButton: { borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  payButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  paidMessage: { borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1 },
  paidMessageText: { fontWeight: "700", fontSize: 14 },

  sectionTitle: { fontSize: 14, fontWeight: "700", paddingHorizontal: 24, marginTop: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },

  quickActions: { flexDirection: "row", paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  actionCard: {
    width: 120,
    padding: 16,
    borderRadius: 20,
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  iconBox: { padding: 10, borderRadius: 12 },
  actionText: { fontSize: 13, fontWeight: "700" },

  noticesList: { paddingHorizontal: 20, marginBottom: 24, gap: 12 },
  emptyNotices: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  noticeItem: { padding: 16, borderRadius: 16, borderWidth: 1 },
  noticeHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, gap: 8 },
  noticeTitle: { flex: 1, fontSize: 15, fontWeight: "700" },
  noticeDate: { fontSize: 12 },
  noticeContent: { fontSize: 14, lineHeight: 20 },
  seeAll: { marginTop: 4, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
