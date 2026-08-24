import { useCallback, useEffect, useState } from "react";
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
import { Check, Lock, Plus } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { ManagerMonthPicker } from "@/components/manager-month-picker";
import { useManagerBuildings, currentMonthInput, formatBDT } from "@/lib/manager/shared";
import {
  bulkChargeTypes,
  flatChargeLabel,
  isMonthClosed,
  saveFlatCharges,
  sharedCategoryLabel,
  sharedCategoryOptions,
  useBillEntryRows,
  useSharedCharges,
  createSharedCharge,
  type BillEntryRow,
  type FlatChargeType,
  type SharedChargeCategory,
} from "@/lib/manager/bills";

/**
 * Manager bill entry. Ported visually from the Sanjida reference's
 * app/(manager)/charges.tsx + app/(manager)/utilities.tsx, replaced with the
 * real assigned-building/month workflow from the web app's
 * src/components/bills/bills-page.tsx: per-flat charge entry into
 * `flat_bill_charges` (locked once a payment is pending/verified for that
 * month) and shared charges split via the `allocate_shared_charge` RPC. The
 * reference's client-side "divide total by unit count" utility splitter is
 * not ported — the real split is computed and stored server-side.
 */
export default function ManagerBills() {
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useManagerBuildings();
  const [buildingId, setBuildingId] = useState("");
  const [month, setMonth] = useState(currentMonthInput());
  const [monthClosed, setMonthClosed] = useState(false);
  const [checkingClosed, setCheckingClosed] = useState(false);

  useEffect(() => {
    if (!buildingId && buildings.length > 0) setBuildingId(buildings[0].id);
  }, [buildings, buildingId]);

  const { rows, loading, refreshing, error, refresh } = useBillEntryRows(buildingId, month);
  const { charges, loading: chargesLoading, refresh: refreshShared } = useSharedCharges(buildingId, month);

  useEffect(() => {
    let active = true;
    if (!buildingId || !month) return;
    setCheckingClosed(true);
    isMonthClosed(buildingId, month)
      .then((closed) => {
        if (active) setMonthClosed(closed);
      })
      .catch(() => {
        if (active) setMonthClosed(false);
      })
      .finally(() => {
        if (active) setCheckingClosed(false);
      });
    return () => {
      active = false;
    };
  }, [buildingId, month]);

  const [editing, setEditing] = useState<BillEntryRow | null>(null);
  const [sharedModalVisible, setSharedModalVisible] = useState(false);

  function refreshAll() {
    refresh();
    refreshShared();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Bills</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Enter flat bills and shared charges</Text>
      </View>

      {buildingsLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
      ) : buildings.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textSub, padding: 20 }]}>No building assigned yet.</Text>
      ) : (
        <>
          <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} />
          <ManagerMonthPicker month={month} onChange={setMonth} />

          {monthClosed ? (
            <View style={[styles.lockedBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}>
              <Lock color={colors.warning} size={16} />
              <Text style={[styles.lockedText, { color: colors.warning }]}>
                This billing month is closed. Ask the building owner to reopen it before changing bills.
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.scrollArea}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.primary} />}
          >
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Flat bills</Text>
            {loading || checkingClosed ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
            ) : error ? (
              <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
            ) : rows.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSub }]}>No rent records for this building and month yet.</Text>
            ) : (
              <View style={styles.list}>
                {rows.map((row) => {
                  const enteredCount = Object.keys(row.amounts).length;
                  return (
                    <TouchableOpacity
                      key={row.rentRecordId}
                      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                      disabled={monthClosed}
                      onPress={() => setEditing(row)}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderText}>
                          <Text style={[styles.flatText, { color: colors.text }]}>Flat {row.flatNumber}</Text>
                          <Text style={[styles.tenantName, { color: colors.textSub }]}>{row.tenantName}</Text>
                        </View>
                        {row.locked ? <Lock color={colors.warning} size={16} /> : null}
                      </View>
                      <Text style={[styles.chargesSummary, { color: colors.textSub }]}>
                        {enteredCount} of {bulkChargeTypes.length} charge types entered
                      </Text>
                      <Text style={[styles.payableText, { color: colors.primary }]}>{formatBDT(row.totalPayable)} total payable</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.sharedHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textSub, paddingHorizontal: 0, marginTop: 0 }]}>Shared charges</Text>
              {!monthClosed ? (
                <TouchableOpacity
                  style={[styles.addChip, { backgroundColor: colors.primary }]}
                  onPress={() => setSharedModalVisible(true)}
                >
                  <Plus color="#ffffff" size={14} />
                  <Text style={styles.addChipText}>Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {chargesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : charges.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSub }]}>No shared charges added for this month yet.</Text>
            ) : (
              <View style={[styles.list, { marginBottom: 40 }]}>
                {charges.map((charge) => (
                  <View key={charge.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.flatText, { color: colors.text }]}>{sharedCategoryLabel[charge.category]}</Text>
                      <Text style={[styles.payableText, { color: colors.text }]}>{formatBDT(charge.total_amount)}</Text>
                    </View>
                    {charge.description ? (
                      <Text style={[styles.chargesSummary, { color: colors.textSub }]}>{charge.description}</Text>
                    ) : null}
                    <Text style={[styles.chargesSummary, { color: colors.textSub }]}>
                      Split across {charge.allocations.length} flat{charge.allocations.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </>
      )}

      <EditChargesModal
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <AddSharedChargeModal
        visible={sharedModalVisible}
        buildingId={buildingId}
        month={month}
        onClose={() => setSharedModalVisible(false)}
        onSaved={() => {
          setSharedModalVisible(false);
          refreshShared();
        }}
      />
    </View>
  );
}

function EditChargesModal({ row, onClose, onSaved }: { row: BillEntryRow | null; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const [amounts, setAmounts] = useState<Partial<Record<FlatChargeType, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const next: Partial<Record<FlatChargeType, string>> = {};
    for (const type of bulkChargeTypes) {
      if (row.amounts[type] != null) next[type] = String(row.amounts[type]);
    }
    setAmounts(next);
  }, [row]);

  if (!row) return null;

  async function handleSave() {
    if (!row) return;
    setSaving(true);
    try {
      await saveFlatCharges(row, amounts);
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not save", submissionError instanceof Error ? submissionError.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Flat {row.flatNumber} charges</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            {row.locked ? (
              <View style={[styles.lockedBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning, marginHorizontal: 0 }]}>
                <Lock color={colors.warning} size={16} />
                <Text style={[styles.lockedText, { color: colors.warning }]}>{row.lockReason}</Text>
              </View>
            ) : null}

            {bulkChargeTypes.map((type) => (
              <View key={type}>
                <Text style={[styles.label, { color: colors.text }]}>{flatChargeLabel[type]} (৳)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={amounts[type] ?? ""}
                  onChangeText={(text) => setAmounts((prev) => ({ ...prev, [type]: text }))}
                  keyboardType="decimal-pad"
                  placeholder="Leave blank to remove"
                  placeholderTextColor={colors.textSub}
                  editable={!row.locked}
                />
              </View>
            ))}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, (saving || row.locked) && styles.disabled]}
              onPress={handleSave}
              disabled={saving || row.locked}
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save charges</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddSharedChargeModal({
  visible,
  buildingId,
  month,
  onClose,
  onSaved,
}: {
  visible: boolean;
  buildingId: string;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [category, setCategory] = useState<SharedChargeCategory>("guard_salary");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await createSharedCharge({ buildingId, monthInput: month, category, totalAmount: Number(amount), description });
      setAmount("");
      setDescription("");
      setCategory("guard_salary");
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not add shared charge", submissionError instanceof Error ? submissionError.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }, [buildingId, month, category, amount, description, onSaved]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add shared charge</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={styles.categoryRow}>
              {sharedCategoryOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.categoryBtn,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    category === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                  ]}
                  onPress={() => setCategory(option)}
                >
                  <Text style={[styles.categoryText, { color: colors.textSub }, category === option && { color: colors.primary }]}>
                    {sharedCategoryLabel[option]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Total amount (৳)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 18000"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Note (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note"
              placeholderTextColor={colors.textSub}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && styles.disabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Check color="#ffffff" size={18} />
                  <Text style={styles.submitBtnText}>Add and split across flats</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
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

  lockedBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  lockedText: { flex: 1, fontSize: 12, fontWeight: "600" },

  sectionTitle: { fontSize: 13, fontWeight: "700", paddingHorizontal: 20, marginTop: 8, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 },
  sharedHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  addChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 10 },
  addChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 20, gap: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardHeaderText: { flex: 1 },
  flatText: { fontSize: 15, fontWeight: "800" },
  tenantName: { fontSize: 13, marginTop: 2 },
  chargesSummary: { fontSize: 12, marginTop: 8 },
  payableText: { fontSize: 14, fontWeight: "800", marginTop: 6 },

  emptyText: { textAlign: "center", marginTop: 12, marginHorizontal: 20, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },

  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryBtn: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, borderWidth: 1 },
  categoryText: { fontSize: 12, fontWeight: "600" },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  disabled: { opacity: 0.6 },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
