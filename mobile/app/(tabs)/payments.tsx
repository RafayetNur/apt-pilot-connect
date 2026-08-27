import { useEffect, useState } from "react";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

type Role = Database["public"]["Enums"]["app_role"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];
type RentRecord = Database["public"]["Tables"]["rent_records"]["Row"];
type RentPayment = Database["public"]["Tables"]["rent_payments"]["Row"];
type Credit = Database["public"]["Tables"]["tenant_credits"]["Row"];
type Flat = {
  id: string;
  building_id: string;
  flat_number: string;
  buildings?: { name: string } | null;
};

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

export default function PaymentsScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
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
  const [submitting, setSubmitting] = useState(false);

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
      setFlat(null);
      setRecords([]);
      setPayments([]);
      setCredits([]);
      setLoading(false);
      return;
    }
    loadPayments(session.user.id);
  }, [session]);

  async function loadPayments(userId: string, isRefresh = false) {
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
    const [
      { data: flatRow, error: flatError },
      { data: rentRows, error: rentError },
      { data: paymentRows, error: paymentError },
      { data: creditRows, error: creditError },
    ] = await Promise.all([
      supabase
        .from("flats")
        .select("id, building_id, flat_number, buildings(name)")
        .eq("tenant_id", userId)
        .maybeSingle(),
      supabase
        .from("rent_records")
        .select("*")
        .eq("tenant_id", userId)
        .order("billing_month", { ascending: false }),
      supabase
        .from("rent_payments")
        .select("*")
        .eq("tenant_id", userId)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("tenant_credits")
        .select("*")
        .eq("tenant_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    const dataError = flatError ?? rentError ?? paymentError ?? creditError;
    if (dataError) setError(dataError.message);
    else {
      setFlat(flatRow as Flat | null);
      setRecords(rentRows ?? []);
      setPayments(paymentRows ?? []);
      setCredits(creditRows ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function chooseRecord(record: RentRecord) {
    setSelectedRecord(record);
    setAmount(record.remaining_due > 0 ? String(record.remaining_due) : "");
    setProvider("");
    setReference("");
    setProof(null);
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
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(proofPath, fileData, {
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
      setSelectedRecord(null);
      Alert.alert("Payment submitted", "Your payment is pending verification.");
      await loadPayments(session.user.id, true);
    } catch (submissionError) {
      Alert.alert(
        "Submission failed",
        submissionError instanceof Error ? submissionError.message : "Could not submit payment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!session)
    return <MessageScreen title="Log in to view payments" message="Open the Home tab to log in." />;
  if (!loading && role !== null && role !== "tenant") {
    return (
      <MessageScreen
        title="Payments workspace coming later"
        message="Owner and manager payment tools will be added in a future milestone."
      />
    );
  }
  const availableCredit = credits.reduce((total, credit) => total + credit.remaining_amount, 0);
  const payableRecords = records.filter((record) => record.remaining_due > 0);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => session && loadPayments(session.user.id, true)}
            tintColor="#639873"
          />
        }
      >
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.title}>Payments</Text>
        <Text style={styles.subtitle}>Your rent balances, submissions, and receipts.</Text>
        {loading ? (
          <StateBox title="Loading payments..." loading />
        ) : error ? (
          <StateBox title="Unable to load payments" message={error} />
        ) : !flat ? (
          <StateBox
            title="No assigned flat"
            message="A rent record and payment submission need an assigned flat."
          />
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.cardLabel}>
                {flat.buildings?.name ?? "Your building"} · Flat {flat.flat_number}
              </Text>
              <Text style={styles.creditLabel}>Available advance credit</Text>
              <Text style={styles.creditValue}>{formatMoney(availableCredit)}</Text>
            </View>
            {records.length === 0 ? (
              <StateBox title="No rent records yet" message="Your rent records will appear here." />
            ) : (
              records.map((record) => (
                <RentCard
                  key={record.id}
                  record={record}
                  payments={payments}
                  onPay={() => chooseRecord(record)}
                />
              ))
            )}
            <Text style={styles.sectionTitle}>Payment submissions</Text>
            {payments.length === 0 ? (
              <StateBox
                title="No submissions yet"
                message="Your payment submissions will appear here."
              />
            ) : (
              payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)
            )}
            {payableRecords.length > 0 ? (
              <PaymentForm
                selectedRecord={selectedRecord}
                amount={amount}
                setAmount={setAmount}
                method={method}
                methodOpen={methodOpen}
                setMethodOpen={setMethodOpen}
                setMethod={setMethod}
                provider={provider}
                setProvider={setProvider}
                reference={reference}
                setReference={setReference}
                proof={proof}
                pickProof={pickProof}
                submitPayment={submitPayment}
                submitting={submitting}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RentCard({
  record,
  payments,
  onPay,
}: {
  record: RentRecord;
  payments: RentPayment[];
  onPay: () => void;
}) {
  const pending = payments.some(
    (payment) => payment.rent_record_id === record.id && payment.verification_status === "pending",
  );
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{formatMonth(record.billing_month)}</Text>
        <Text style={styles.status}>{record.payment_status}</Text>
      </View>
      <Text style={styles.detail}>
        Payable {formatMoney(record.total_payable)} · Verified paid {formatMoney(record.total_paid)}
      </Text>
      <Text style={styles.detail}>
        Remaining due {formatMoney(record.remaining_due)} · Due {formatDate(record.due_date)}
      </Text>
      {record.remaining_due > 0 && !pending ? (
        <Pressable style={styles.outlineButton} onPress={onPay}>
          <Text style={styles.outlineButtonText}>Submit payment</Text>
        </Pressable>
      ) : pending ? (
        <Text style={styles.pending}>Submission pending verification</Text>
      ) : null}
    </View>
  );
}

function PaymentCard({ payment }: { payment: RentPayment }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{formatMoney(payment.amount_paid)}</Text>
        <Text style={styles.status}>{verificationLabels[payment.verification_status]}</Text>
      </View>
      <Text style={styles.detail}>
        {paymentMethodLabels[payment.payment_method]} · Submitted {formatDate(payment.submitted_at)}
      </Text>
      {payment.receipt_number ? (
        <Text style={styles.receipt}>Receipt {payment.receipt_number}</Text>
      ) : null}
      {payment.reviewer_note ? <Text style={styles.note}>{payment.reviewer_note}</Text> : null}
    </View>
  );
}

function PaymentForm({
  selectedRecord,
  amount,
  setAmount,
  method,
  methodOpen,
  setMethodOpen,
  setMethod,
  provider,
  setProvider,
  reference,
  setReference,
  proof,
  pickProof,
  submitPayment,
  submitting,
}: {
  selectedRecord: RentRecord | null;
  amount: string;
  setAmount: (value: string) => void;
  method: PaymentMethod;
  methodOpen: boolean;
  setMethodOpen: (value: boolean) => void;
  setMethod: (value: PaymentMethod) => void;
  provider: string;
  setProvider: (value: string) => void;
  reference: string;
  setReference: (value: string) => void;
  proof: ImagePicker.ImagePickerAsset | null;
  pickProof: () => void;
  submitPayment: () => void;
  submitting: boolean;
}) {
  return (
    <View style={styles.formCard}>
      <Text style={styles.formTitle}>Submit a payment</Text>
      <Text style={styles.formHint}>
        {selectedRecord
          ? `${formatMonth(selectedRecord.billing_month)} · Remaining due ${formatMoney(selectedRecord.remaining_due)}`
          : "Select an unpaid or partially-paid rent record above."}
      </Text>
      {selectedRecord ? (
        <>
          <Text style={styles.label}>Amount paid</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="Enter amount"
            placeholderTextColor="#9B95A5"
          />
          <Text style={styles.label}>Payment method</Text>
          <Pressable style={styles.selector} onPress={() => setMethodOpen(true)}>
            <Text style={styles.selectorText}>{paymentMethodLabels[method]}</Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
          <Modal
            visible={methodOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setMethodOpen(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select payment method</Text>
                  <Pressable onPress={() => setMethodOpen(false)}>
                    <Text style={styles.close}>Close</Text>
                  </Pressable>
                </View>
                {paymentMethods.map((value) => (
                  <Pressable
                    key={value}
                    style={styles.modalOption}
                    onPress={() => {
                      setMethod(value);
                      setMethodOpen(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{paymentMethodLabels[value]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Modal>
          <Text style={styles.label}>Provider name</Text>
          <TextInput
            style={styles.input}
            value={provider}
            onChangeText={setProvider}
            placeholder="bKash personal, City Bank"
            placeholderTextColor="#9B95A5"
            maxLength={100}
          />
          <Text style={styles.label}>Transaction reference</Text>
          <TextInput
            style={styles.input}
            value={reference}
            onChangeText={setReference}
            placeholder="TrxID / slip number"
            placeholderTextColor="#9B95A5"
            maxLength={100}
          />
          <Text style={styles.label}>Payment proof</Text>
          <Pressable style={styles.proofButton} onPress={pickProof}>
            <Text style={styles.proofText}>{proof?.fileName ?? "Choose screenshot or photo"}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, submitting && styles.disabled]}
            onPress={submitPayment}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Submit payment</Text>
            )}
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.message}>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}
function StateBox({
  title,
  message,
  loading = false,
}: {
  title: string;
  message?: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.state}>
      <>{loading ? <ActivityIndicator color="#639873" size="large" /> : null}</>
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateText}>{message}</Text> : null}
    </View>
  );
}
function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}
function formatMonth(value: string) {
  return new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF7F2" },
  content: { padding: 24, paddingBottom: 44 },
  eyebrow: { color: "#639873", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 8, color: "#292332", fontSize: 36, fontWeight: "800" },
  subtitle: { marginTop: 8, marginBottom: 22, color: "#777184", fontSize: 16 },
  state: {
    padding: 22,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  stateTitle: {
    marginTop: 8,
    color: "#292332",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  stateText: { marginTop: 8, color: "#777184", fontSize: 14, lineHeight: 20, textAlign: "center" },
  summaryCard: { marginBottom: 12, padding: 18, borderRadius: 16, backgroundColor: "#DCEDE0" },
  cardLabel: { color: "#356943", fontSize: 13, fontWeight: "700" },
  creditLabel: { marginTop: 16, color: "#4E6655", fontSize: 13 },
  creditValue: { marginTop: 3, color: "#292332", fontSize: 27, fontWeight: "800" },
  card: {
    marginBottom: 12,
    padding: 17,
    borderWidth: 1,
    borderColor: "#E8E0D8",
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: "#292332", fontSize: 17, fontWeight: "800" },
  status: {
    color: "#639873",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
    textAlign: "right",
  },
  detail: { marginTop: 7, color: "#777184", fontSize: 13, lineHeight: 19 },
  outlineButton: {
    minHeight: 44,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#639873",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineButtonText: { color: "#356943", fontSize: 14, fontWeight: "800" },
  pending: { marginTop: 14, color: "#A56C25", fontSize: 13, fontWeight: "700" },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    color: "#292332",
    fontSize: 21,
    fontWeight: "800",
  },
  receipt: { marginTop: 8, color: "#356943", fontSize: 13, fontWeight: "700" },
  note: { marginTop: 10, padding: 10, color: "#5D5665", backgroundColor: "#F0ECE7", fontSize: 13 },
  formCard: {
    marginTop: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8E0D8",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  formTitle: { color: "#292332", fontSize: 21, fontWeight: "800" },
  formHint: { marginTop: 5, marginBottom: 8, color: "#777184", fontSize: 13 },
  label: { marginTop: 12, marginBottom: 6, color: "#3B3543", fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#DED6CE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#292332",
    fontSize: 15,
  },
  selector: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#DED6CE",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorText: { color: "#292332", fontSize: 14, fontWeight: "600" },
  chevron: { color: "#639873", fontSize: 21 },
  proofButton: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#DED6CE",
    borderRadius: 10,
    justifyContent: "center",
  },
  proofText: { color: "#5D5665", fontSize: 14 },
  button: {
    height: 50,
    marginTop: 18,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639873",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(41, 35, 50, 0.35)" },
  modalCard: {
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#FBF7F2",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { color: "#292332", fontSize: 20, fontWeight: "800" },
  close: { color: "#639873", fontSize: 14, fontWeight: "700" },
  modalOption: {
    minHeight: 48,
    marginTop: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#DED6CE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  modalOptionText: { color: "#292332", fontSize: 15 },
  message: { flex: 1, justifyContent: "center", padding: 26 },
  messageTitle: { marginTop: 12, color: "#292332", fontSize: 27, fontWeight: "800" },
  messageText: { marginTop: 10, color: "#777184", fontSize: 16, lineHeight: 23 },
});
