import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { CheckCircle2, Clock, RotateCcw, XCircle } from "lucide-react-native";

import { useThemeColors, type ThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { useManagerBuildings, formatBDT, formatDateTimeSafe, formatMonthLabel } from "@/lib/manager/shared";
import {
  createProofSignedUrl,
  paymentMethodLabel,
  reviewPayment,
  useManagerPayments,
  verificationStatusLabel,
  type ManagerPayment,
  type PaymentStatusFilter,
  type ReviewAction,
} from "@/lib/manager/payments";

const statusFilters: PaymentStatusFilter[] = ["pending", "verified", "rejected", "correction_requested", "all"];
const statusFilterLabel: Record<PaymentStatusFilter, string> = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  correction_requested: "Correction",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  all: "All",
};

/**
 * Manager review of tenant rent-payment submissions. Ported visually from
 * the Sanjida reference's app/(manager)/payments.tsx (status pills, verify
 * button), replaced with the real assigned-building review workflow from
 * the web app's src/lib/payments.ts: every verify/reject/correction action
 * goes through the `review_rent_payment` RPC — this screen never marks a
 * record paid or computes credit/applied amounts itself.
 */
export default function ManagerPayments() {
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useManagerBuildings();
  const [buildingId, setBuildingId] = useState("all");
  const [status, setStatus] = useState<PaymentStatusFilter>("pending");
  const { payments, loading, refreshing, error, refresh } = useManagerPayments(buildingId, status);
  const [selected, setSelected] = useState<ManagerPayment | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]}>Payments</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Tenant submissions for your buildings</Text>
      </View>

      {buildingsLoading ? null : <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} includeAll />}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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
              <Text style={[styles.filterPillText, { color: colors.text }, active && { color: "#ffffff" }]}>
                {statusFilterLabel[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : payments.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No payment submissions found.</Text>
        ) : (
          <View style={styles.list}>
            {payments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} colors={colors} onPress={() => setSelected(payment)} />
            ))}
          </View>
        )}
      </ScrollView>

      <ReviewModal
        payment={selected}
        onClose={() => setSelected(null)}
        onDone={() => {
          setSelected(null);
          refresh();
        }}
      />
    </View>
  );
}

function PaymentCard({ payment, colors, onPress }: { payment: ManagerPayment; colors: ThemeColors; onPress: () => void }) {
  const isVerified = payment.verification_status === "verified";
  const isPending = payment.verification_status === "pending";
  const tone = isVerified
    ? { backgroundColor: colors.successBg, borderColor: colors.success, color: colors.success }
    : isPending
      ? { backgroundColor: colors.warningBg, borderColor: colors.warning, color: colors.warning }
      : { backgroundColor: colors.dangerBg, borderColor: colors.danger, color: colors.danger };

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.flatText, { color: colors.text }]}>
            {payment.building_name} · Flat {payment.flat_number}
          </Text>
          <Text style={[styles.tenantName, { color: colors.textSub }]}>{payment.tenant_name}</Text>
          <Text style={[styles.metaText, { color: colors.textSub }]}>{formatMonthLabel(payment.billing_month)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.amountText, { color: colors.primary }]}>{formatBDT(payment.amount_paid)}</Text>
          <Text style={[styles.metaText, { color: colors.textSub }]}>{paymentMethodLabel[payment.payment_method]}</Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
        <Text style={[styles.statusText, { color: tone.color }]}>{verificationStatusLabel[payment.verification_status]}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ReviewModal({ payment, onClose, onDone }: { payment: ManagerPayment | null; onClose: () => void; onDone: () => void }) {
  const colors = useThemeColors();
  const [note, setNote] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<ReviewAction | null>(null);

  useEffect(() => {
    setNote("");
    setProofUrl(null);
  }, [payment?.id]);

  if (!payment) return null;

  async function loadProof() {
    if (!payment?.payment_proof_url) return;
    setProofLoading(true);
    try {
      const url = await createProofSignedUrl(payment.payment_proof_url);
      setProofUrl(url);
    } catch (proofError) {
      Alert.alert("Could not load proof", proofError instanceof Error ? proofError.message : "Try again.");
    } finally {
      setProofLoading(false);
    }
  }

  async function handleAction(action: ReviewAction) {
    if (!payment) return;
    if (action !== "verify" && !note.trim()) {
      Alert.alert("Note required", "Add a reviewer note explaining why.");
      return;
    }
    setSubmittingAction(action);
    try {
      await reviewPayment(payment.id, action, note);
      setNote("");
      setProofUrl(null);
      onDone();
    } catch (reviewError) {
      Alert.alert("Could not update payment", reviewError instanceof Error ? reviewError.message : "Try again.");
    } finally {
      setSubmittingAction(null);
    }
  }

  const canAct = payment.verification_status === "pending" || payment.verification_status === "correction_requested";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Review payment</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.detailLine, { color: colors.text }]}>
              {payment.building_name} · Flat {payment.flat_number} · {payment.tenant_name}
            </Text>
            <Text style={[styles.detailLine, { color: colors.textSub }]}>{formatMonthLabel(payment.billing_month)}</Text>
            <Text style={[styles.amountLarge, { color: colors.primary }]}>{formatBDT(payment.amount_paid)}</Text>
            <Text style={[styles.detailLine, { color: colors.textSub }]}>
              {paymentMethodLabel[payment.payment_method]}
              {payment.provider_name ? ` · ${payment.provider_name}` : ""}
              {payment.transaction_reference ? ` · Ref ${payment.transaction_reference}` : ""}
            </Text>
            <Text style={[styles.detailLine, { color: colors.textSub }]}>Submitted {formatDateTimeSafe(payment.submitted_at)}</Text>
            {payment.reviewer_note ? (
              <Text style={[styles.detailLine, { color: colors.textSub }]}>Previous note: {payment.reviewer_note}</Text>
            ) : null}

            {payment.payment_proof_url ? (
              proofUrl ? (
                <Image source={{ uri: proofUrl }} style={styles.proofImage} resizeMode="contain" />
              ) : (
                <TouchableOpacity
                  style={[styles.proofButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={loadProof}
                  disabled={proofLoading}
                >
                  {proofLoading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.proofButtonText, { color: colors.primary }]}>View payment proof</Text>}
                </TouchableOpacity>
              )
            ) : (
              <Text style={[styles.detailLine, { color: colors.textSub }]}>No payment proof attached (cash payment).</Text>
            )}

            {canAct ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Reviewer note (required to reject or request correction)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional for verifying"
                  placeholderTextColor={colors.textSub}
                  multiline
                />

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleAction("verify")}
                    disabled={submittingAction !== null}
                  >
                    {submittingAction === "verify" ? <ActivityIndicator color="#fff" /> : <CheckCircle2 color="#fff" size={16} />}
                    <Text style={styles.actionBtnText}>Verify</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.warning }]}
                    onPress={() => handleAction("correction_requested")}
                    disabled={submittingAction !== null}
                  >
                    {submittingAction === "correction_requested" ? <ActivityIndicator color="#fff" /> : <RotateCcw color="#fff" size={16} />}
                    <Text style={styles.actionBtnText}>Correction</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                    onPress={() => handleAction("reject")}
                    disabled={submittingAction !== null}
                  >
                    {submittingAction === "reject" ? <ActivityIndicator color="#fff" /> : <XCircle color="#fff" size={16} />}
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={[styles.doneBanner, { backgroundColor: colors.surface }]}>
                <Clock color={colors.textSub} size={16} />
                <Text style={[styles.doneBannerText, { color: colors.textSub }]}>
                  This submission is {verificationStatusLabel[payment.verification_status].toLowerCase()} and can no longer be reviewed.
                </Text>
              </View>
            )}
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

  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 12, alignItems: "center" },
  filterPill: { paddingHorizontal: 14, minHeight: 36, justifyContent: "center", borderRadius: 12, borderWidth: 1 },
  filterPillText: { fontSize: 12, fontWeight: "700" },

  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  flatText: { fontSize: 15, fontWeight: "800" },
  tenantName: { fontSize: 13, marginTop: 2 },
  metaText: { fontSize: 11, marginTop: 2 },
  amountText: { fontSize: 16, fontWeight: "800" },

  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: "700" },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  detailLine: { fontSize: 13, marginTop: 4 },
  amountLarge: { fontSize: 26, fontWeight: "800", marginTop: 10, marginBottom: 6 },

  proofButton: { marginTop: 16, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  proofButtonText: { fontSize: 14, fontWeight: "700" },
  proofImage: { marginTop: 16, width: "100%", height: 260, borderRadius: 12 },

  label: { fontSize: 13, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 60, textAlignVertical: "top" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 12, paddingVertical: 13, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  actionBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  doneBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20, padding: 14, borderRadius: 12 },
  doneBannerText: { flex: 1, fontSize: 13 },
});
