import { useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Info } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatBDT, formatMonthLabel, monthToDate, shiftMonthInput, currentMonthInput } from "@/lib/owner/shared";
import { useOwnerSummary } from "@/lib/owner/reports";

/**
 * Owner financial rollup. Neither the Sanjida reference nor the current
 * owner mobile tab set has a Reports screen to port visually — this one
 * follows the same header/stat-grid/card language as the rest of this pass
 * (see mobile/app/(owner)/index.tsx) and is backed entirely by the
 * `report_owner_summary` SECURITY DEFINER RPC (mobile/lib/owner/reports.ts),
 * the same one the web app's Reports page calls for its owner summary card.
 *
 * The web Reports page's monthly-statement, cash-flow, outstanding-filter,
 * collection-trend, tenant-ledger, reconciliation views and CSV export are
 * not ported here — see the Owner integration report for why.
 */
export default function OwnerReports() {
  const colors = useThemeColors();
  const [toMonth, setToMonth] = useState(currentMonthInput());
  const [fromMonth, setFromMonth] = useState(shiftMonthInput(currentMonthInput(), -2));
  const { summary, loading, refreshing, error, refresh } = useOwnerSummary(fromMonth, toMonth);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Reports</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          {formatMonthLabel(monthToDate(fromMonth))} – {formatMonthLabel(monthToDate(toMonth))}
        </Text>
      </View>

      <View style={styles.rangeRow}>
        <TouchableOpacity style={[styles.rangeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setFromMonth(shiftMonthInput(fromMonth, -1))}>
          <Text style={[styles.rangeBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>− From</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rangeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setFromMonth(shiftMonthInput(fromMonth, 1))}>
          <Text style={[styles.rangeBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>+ From</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rangeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setToMonth(shiftMonthInput(toMonth, -1))}>
          <Text style={[styles.rangeBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>− To</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.rangeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setToMonth(shiftMonthInput(toMonth, 1))}>
          <Text style={[styles.rangeBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3}>+ To</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : !summary ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No data for this range yet.</Text>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <Stat label="Buildings" value={String(summary.buildings_count)} colors={colors} />
              <Stat label="Collection rate" value={`${summary.collection_rate}%`} colors={colors} />
              <Stat label="Total billed" value={formatBDT(summary.total_billed)} colors={colors} />
              <Stat label="Total collected" value={formatBDT(summary.total_collected)} colors={colors} tone="success" />
              <Stat label="Outstanding" value={formatBDT(summary.total_outstanding)} colors={colors} tone="danger" />
              <Stat label="Approved expenses" value={formatBDT(summary.approved_expenses)} colors={colors} />
              <Stat label="Cash received" value={formatBDT(summary.cash_received)} colors={colors} />
              <Stat label="Net cash" value={formatBDT(summary.net_cash)} colors={colors} tone={summary.net_cash < 0 ? "danger" : "success"} />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>By building</Text>
            {summary.by_building.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSub }]}>No buildings in this range.</Text>
            ) : (
              <View style={styles.list}>
                {summary.by_building.map((row) => (
                  <View key={row.building_id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.buildingName, { color: colors.text }]}>{row.building_name}</Text>
                    <View style={styles.buildingStatsRow}>
                      <BuildingStat label="Billed" value={formatBDT(row.billed)} colors={colors} />
                      <BuildingStat label="Collected" value={formatBDT(row.collected)} colors={colors} />
                      <BuildingStat label="Outstanding" value={formatBDT(row.outstanding)} colors={colors} tone="danger" />
                    </View>
                    <Text style={[styles.rateText, { color: colors.textSub }]}>{row.collection_rate}% collection rate · Net cash {formatBDT(row.net_cash)}</Text>
                  </View>
                ))}
              </View>
            )}

            {summary.incomplete_billing_months.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Incomplete billing months</Text>
                <View style={styles.list}>
                  {summary.incomplete_billing_months.map((row, index) => (
                    <View key={`${row.building_id}-${row.billing_month}-${index}`} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.rowCardText, { color: colors.text }]}>
                        {row.building_name} · {formatMonthLabel(row.billing_month)} · {row.rent_records}/{row.occupied_flats} billed
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {summary.closed_months_with_dues.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Closed months with dues</Text>
                <View style={[styles.list, { marginBottom: 12 }]}>
                  {summary.closed_months_with_dues.map((row, index) => (
                    <View key={`${row.building_id}-${row.billing_month}-${index}`} style={[styles.rowCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.rowCardText, { color: colors.text }]}>
                        {row.building_name} · {formatMonthLabel(row.billing_month)} · {formatBDT(row.remaining_due)} still due
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}

        <View style={[styles.noteBanner, { backgroundColor: colors.surface }]}>
          <Info color={colors.textSub} size={16} />
          <Text style={[styles.noteText, { color: colors.textSub }]}>
            Detailed statements, cash-flow trends, tenant ledgers, reconciliation and CSV export are available on the AptPilot web
            app&apos;s Reports page.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, colors, tone }: { label: string; value: string; colors: ReturnType<typeof useThemeColors>; tone?: "success" | "danger" }) {
  const valueColor = tone === "success" ? colors.success : tone === "danger" ? colors.danger : colors.text;
  return (
    <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function BuildingStat({ label, value, colors, tone }: { label: string; value: string; colors: ReturnType<typeof useThemeColors>; tone?: "danger" }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.buildingStatLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <Text style={[styles.buildingStatValue, { color: tone === "danger" ? colors.danger : colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  rangeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  rangeBtn: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, borderWidth: 1 },
  rangeBtnText: { fontSize: 12, fontWeight: "700" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  // See the same minWidth/flexGrow note on mobile/app/(owner)/index.tsx's statBox.
  statBox: { minWidth: 140, flexGrow: 1, flexBasis: "47%", padding: 14, borderRadius: 16, borderWidth: 1 },
  statLabel: { fontSize: 12, fontWeight: "500" },
  statValue: { fontSize: 16, fontWeight: "800", marginTop: 4 },

  sectionTitle: { fontSize: 13, fontWeight: "700", paddingHorizontal: 20, marginTop: 16, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  list: { paddingHorizontal: 20, gap: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  buildingName: { fontSize: 15, fontWeight: "800" },
  buildingStatsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  buildingStatLabel: { fontSize: 11, fontWeight: "600" },
  buildingStatValue: { fontSize: 13, fontWeight: "800", marginTop: 2 },
  rateText: { fontSize: 12, marginTop: 10 },

  rowCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  rowCardText: { fontSize: 13, fontWeight: "600" },

  noteBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, margin: 20, marginTop: 24, padding: 14, borderRadius: 14 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  emptyText: { textAlign: "center", marginTop: 20, marginHorizontal: 20, fontSize: 13 },
});
