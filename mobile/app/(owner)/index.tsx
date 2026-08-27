import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AlertTriangle,
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  Receipt,
  Users,
  Wrench,
} from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOwnerDashboard } from "@/lib/owner/dashboard";
import { currentMonthInput, formatBDT, formatMonthLabel, monthToDate } from "@/lib/owner/shared";
import { ManagerMonthPicker } from "@/components/manager-month-picker";

/**
 * Owner dashboard. Ported visually from the Sanjida reference's
 * app/(owner)/index.tsx (header card, stats grid, quick-actions grid) and
 * the manager mobile dashboard's month-scoped layout, driven by
 * useOwnerDashboard(month) — the same buildings / flats / rent_records /
 * rent_payments / tenant_credits / maintenance_requests query shape as the
 * web app's src/routes/_authenticated/owner/dashboard.tsx, RLS-scoped to
 * buildings this owner owns. The reference's hardcoded "Green View
 * Apartments" building name, fixed "Ayesha Rahman" manager box and
 * fabricated 9/10 occupancy figure are dropped for real, per-owner numbers.
 */
export default function OwnerDashboard() {
  const router = useRouter();
  const colors = useThemeColors();
  const { profile } = useAuth();
  const [month, setMonth] = useState(currentMonthInput());
  const { data, loading, refreshing, error, refresh } = useOwnerDashboard(month);
  // Local presentation state only — collapses the snapshot card to its 4
  // headline metrics so the physical phone isn't showing 8 stats plus a
  // pending-verification banner at once. No data is dropped: everything
  // below still renders, just behind "See more".
  const [snapshotExpanded, setSnapshotExpanded] = useState(false);

  const quickActions = [
    { label: "Properties", icon: Building2, route: "/(owner)/properties" as const },
    { label: "Generate rent", icon: FileText, route: "/(owner)/rent" as const },
    { label: "Review payments", icon: CreditCard, route: "/(owner)/payments" as const },
    { label: "Maintenance", icon: Wrench, route: "/(owner)/maintenance" as const },
    { label: "Expenses", icon: Receipt, route: "/(owner)/expenses" as const },
    { label: "Managers", icon: Users, route: "/(owner)/managers" as const },
    { label: "Notices", icon: Bell, route: "/(owner)/notices" as const },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.greeting, { color: colors.textSub }]} maxFontSizeMultiplier={1.3}>Owner workspace</Text>
        <Text style={[styles.name, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{profile?.full_name || "there"}</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Everything below covers only buildings you own</Text>
      </View>

      <ManagerMonthPicker month={month} onChange={setMonth} />

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Unable to load dashboard</Text>
          <Text style={[styles.stateText, { color: colors.textSub }]}>{error}</Text>
        </View>
      ) : !data || data.totals.totalBuildings === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stateTitle, { color: colors.text }]}>No buildings yet</Text>
          <Text style={[styles.stateText, { color: colors.textSub }]}>Add your first building to start tracking rent and expenses.</Text>
          <TouchableOpacity
            style={[styles.addBuildingBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(owner)/properties")}
          >
            <Text style={styles.addBuildingBtnText}>Add a building</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{formatMonthLabel(monthToDate(month))} snapshot</Text>

            <View style={styles.statsGrid}>
              <Stat label="Buildings" value={String(data.totals.totalBuildings)} colors={colors} />
              <Stat label="Flats" value={`${data.totals.occupied}/${data.totals.totalFlats}`} hint="occupied" colors={colors} />
              <Stat label="Total payable" value={formatBDT(data.totals.totalPayable)} colors={colors} />
              <Stat label="Verified collection" value={formatBDT(data.totals.collected)} colors={colors} tone="success" />
            </View>

            {snapshotExpanded ? (
              <>
                <View style={[styles.statsGrid, { marginTop: 0 }]}>
                  <Stat label="Remaining due" value={formatBDT(data.totals.remaining)} colors={colors} tone="danger" />
                  <Stat label="Overdue" value={formatBDT(data.totals.overdue)} colors={colors} tone="danger" />
                  <Stat label="Tenant credit" value={formatBDT(data.totals.availableCredit)} colors={colors} />
                  <Stat label="Open maintenance" value={String(data.totals.openMaintenance)} hint={data.totals.emergencyMaintenance > 0 ? `${data.totals.emergencyMaintenance} emergency` : undefined} colors={colors} tone={data.totals.emergencyMaintenance > 0 ? "danger" : undefined} />
                </View>

                <TouchableOpacity
                  style={[styles.statusPill, { backgroundColor: colors.surface, borderColor: colors.primary }]}
                  onPress={() => router.push("/(owner)/payments")}
                >
                  <Text style={[styles.statusPillText, { color: colors.primary }]}>
                    {data.totals.pendingVerifications} payment{data.totals.pendingVerifications === 1 ? "" : "s"} pending verification
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity
              style={styles.seeMoreBtn}
              onPress={() => setSnapshotExpanded((expanded) => !expanded)}
            >
              <Text style={[styles.seeMoreText, { color: colors.primary }]} maxFontSizeMultiplier={1.3}>
                {snapshotExpanded ? "See less" : "See more"}
              </Text>
              {snapshotExpanded ? <ChevronUp color={colors.primary} size={16} /> : <ChevronDown color={colors.primary} size={16} />}
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Quick actions</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(action.route)}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                  <action.icon color={colors.primary} size={22} />
                </View>
                <Text style={[styles.actionText, { color: colors.text }]} numberOfLines={2}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Building-wise summary</Text>
          <View style={styles.list}>
            {data.buildingSummaries.map((row) => (
              <View key={row.id} style={[styles.buildingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.buildingName, { color: colors.text }]}>{row.name}</Text>
                <Text style={[styles.buildingMeta, { color: colors.textSub }]}>{row.occupied}/{row.totalFlats} occupied</Text>
                <View style={styles.buildingStatsRow}>
                  <BuildingStat label="Payable" value={formatBDT(row.payable)} colors={colors} />
                  <BuildingStat label="Collected" value={formatBDT(row.collected)} colors={colors} />
                  <BuildingStat label="Remaining" value={formatBDT(row.remaining)} colors={colors} tone="danger" />
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Bills needing entry</Text>
          {data.needsChargeEntry.length === 0 ? (
            <EmptyRow colors={colors} text="Every billed flat has at least one charge recorded for this month." />
          ) : (
            <View style={styles.list}>
              {data.needsChargeEntry.slice(0, 8).map((row) => (
                <View key={row.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <AlertTriangle color={colors.warning} size={16} />
                  <Text style={[styles.rowCardText, { color: colors.text }]}>
                    {row.building_name} · Flat {row.flat_number} · {row.tenant_name}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Recent payment submissions</Text>
          {data.recentSubmissions.length === 0 ? (
            <EmptyRow colors={colors} text="No payment has been submitted yet." />
          ) : (
            <View style={[styles.list, { marginBottom: 40 }]}>
              {data.recentSubmissions.map((payment) => (
                <View key={payment.id} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.rowCardText, { color: colors.text }]}>
                    {payment.tenant_name} · Flat {payment.flat_number} · {formatBDT(payment.amount_paid)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, hint, colors, tone }: { label: string; value: string; hint?: string; colors: ReturnType<typeof useThemeColors>; tone?: "success" | "danger" }) {
  const valueColor = tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.text;
  return (
    <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: colors.textSub }]} maxFontSizeMultiplier={1.3}>{hint}</Text> : null}
    </View>
  );
}

function BuildingStat({ label, value, colors, tone }: { label: string; value: string; colors: ReturnType<typeof useThemeColors>; tone?: "danger" }) {
  return (
    <View style={styles.buildingStat}>
      <Text style={[styles.buildingStatLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <Text style={[styles.buildingStatValue, { color: tone === "danger" ? colors.danger : colors.text }]}>{value}</Text>
    </View>
  );
}

function EmptyRow({ colors, text }: { colors: ReturnType<typeof useThemeColors>; text: string }) {
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.emptyText, { color: colors.textSub }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16 },
  greeting: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  name: { fontSize: 24, fontWeight: "800", marginTop: 4 },
  subtitle: { fontSize: 13, marginTop: 4 },

  stateBox: { padding: 40, alignItems: "center" },
  stateTitle: { fontSize: 17, fontWeight: "800" },
  stateText: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  addBuildingBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  addBuildingBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },

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
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: 16 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  // minWidth + flexGrow (instead of a fixed width) lets a box widen past
  // 47% — up to the full row — when enlarged text can't fit two per row,
  // instead of clipping the currency value inside a fixed-width box.
  statBox: { minWidth: 140, flexGrow: 1, flexBasis: "47%", padding: 14, borderRadius: 16, borderWidth: 1 },
  statLabel: { fontSize: 12, fontWeight: "500" },
  statValue: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  statHint: { fontSize: 11, marginTop: 2 },

  statusPill: { borderRadius: 12, padding: 12, minHeight: 44, justifyContent: "center", borderWidth: 1, marginBottom: 12 },
  statusPillText: { fontSize: 13, fontWeight: "600" },

  seeMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 40, alignSelf: "center", paddingHorizontal: 12 },
  seeMoreText: { fontSize: 13, fontWeight: "700" },

  sectionTitle: { fontSize: 13, fontWeight: "700", paddingHorizontal: 20, marginTop: 12, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  actionCard: { flexGrow: 1, flexBasis: "30%", minWidth: 96, padding: 14, borderRadius: 18, alignItems: "flex-start", gap: 10, borderWidth: 1 },
  iconBox: { padding: 9, borderRadius: 12 },
  actionText: { fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },

  buildingCard: { borderRadius: 18, padding: 16, borderWidth: 1 },
  buildingName: { fontSize: 15, fontWeight: "800" },
  buildingMeta: { fontSize: 12, marginTop: 2 },
  buildingStatsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  buildingStat: { flex: 1 },
  buildingStatLabel: { fontSize: 11, fontWeight: "600" },
  buildingStatValue: { fontSize: 13, fontWeight: "800", marginTop: 2 },

  rowCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  rowCardText: { flex: 1, fontSize: 13, fontWeight: "600" },

  emptyState: { marginHorizontal: 20, padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  emptyText: { fontSize: 13, textAlign: "center" },
});
