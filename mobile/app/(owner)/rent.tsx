import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FileText, Lock, Unlock } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { ManagerMonthPicker } from "@/components/manager-month-picker";
import { useOwnerBuildings, currentMonthInput, formatBDT, monthToDate, formatMonthLabel } from "@/lib/owner/shared";
import {
  useOwnerRentRecords,
  useMonthClosure,
  generateMonthlyRent,
  closeBuildingMonth,
  reopenBuildingMonth,
  closureStatusLabel,
  paymentStatusLabel,
} from "@/lib/owner/rent";

/**
 * Owner rent generation + records + month open/closed control. Ported
 * visually from the Sanjida reference's app/(owner)/rent.tsx (stat grid +
 * record cards), replaced with the real workflow from the web app's
 * src/routes/_authenticated/owner/rent.tsx: "Generate monthly rent" creates
 * one `rent_records` row per occupied flat for the selected month (skipping
 * flats already billed — the same client orchestration the web app itself
 * uses, no accounting logic recomputed), and Close/Reopen call the
 * `close_building_month` / `reopen_building_month` RPCs, which validate
 * everything server-side (pending payments, unsplit shared charges, etc.)
 * and report back with a normal error if the month can't close yet.
 */
export default function OwnerRent() {
  const router = useRouter();
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useOwnerBuildings();
  const [buildingId, setBuildingId] = useState("all");
  const [month, setMonth] = useState(currentMonthInput());
  const { records, loading, refreshing, error, refresh } = useOwnerRentRecords(buildingId, month);
  const { status: closureStatus, refresh: refreshClosure } = useMonthClosure(buildingId, month);
  const [generating, setGenerating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closureModal, setClosureModal] = useState<"close" | "reopen" | null>(null);

  const singleBuildingSelected = buildingId !== "all";

  async function handleGenerate() {
    if (!singleBuildingSelected) {
      Alert.alert("Choose a building", "Pick one building before generating rent for it.");
      return;
    }
    setGenerating(true);
    try {
      const dueDate = `${monthToDate(month)}`;
      const result = await generateMonthlyRent({ buildingId, month, dueDate });
      Alert.alert("Rent generated", `${result.created} record(s) created, ${result.skipped} already existed.`);
      refresh();
    } catch (generateError) {
      Alert.alert("Could not generate rent", generateError instanceof Error ? generateError.message : "Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleClosureSubmit(text: string) {
    if (closureModal === "reopen" && !text.trim()) {
      Alert.alert("Reason required", "Enter why this month needs to reopen.");
      return;
    }
    setClosing(true);
    try {
      if (closureModal === "close") {
        await closeBuildingMonth(buildingId, month, text);
      } else {
        await reopenBuildingMonth(buildingId, month, text);
      }
      setClosureModal(null);
      refreshClosure();
    } catch (closureError) {
      Alert.alert(
        closureModal === "close" ? "Could not close month" : "Could not reopen month",
        closureError instanceof Error ? closureError.message : "Try again.",
      );
    } finally {
      setClosing(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Rent</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Generate and review monthly rent</Text>
      </View>

      {buildingsLoading ? null : <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} includeAll />}
      <ManagerMonthPicker month={month} onChange={setMonth} />

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }, (!singleBuildingSelected || generating) && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={!singleBuildingSelected || generating}
        >
          {generating ? <ActivityIndicator color="#ffffff" size="small" /> : <FileText color="#ffffff" size={15} />}
          <Text style={styles.actionBtnText} maxFontSizeMultiplier={1.3} numberOfLines={1}>Generate rent</Text>
        </TouchableOpacity>

        {singleBuildingSelected ? (
          closureStatus === "open" ? (
            <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: colors.warning }]} onPress={() => setClosureModal("close")} disabled={closing}>
              {closing ? <ActivityIndicator color={colors.warning} size="small" /> : <Lock color={colors.warning} size={15} />}
              <Text style={[styles.actionBtnOutlineText, { color: colors.warning }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Close month</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtnOutline, { borderColor: colors.primary }]} onPress={() => setClosureModal("reopen")} disabled={closing}>
              {closing ? <ActivityIndicator color={colors.primary} size="small" /> : <Unlock color={colors.primary} size={15} />}
              <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Reopen</Text>
            </TouchableOpacity>
          )
        ) : null}
      </View>

      {singleBuildingSelected ? (
        <View style={[styles.statusBanner, closureStatus === "open" ? { backgroundColor: colors.successBg } : { backgroundColor: colors.warningBg }]}>
          <Text style={[styles.statusText, { color: closureStatus === "open" ? colors.success : colors.warning }]} maxFontSizeMultiplier={1.3}>
            {formatMonthLabel(monthToDate(month))} is {closureStatusLabel[closureStatus].toLowerCase()}
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : records.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No rent records for this selection yet.</Text>
        ) : (
          <View style={[styles.list, { marginBottom: 20 }]}>
            {records.map((record) => {
              const isPaid = record.payment_status === "paid";
              const tone = isPaid
                ? { backgroundColor: colors.successBg, borderColor: colors.success, color: colors.success }
                : record.payment_status === "overdue"
                  ? { backgroundColor: colors.dangerBg, borderColor: colors.danger, color: colors.danger }
                  : { backgroundColor: colors.warningBg, borderColor: colors.warning, color: colors.warning };
              return (
                <View key={record.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tenantName, { color: colors.text }]}>{record.tenant_name}</Text>
                      <Text style={[styles.flatText, { color: colors.textSub }]}>{record.building_name} · Flat {record.flat_number}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
                      <Text style={[styles.badgeText, { color: tone.color }]}>{paymentStatusLabel[record.payment_status]}</Text>
                    </View>
                  </View>
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[styles.amountText, { color: colors.text }]}>{formatBDT(record.total_payable)}</Text>
                    <Text style={[styles.dueText, { color: colors.textSub }]}>
                      Paid {formatBDT(record.total_paid)} · Due {formatBDT(record.remaining_due)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={[styles.billsLink, { backgroundColor: colors.surface }]} onPress={() => router.push("/(owner)/bills")}>
          <Text style={[styles.billsLinkText, { color: colors.primary }]} maxFontSizeMultiplier={1.3}>Enter flat bills & shared charges →</Text>
        </TouchableOpacity>
      </ScrollView>

      <ClosureModal mode={closureModal} saving={closing} onClose={() => setClosureModal(null)} onSubmit={handleClosureSubmit} />
    </View>
  );
}

function ClosureModal({
  mode,
  saving,
  onClose,
  onSubmit,
}: {
  mode: "close" | "reopen" | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const colors = useThemeColors();
  const [text, setText] = useState("");

  if (!mode) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{mode === "close" ? "Close this month" : "Reopen this month"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.close, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{mode === "close" ? "Note (optional)" : "Reason (required)"}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={text}
            onChangeText={setText}
            placeholder={mode === "close" ? "Optional closing note" : "Why does this month need to reopen?"}
            placeholderTextColor={colors.textSub}
            multiline
          />

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 20 }, saving && { opacity: 0.6 }]}
            onPress={() => onSubmit(text)}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.actionBtnText}>{mode === "close" ? "Close month" : "Reopen month"}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 12 },
  actionBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  actionBtnOutline: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 44, borderRadius: 12, borderWidth: 1 },
  actionBtnOutlineText: { fontSize: 13, fontWeight: "700" },

  statusBanner: { marginHorizontal: 20, marginTop: 12, padding: 10, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: "700", textAlign: "center" },

  list: { padding: 20, gap: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 12 },
  tenantName: { fontSize: 15, fontWeight: "800" },
  flatText: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  // flexWrap lets the paid/due text drop to its own line instead of being
  // clipped alongside the payable amount when both don't fit one row.
  cardFooter: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", rowGap: 4, borderTopWidth: 1, paddingTop: 10 },
  amountText: { fontSize: 15, fontWeight: "800", flexShrink: 0 },
  dueText: { fontSize: 12 },

  billsLink: { marginHorizontal: 20, padding: 14, borderRadius: 12, alignItems: "center" },
  billsLinkText: { fontSize: 13, fontWeight: "700" },

  emptyText: { textAlign: "center", marginTop: 20, marginHorizontal: 20, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
});
