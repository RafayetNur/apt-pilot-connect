import { useCallback, useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AlertCircle, CheckCircle2, Clock, CreditCard } from "lucide-react-native";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors, type ThemeColors } from "@/hooks/use-theme-colors";

type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type RentRecord = Database["public"]["Tables"]["rent_records"]["Row"];
type RentPayment = Database["public"]["Tables"]["rent_payments"]["Row"];
type Credit = Database["public"]["Tables"]["tenant_credits"]["Row"];
type Flat = { id: string; building_id: string; flat_number: string; buildings?: { name: string } | null };

const paymentMethods: PaymentMethod[] = ["bkash", "nagad", "bank_transfer"];
const paymentMethodLabels: Record<PaymentMethod, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};
const verificationLabels: Record<Database["public"]["Enums"]["verification_status"], string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
  correction_requested: "Correction requested",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
};

/**
 * Ported from the Sanjida reference's app/(tenant)/bills.tsx, wired to the
 * exact same live queries, RPC-free insert and payment-proof upload flow as
 * the currently-tested mobile/app/(tabs)/payments.tsx. The reference's
 * "Self-Entered Bills" section is not ported — it was purely local state
 * with no backend persistence (see AptPilot-architecture-comparison.md §9).
 */
export default function TenantBills() {
  const colors = useThemeColors();
  const { session } = useAuth();

  const [flat, setFlat] = useState<Flat | null>(null);
  const [records, setRecords] = useState<RentRecord[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<RentRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [provider, setProvider] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      const userId = session.user.id;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [
        { data: flatRow, error: flatError },
        { data: rentRows, error: rentError },
        { data: paymentRows, error: paymentError },
        { data: creditRows, error: creditError },
      ] = await Promise.all([
        supabase.from("flats").select("id, building_id, flat_number, buildings(name)").eq("tenant_id", userId).maybeSingle(),
        supabase.from("rent_records").select("*").eq("tenant_id", userId).order("billing_month", { ascending: false }),
        supabase.from("rent_payments").select("*").eq("tenant_id", userId).order("submitted_at", { ascending: false }),
        supabase.from("tenant_credits").select("*").eq("tenant_id", userId).order("created_at", { ascending: false }),
      ]);

      const loadError = flatError ?? rentError ?? paymentError ?? creditError;
      if (loadError) {
        setError(loadError.message);
      } else {
        setFlat(flatRow as Flat | null);
        setRecords(rentRows ?? []);
        setPayments(paymentRows ?? []);
        setCredits(creditRows ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [session],
  );

  useEffect(() => {
    load();
  }, [load]);

  function chooseRecord(record: RentRecord) {
    setSelectedRecord(record);
    setAmount(record.remaining_due > 0 ? String(record.remaining_due) : "");
    setProvider("");
    setReference("");
    setProof(null);
    setPayModalVisible(true);
  }

  async function pickProof() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach payment proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled) setProof(result.assets[0]);
  }

  async function submitPayment() {
    if (!session || !flat || !selectedRecord) return;
    const amountPaid = Number(amount);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      Alert.alert("Invalid amount", "Enter an amount greater than zero.");
      return;
    }
    if (!provider.trim() || !reference.trim()) {
      Alert.alert("Details required", "Provider name and transaction reference are required.");
      return;
    }
    if (!proof) {
      Alert.alert("Proof required", "Attach a screenshot or photo of the payment.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(proof.uri);
      const fileData = await response.arrayBuffer();
      const extension = proof.fileName?.split(".").pop()?.toLowerCase() || "jpg";
      const proofPath = `${session.user.id}/${Crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(proofPath, fileData, {
        contentType: proof.mimeType ?? "image/jpeg",
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadError) throw new Error(`Could not upload payment proof: ${uploadError.message}`);

      const { error: paymentError } = await supabase.from("rent_payments").insert({
        rent_record_id: selectedRecord.id,
        building_id: selectedRecord.building_id,
        flat_id: selectedRecord.flat_id,
        tenant_id: session.user.id,
        amount_paid: amountPaid,
        payment_method: method,
        provider_name: provider.trim(),
        transaction_reference: reference.trim(),
        payment_proof_url: proofPath,
      });
      if (paymentError) throw new Error(paymentError.message);

      setPayModalVisible(false);
      setSelectedRecord(null);
      Alert.alert("Payment submitted", "Your payment is pending verification.");
      await load(true);
    } catch (submissionError) {
      Alert.alert("Submission failed", submissionError instanceof Error ? submissionError.message : "Could not submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  const availableCredit = credits.reduce((total, credit) => total + credit.remaining_amount, 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>My Bills</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Your rent balances, submissions and receipts</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Unable to load bills</Text>
            <Text style={[styles.emptyText, { color: colors.textSub }]}>{error}</Text>
          </View>
        ) : !flat ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No assigned flat</Text>
            <Text style={[styles.emptyText, { color: colors.textSub }]}>
              A rent record and payment submission need an assigned flat.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.summaryLabel, { color: colors.text }]}>
                {flat.buildings?.name ?? "Your building"} · Flat {flat.flat_number}
              </Text>
              <Text style={[styles.creditLabel, { color: colors.textSub }]}>Available advance credit</Text>
              <Text style={[styles.creditValue, { color: colors.text }]}>৳ {availableCredit.toLocaleString()}</Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Rent Records</Text>
            {records.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>Your rent records will appear here.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {records.map((record) => (
                  <RentCard key={record.id} record={record} payments={payments} colors={colors} onPay={() => chooseRecord(record)} />
                ))}
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Payment History</Text>
            {payments.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textSub }]}>Your payment submissions will appear here.</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {payments.map((payment) => (
                  <PaymentCard key={payment.id} payment={payment} colors={colors} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={payModalVisible} animationType="slide" transparent onRequestClose={() => setPayModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Submit a payment</Text>
                <TouchableOpacity onPress={() => setPayModalVisible(false)}>
                  <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
                </TouchableOpacity>
              </View>

              {selectedRecord ? (
                <>
                  <Text style={[styles.modalHint, { color: colors.textSub }]}>
                    {formatMonth(selectedRecord.billing_month)} · Remaining due ৳{selectedRecord.remaining_due.toLocaleString()}
                  </Text>

                  <Text style={[styles.label, { color: colors.text }]}>Amount paid</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="Enter amount"
                    placeholderTextColor={colors.textSub}
                  />

                  <Text style={[styles.label, { color: colors.text }]}>Payment method</Text>
                  <Pressable
                    style={[styles.selector, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setMethodOpen(true)}
                  >
                    <Text style={[styles.selectorText, { color: colors.text }]}>{paymentMethodLabels[method]}</Text>
                    <Text style={[styles.chevron, { color: colors.primary }]}>⌄</Text>
                  </Pressable>
                  <Modal visible={methodOpen} transparent animationType="fade" onRequestClose={() => setMethodOpen(false)}>
                    <Pressable style={styles.methodOverlay} onPress={() => setMethodOpen(false)}>
                      <View style={[styles.methodSheet, { backgroundColor: colors.card }]}>
                        {paymentMethods.map((value) => (
                          <Pressable
                            key={value}
                            style={[styles.methodOption, { borderColor: colors.border }]}
                            onPress={() => {
                              setMethod(value);
                              setMethodOpen(false);
                            }}
                          >
                            <Text style={[styles.methodOptionText, { color: colors.text }]}>{paymentMethodLabels[value]}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </Pressable>
                  </Modal>

                  <Text style={[styles.label, { color: colors.text }]}>Provider name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={provider}
                    onChangeText={setProvider}
                    placeholder="bKash personal, City Bank"
                    placeholderTextColor={colors.textSub}
                    maxLength={100}
                  />

                  <Text style={[styles.label, { color: colors.text }]}>Transaction reference</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={reference}
                    onChangeText={setReference}
                    placeholder="TrxID / slip number"
                    placeholderTextColor={colors.textSub}
                    maxLength={100}
                  />

                  <Text style={[styles.label, { color: colors.text }]}>Payment proof</Text>
                  <Pressable
                    style={[styles.proofButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={pickProof}
                  >
                    <Text style={[styles.proofText, { color: colors.textSub }]}>
                      {proof?.fileName ?? "Choose screenshot or photo"}
                    </Text>
                  </Pressable>

                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && styles.disabled]}
                    onPress={submitPayment}
                    disabled={submitting}
                  >
                    {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Submit payment</Text>}
                  </TouchableOpacity>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RentCard({
  record,
  payments,
  colors,
  onPay,
}: {
  record: RentRecord;
  payments: RentPayment[];
  colors: ThemeColors;
  onPay: () => void;
}) {
  const isPaid = record.payment_status === "paid";
  const pending = payments.some((payment) => payment.rent_record_id === record.id && payment.verification_status === "pending");

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{formatMonth(record.billing_month)}</Text>
        <View
          style={[
            styles.statusBadge,
            isPaid ? { backgroundColor: colors.successBg, borderColor: colors.success } : { backgroundColor: colors.dangerBg, borderColor: colors.danger },
          ]}
        >
          <Text style={[styles.statusText, { color: isPaid ? colors.success : colors.danger }]}>
            {record.payment_status.replaceAll("_", " ").toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[styles.breakdown, { backgroundColor: colors.surface }]}>
        <BreakdownRow label="Base rent" value={record.base_rent} colors={colors} />
        <BreakdownRow label="Individual charges" value={record.individual_charges_total} colors={colors} />
        <BreakdownRow label="Shared charges" value={record.shared_charges_total} colors={colors} />
        <BreakdownRow label="Adjustments" value={record.adjustment_total} colors={colors} />
        <View style={[styles.breakdownRow, styles.totalRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: colors.text }]}>Total payable</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>৳ {record.total_payable.toLocaleString()}</Text>
        </View>
        <BreakdownRow label="Verified paid" value={record.total_paid} colors={colors} />
        <BreakdownRow label="Remaining due" value={record.remaining_due} colors={colors} emphasize />
      </View>
      <Text style={[styles.dueDate, { color: colors.textSub }]}>Due {new Date(record.due_date).toLocaleDateString()}</Text>

      {record.remaining_due > 0 && !pending ? (
        <TouchableOpacity style={[styles.payButton, { backgroundColor: colors.primary }]} onPress={onPay}>
          <CreditCard color="#ffffff" size={18} />
          <Text style={styles.payButtonText}>Submit payment</Text>
        </TouchableOpacity>
      ) : pending ? (
        <Text style={[styles.pending, { color: colors.warning }]}>Submission pending verification</Text>
      ) : null}
    </View>
  );
}

function BreakdownRow({ label, value, colors, emphasize = false }: { label: string; value: number; colors: ThemeColors; emphasize?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: colors.textSub }]}>{label}</Text>
      <Text style={[styles.breakdownValue, { color: emphasize ? colors.danger : colors.text }]}>৳ {value.toLocaleString()}</Text>
    </View>
  );
}

function PaymentCard({ payment, colors }: { payment: RentPayment; colors: ThemeColors }) {
  const Icon = payment.verification_status === "verified" ? CheckCircle2 : payment.verification_status === "pending" ? Clock : AlertCircle;
  const iconColor = payment.verification_status === "verified" ? colors.success : payment.verification_status === "pending" ? colors.warning : colors.danger;

  return (
    <View style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.historyIcon, { backgroundColor: colors.surface }]}>
        <Icon color={iconColor} size={22} />
      </View>
      <View style={styles.historyInfo}>
        <Text style={[styles.historyMethod, { color: colors.text }]}>
          {paymentMethodLabels[payment.payment_method]} · {new Date(payment.submitted_at).toLocaleDateString()}
        </Text>
        {payment.receipt_number ? <Text style={[styles.receipt, { color: colors.primary }]}>Receipt {payment.receipt_number}</Text> : null}
        {payment.reviewer_note ? <Text style={[styles.note, { color: colors.textSub }]}>{payment.reviewer_note}</Text> : null}
      </View>
      <View style={styles.historyAmountBox}>
        <Text style={[styles.historyAmount, { color: colors.text }]}>৳ {payment.amount_paid.toLocaleString()}</Text>
        <Text style={[styles.historyStatus, { color: iconColor }]}>{verificationLabels[payment.verification_status]}</Text>
      </View>
    </View>
  );
}

function formatMonth(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  stateBox: { padding: 40, alignItems: "center" },

  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 20, marginTop: 20, marginBottom: 12 },

  summaryCard: { marginHorizontal: 20, marginTop: 12, borderRadius: 20, padding: 18 },
  summaryLabel: { fontSize: 13, fontWeight: "700" },
  creditLabel: { marginTop: 16, fontSize: 13 },
  creditValue: { marginTop: 3, fontSize: 24, fontWeight: "800" },

  emptyState: { marginHorizontal: 20, padding: 24, borderRadius: 16, borderWidth: 1, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyText: { marginTop: 6, fontSize: 14, textAlign: "center", lineHeight: 20 },

  list: { paddingHorizontal: 20, gap: 12, marginBottom: 8 },
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },

  breakdown: { borderRadius: 16, padding: 14 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  breakdownLabel: { fontSize: 13, fontWeight: "500" },
  breakdownValue: { fontSize: 13, fontWeight: "600" },
  totalRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 2, marginBottom: 10 },
  totalLabel: { fontSize: 14, fontWeight: "800" },
  totalValue: { fontSize: 15, fontWeight: "800" },
  dueDate: { marginTop: 10, fontSize: 12 },

  payButton: { marginTop: 14, borderRadius: 12, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  payButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  pending: { marginTop: 14, fontSize: 13, fontWeight: "700" },

  historyItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, gap: 14 },
  historyIcon: { padding: 10, borderRadius: 12 },
  historyInfo: { flex: 1 },
  historyMethod: { fontSize: 14, fontWeight: "700" },
  receipt: { marginTop: 4, fontSize: 12, fontWeight: "700" },
  note: { marginTop: 6, fontSize: 12 },
  historyAmountBox: { alignItems: "flex-end" },
  historyAmount: { fontSize: 14, fontWeight: "800" },
  historyStatus: { marginTop: 3, fontSize: 11, fontWeight: "700", textAlign: "right" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },
  modalHint: { fontSize: 13, marginBottom: 16 },

  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  selector: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectorText: { fontSize: 14, fontWeight: "600" },
  chevron: { fontSize: 20 },

  methodOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 32 },
  methodSheet: { borderRadius: 16, padding: 8 },
  methodOption: { paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: 1 },
  methodOptionText: { fontSize: 15, fontWeight: "600" },

  proofButton: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12, justifyContent: "center" },
  proofText: { fontSize: 14 },

  submitBtn: { marginTop: 20, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  disabled: { opacity: 0.6 },
  submitBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
