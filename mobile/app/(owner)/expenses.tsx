import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
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
import { Check, Plus, Receipt, X } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { ManagerMonthPicker } from "@/components/manager-month-picker";
import { useOwnerBuildings, currentMonthInput, formatBDT, formatDateSafe } from "@/lib/owner/shared";
import {
  createExpense,
  expenseCategoryLabel,
  expenseCategoryOptions,
  expenseMethodLabel,
  expenseMethodOptions,
  expenseStatusLabel,
  methodsRequiringReference,
  reviewExpense,
  useOwnerExpenses,
  type ExpenseCategory,
  type ExpensePaymentMethod,
  type OwnerExpense,
} from "@/lib/owner/expenses";

/**
 * Owner building-expense entries. Ported visually from the manager mobile
 * expenses screen (mobile/app/(manager)/expenses.tsx), which itself follows
 * the app's established header/filter-pill/FAB visual language since
 * neither the Sanjida reference nor the web app has a bespoke owner expenses
 * layout to port. The one owner-only addition is review: tapping a pending
 * expense opens Approve/Reject, calling the same `review_building_expense`
 * RPC the web app's owner Expenses page uses — a manager's own expense entry
 * always lands "pending" and can only be reviewed here.
 */
export default function OwnerExpensesScreen() {
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useOwnerBuildings();
  const [buildingId, setBuildingId] = useState("all");
  const [month, setMonth] = useState(currentMonthInput());
  const { expenses, loading, refreshing, error, refresh } = useOwnerExpenses(buildingId, month);
  const [modalVisible, setModalVisible] = useState(false);
  const [reviewing, setReviewing] = useState<OwnerExpense | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Expenses</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Building expenses for your buildings</Text>
      </View>

      {buildingsLoading ? null : <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} includeAll />}
      <ManagerMonthPicker month={month} onChange={setMonth} />

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : expenses.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No expenses recorded for this month yet.</Text>
        ) : (
          <View style={styles.list}>
            {expenses.map((expense) => {
              const tone =
                expense.approval_status === "approved"
                  ? { backgroundColor: colors.successBg, borderColor: colors.success, color: colors.success }
                  : expense.approval_status === "rejected" || expense.approval_status === "cancelled"
                    ? { backgroundColor: colors.dangerBg, borderColor: colors.danger, color: colors.danger }
                    : { backgroundColor: colors.warningBg, borderColor: colors.warning, color: colors.warning };
              const canReview = expense.approval_status === "pending";
              return (
                <TouchableOpacity
                  key={expense.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  disabled={!canReview}
                  onPress={() => setReviewing(expense)}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.category, { color: colors.text }]}>{expenseCategoryLabel[expense.category]}</Text>
                      <Text style={[styles.buildingName, { color: colors.textSub }]}>{expense.building_name}</Text>
                    </View>
                    <Text style={[styles.amount, { color: colors.text }]}>{formatBDT(expense.amount)}</Text>
                  </View>
                  <Text style={[styles.description, { color: colors.textSub }]}>{expense.description}</Text>
                  <View style={styles.footerRow}>
                    <Text style={[styles.metaText, { color: colors.textSub }]}>
                      {formatDateSafe(expense.expense_date)} · {expenseMethodLabel[expense.payment_method]}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
                      <Text style={[styles.statusText, { color: tone.color }]}>{expenseStatusLabel[expense.approval_status]}</Text>
                    </View>
                  </View>
                  {expense.reviewer_note ? <Text style={[styles.reviewerNote, { color: colors.textSub }]}>{expense.reviewer_note}</Text> : null}
                  {canReview ? <Text style={[styles.tapHint, { color: colors.primary }]}>Tap to approve or reject</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
        <Plus color="#ffffff" size={24} />
      </TouchableOpacity>

      <AddExpenseModal
        visible={modalVisible}
        buildings={buildings}
        defaultBuildingId={buildingId !== "all" ? buildingId : (buildings[0]?.id ?? "")}
        month={month}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          setModalVisible(false);
          refresh();
        }}
      />

      <ReviewExpenseModal
        expense={reviewing}
        onClose={() => setReviewing(null)}
        onDone={() => {
          setReviewing(null);
          refresh();
        }}
      />
    </View>
  );
}

function ReviewExpenseModal({ expense, onClose, onDone }: { expense: OwnerExpense | null; onClose: () => void; onDone: () => void }) {
  const colors = useThemeColors();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);

  if (!expense) return null;

  async function handleReview(action: "approve" | "reject") {
    if (!expense) return;
    if (action === "reject" && !note.trim()) {
      Alert.alert("Note required", "Add a reviewer note explaining the rejection.");
      return;
    }
    setSubmitting(action);
    try {
      await reviewExpense(expense.id, action, note);
      setNote("");
      onDone();
    } catch (reviewError) {
      Alert.alert("Could not review expense", reviewError instanceof Error ? reviewError.message : "Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Review expense</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.detailLine, { color: colors.text }]}>{expenseCategoryLabel[expense.category]} · {expense.building_name}</Text>
            <Text style={[styles.amountLarge, { color: colors.primary }]}>{formatBDT(expense.amount)}</Text>
            <Text style={[styles.detailLine, { color: colors.textSub }]}>{expense.description}</Text>
            <Text style={[styles.detailLine, { color: colors.textSub }]}>
              {formatDateSafe(expense.expense_date)} · {expenseMethodLabel[expense.payment_method]}
              {expense.vendor_name ? ` · ${expense.vendor_name}` : ""}
            </Text>

            <Text style={[styles.label, { color: colors.text }]}>Reviewer note (required to reject)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={note}
              onChangeText={setNote}
              placeholder="Optional for approving"
              placeholderTextColor={colors.textSub}
              multiline
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={() => handleReview("approve")} disabled={submitting !== null}>
                {submitting === "approve" ? <ActivityIndicator color="#fff" /> : <Check color="#fff" size={16} />}
                <Text style={styles.actionBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.danger }]} onPress={() => handleReview("reject")} disabled={submitting !== null}>
                {submitting === "reject" ? <ActivityIndicator color="#fff" /> : <X color="#fff" size={16} />}
                <Text style={styles.actionBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddExpenseModal({
  visible,
  buildings,
  defaultBuildingId,
  month,
  onClose,
  onSaved,
}: {
  visible: boolean;
  buildings: { id: string; name: string }[];
  defaultBuildingId: string;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [category, setCategory] = useState<ExpenseCategory>("maintenance");
  const [description, setDescription] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>("cash");
  const [transactionReference, setTransactionReference] = useState("");
  const [receiptImage, setReceiptImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach a receipt.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) setReceiptImage(result.assets[0]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createExpense({
        buildingId: buildingId || defaultBuildingId,
        expenseDate: new Date().toISOString().slice(0, 10),
        accountingMonthInput: month,
        category,
        description,
        vendorName,
        amount: Number(amount),
        paymentMethod,
        transactionReference,
        receiptImage,
      });
      setDescription("");
      setVendorName("");
      setAmount("");
      setTransactionReference("");
      setReceiptImage(null);
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not add expense", submissionError instanceof Error ? submissionError.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add expense</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Building</Text>
            <View style={styles.chipRow}>
              {buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, buildingId === building.id && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  onPress={() => setBuildingId(building.id)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, buildingId === building.id && { color: colors.primary }]}>{building.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={styles.chipRow}>
              {expenseCategoryOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, category === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  onPress={() => setCategory(option)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, category === option && { color: colors.primary }]}>{expenseCategoryLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Lift service contract"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Vendor (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="Vendor name"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Amount (৳)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Payment method</Text>
            <View style={styles.chipRow}>
              {expenseMethodOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, paymentMethod === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  onPress={() => setPaymentMethod(option)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, paymentMethod === option && { color: colors.primary }]}>{expenseMethodLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {methodsRequiringReference.includes(paymentMethod) ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Transaction / cheque reference</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={transactionReference}
                  onChangeText={setTransactionReference}
                  placeholder="Required for this method"
                  placeholderTextColor={colors.textSub}
                />
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>Receipt (optional)</Text>
            <TouchableOpacity style={[styles.receiptButton, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={pickReceipt}>
              <Receipt color={colors.textSub} size={16} />
              <Text style={[styles.receiptButtonText, { color: colors.textSub }]}>{receiptImage?.fileName ?? "Choose photo of receipt"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save expense</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  list: { padding: 20, gap: 12, paddingBottom: 100 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  category: { fontSize: 15, fontWeight: "800" },
  buildingName: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "800", flexShrink: 0 },
  description: { fontSize: 13, marginBottom: 12 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaText: { fontSize: 11 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },
  reviewerNote: { fontSize: 12, marginTop: 8, fontStyle: "italic" },
  tapHint: { fontSize: 11, fontWeight: "700", marginTop: 8 },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  detailLine: { fontSize: 13, marginTop: 4 },
  amountLarge: { fontSize: 24, fontWeight: "800", marginTop: 10, marginBottom: 6 },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },

  receiptButton: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 14 },
  receiptButtonText: { fontSize: 13 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 12, paddingVertical: 13, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  actionBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
