import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { useManagerBuildings, formatDateSafe } from "@/lib/manager/shared";
import { maintenanceCategoryLabel, maintenanceStatusLabel, useManagerMaintenance, type MaintenanceStatusFilter } from "@/lib/manager/maintenance";

const statusFilters: MaintenanceStatusFilter[] = ["open", "resolved", "closed", "all"];
const statusFilterLabel: Record<string, string> = { open: "Open", resolved: "Resolved", closed: "Closed", all: "All" };

/**
 * Manager maintenance queue for assigned buildings. Ported visually from the
 * Sanjida reference's app/(manager)/maintenance.tsx (card list, status
 * badge), backed by the real RLS-scoped `maintenance_requests` query and
 * navigating to maintenance-details.tsx for status changes and work orders
 * (the reference's direct "tap to advance status" button is replaced with a
 * dedicated detail screen since real transitions have more than two steps —
 * see lib/manager/maintenance.ts's allowedTransitions map).
 */
export default function ManagerMaintenance() {
  const router = useRouter();
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useManagerBuildings();
  const [buildingId, setBuildingId] = useState("all");
  const [status, setStatus] = useState<MaintenanceStatusFilter>("open");
  const { requests, loading, refreshing, error, refresh } = useManagerMaintenance(buildingId, status);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/*
        Single root ScrollView: the header, building selector, status
        filters, and the loading/error/empty/list content all live inside
        this one vertical scroll surface, so a swipe starting anywhere on
        the screen — not just over the card list — scrolls the whole page.
        Previously the header/picker/filter row sat outside a second,
        separate ScrollView that only wrapped the card list, which is what
        made the screen appear to scroll "only in the bottom half" (matches
        the same fix applied to app/(owner)/maintenance.tsx).
      */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Maintenance</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>Requests for your buildings</Text>
        </View>

        {buildingsLoading ? null : <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} includeAll />}

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {statusFilters.map((option) => {
            const active = option === status;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.filterPill,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setStatus(option)}
              >
                <Text style={[styles.filterPillText, { color: colors.text }, active && { color: "#ffffff" }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                  {statusFilterLabel[option]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : requests.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No maintenance requests found.</Text>
        ) : (
          <View style={styles.list}>
            {requests.map((req) => {
              const isDone = req.status === "resolved" || req.status === "closed";
              return (
                <TouchableOpacity
                  key={req.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/(manager)/maintenance-details", params: { id: req.id } })}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.titleBox}>
                      <Wrench color={colors.primary} size={16} />
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{req.title}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        isDone ? { backgroundColor: colors.successBg, borderColor: colors.success } : { backgroundColor: colors.warningBg, borderColor: colors.warning },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: isDone ? colors.success : colors.warning }]}>{maintenanceStatusLabel[req.status]}</Text>
                    </View>
                  </View>
                  <Text style={[styles.subLine, { color: colors.textSub }]}>
                    {req.building_name} · {req.is_common_area ? "Common area" : req.flat_number ? `Flat ${req.flat_number}` : "—"}
                    {req.tenant_name ? ` · ${req.tenant_name}` : ""}
                  </Text>
                  <View style={styles.tagRow}>
                    <Text style={[styles.tag, { backgroundColor: colors.surface, color: colors.textSub }]}>{maintenanceCategoryLabel[req.category]}</Text>
                    <Text style={[styles.tag, { backgroundColor: colors.surface, color: colors.textSub }]}>{req.priority}</Text>
                  </View>
                  <Text style={[styles.metaText, { color: colors.textSub }]}>
                    {req.request_number} · {formatDateSafe(req.created_at)}
                    {req.assignee_name ? ` · Assigned to ${req.assignee_name}` : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Explicit paddingLeft/paddingRight (rather than the paddingHorizontal
  // shorthand) so the leading chip reliably starts fully on-screen instead
  // of being partly clipped by the horizontal ScrollView's edge on Android.
  filterRow: { paddingLeft: 20, paddingRight: 20, gap: 8, paddingVertical: 12, alignItems: "center" },
  filterPill: { paddingHorizontal: 14, minHeight: 36, justifyContent: "center", borderRadius: 12, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: "700" },

  list: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 },
  titleBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  subLine: { fontSize: 12, marginBottom: 10 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, fontSize: 11, overflow: "hidden", textTransform: "capitalize" },
  metaText: { fontSize: 11 },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },
});
