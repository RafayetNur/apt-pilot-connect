import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Calendar, CheckCircle, Plus, User, UserCheck, Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatDateSafe } from "@/lib/owner/shared";
import {
  allowedTransitions,
  assignMaintenanceRequest,
  changeMaintenanceStatus,
  createWorkOrder,
  maintenanceCategoryLabel,
  maintenanceStatusLabel,
  useAssignableUsers,
  useMaintenanceDetail,
  useWorkOrders,
  type MaintenanceStatus,
} from "@/lib/owner/maintenance";

/**
 * Owner maintenance request detail + work orders + assignment. Status
 * transitions and work orders reuse the same logic as the manager mobile
 * detail screen (mobile/app/(manager)/maintenance-details.tsx, itself
 * ported from the Sanjida reference's app/(manager)/repair-details.tsx).
 * The "Assign" section is owner-only new work in this pass: the manager
 * mobile screens never added it, but the web app's src/lib/maintenance.ts
 * exposes `maintenance_assign` to both roles and the spec for this pass
 * calls out assignment explicitly.
 *
 * "Resolved", "Rejected", "Cancelled" and "Reopened" all require a note —
 * mirrors the web app's own request-detail panel
 * (src/components/maintenance/request-detail-panel.tsx's noteRequiredFor
 * list), which the database enforces: `maintenance_change_status`'s
 * optional `_note` argument becomes the required resolution_note /
 * rejection_reason / cancellation_reason / reopening_reason column for
 * those four transitions. Submitting one of them with no note previously
 * failed silently from the tester's perspective (the RPC rejected it and
 * the status never changed) — a StatusNoteModal now collects and requires
 * that note before calling the same `changeMaintenanceStatus` (still the
 * same `maintenance_change_status` RPC, still the same allowed-transition
 * map) for those four statuses; the remaining transitions (acknowledge,
 * assign, start, wait for parts, close) are unchanged one-tap actions.
 */
const noteRequiredFor: MaintenanceStatus[] = ["resolved", "rejected", "cancelled", "reopened"];

function noteLabelFor(status: MaintenanceStatus) {
  switch (status) {
    case "resolved":
      return "Resolution note (required — describe what was fixed)";
    case "rejected":
      return "Rejection reason (required)";
    case "cancelled":
      return "Cancellation reason (required)";
    case "reopened":
      return "Reopening reason (required)";
    default:
      return "Note (optional)";
  }
}

export default function OwnerMaintenanceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { request, loading, error, refresh } = useMaintenanceDetail(id ?? null);
  const { workOrders, refresh: refreshWorkOrders } = useWorkOrders(id ?? null);
  const [updatingStatus, setUpdatingStatus] = useState<MaintenanceStatus | null>(null);
  const [workOrderModalVisible, setWorkOrderModalVisible] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [noteStatus, setNoteStatus] = useState<MaintenanceStatus | null>(null);

  async function handleStatusChange(status: MaintenanceStatus, note?: string) {
    if (!request) return;
    setUpdatingStatus(status);
    try {
      await changeMaintenanceStatus(request.id, status, note);
      await refresh();
    } catch (statusError) {
      Alert.alert("Could not update status", statusError instanceof Error ? statusError.message : "Try again.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  function handleTransitionPress(status: MaintenanceStatus) {
    if (noteRequiredFor.includes(status)) {
      setNoteStatus(status);
      return;
    }
    handleStatusChange(status);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{request?.request_number ?? "Request"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      ) : !request ? (
        <Text style={[styles.emptyText, { color: colors.textSub }]}>Request not found.</Text>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentScroll}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.warningBg }]}>
                <Text style={[styles.badgeText, { color: colors.warning }]}>{request.priority} priority</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{maintenanceStatusLabel[request.status]}</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{request.title}</Text>
            <Text style={[styles.category, { color: colors.primary }]}>{maintenanceCategoryLabel[request.category]}</Text>
            <Text style={[styles.description, { color: colors.textSub }]}>{request.description}</Text>

            <View style={[styles.detailsList, { borderTopColor: colors.border }]}>
              <View style={styles.detailRow}>
                <User color={colors.textSub} size={16} />
                <Text style={[styles.detailText, { color: colors.text }]}>
                  {request.is_common_area ? "Common area" : request.flat_number ? `Flat ${request.flat_number}` : "—"}
                  {request.tenant_name ? ` · ${request.tenant_name}` : ""}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Calendar color={colors.textSub} size={16} />
                <Text style={[styles.detailText, { color: colors.text }]}>Reported {formatDateSafe(request.created_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Wrench color={colors.textSub} size={16} />
                <Text style={[styles.detailText, { color: colors.text }]}>Assigned: {request.assignee_name || "Unassigned"}</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.assignBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setAssignModalVisible(true)}>
              <UserCheck color={colors.primary} size={16} />
              <Text style={[styles.assignBtnText, { color: colors.primary }]}>{request.assigned_to ? "Reassign" : "Assign"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Update status</Text>
          {allowedTransitions[request.status].length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 0 }]}>No further status change is available.</Text>
          ) : (
            <View style={styles.actionsGrid}>
              {allowedTransitions[request.status].map((next) => (
                <TouchableOpacity
                  key={next}
                  style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleTransitionPress(next)}
                  disabled={updatingStatus !== null}
                >
                  {updatingStatus === next ? <ActivityIndicator color={colors.primary} size="small" /> : <CheckCircle color={colors.primary} size={18} />}
                  <Text style={[styles.actionBtnText, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={2}>
                    {maintenanceStatusLabel[next]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.sharedHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSub, marginTop: 0 }]}>Work orders</Text>
            <TouchableOpacity style={[styles.addChip, { backgroundColor: colors.primary }]} onPress={() => setWorkOrderModalVisible(true)}>
              <Plus color="#ffffff" size={14} />
              <Text style={styles.addChipText}>Add</Text>
            </TouchableOpacity>
          </View>
          {workOrders.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 0, marginBottom: 40 }]}>No work orders yet.</Text>
          ) : (
            <View style={[styles.list, { marginBottom: 40 }]}>
              {workOrders.map((wo) => (
                <View key={wo.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}>
                  <Text style={[styles.title, { color: colors.text, fontSize: 15 }]}>{wo.work_order_number}</Text>
                  <Text style={[styles.description, { color: colors.textSub, marginBottom: 6 }]}>{wo.work_description}</Text>
                  <Text style={[styles.metaText, { color: colors.textSub }]}>
                    {wo.vendor_name || wo.technician_name || "No vendor set"}
                    {wo.scheduled_date ? ` · ${formatDateSafe(wo.scheduled_date)}` : ""}
                    {wo.estimated_cost != null ? ` · Est. ৳${wo.estimated_cost.toLocaleString()}` : ""}
                  </Text>
                  <Text style={[styles.metaText, { color: colors.primary, marginTop: 4 }]}>{wo.status.replaceAll("_", " ")}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <WorkOrderModal
        visible={workOrderModalVisible}
        requestId={request?.id ?? null}
        onClose={() => setWorkOrderModalVisible(false)}
        onCreated={() => {
          setWorkOrderModalVisible(false);
          refreshWorkOrders();
        }}
      />

      <AssignModal
        visible={assignModalVisible}
        requestId={request?.id ?? null}
        onClose={() => setAssignModalVisible(false)}
        onAssigned={() => {
          setAssignModalVisible(false);
          refresh();
        }}
      />

      <StatusNoteModal
        status={noteStatus}
        requestNumber={request?.request_number ?? ""}
        submitting={updatingStatus !== null}
        onClose={() => setNoteStatus(null)}
        onSubmit={async (note) => {
          if (!noteStatus) return;
          await handleStatusChange(noteStatus, note);
          setNoteStatus(null);
        }}
      />
    </SafeAreaView>
  );
}

function AssignModal({ visible, requestId, onClose, onAssigned }: { visible: boolean; requestId: string | null; onClose: () => void; onAssigned: () => void }) {
  const colors = useThemeColors();
  const { users, loading } = useAssignableUsers();
  const [assigningId, setAssigningId] = useState<string | null>(null);

  async function handleAssign(userId: string) {
    if (!requestId) return;
    setAssigningId(userId);
    try {
      await assignMaintenanceRequest(requestId, userId);
      onAssigned();
    } catch (assignError) {
      Alert.alert("Could not assign", assignError instanceof Error ? assignError.message : "Try again.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "70%" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Assign to</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : users.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 0 }]}>No owner or manager accounts found.</Text>
          ) : (
            <ScrollView>
              {users.map((user) => (
                <TouchableOpacity key={user.id} style={[styles.userRow, { borderColor: colors.border }]} onPress={() => handleAssign(user.id)} disabled={assigningId !== null}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: colors.text }]}>{user.full_name}</Text>
                    <Text style={[styles.userRole, { color: colors.textSub }]}>{user.role}</Text>
                  </View>
                  {assigningId === user.id ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Collects the required note for "resolved" / "rejected" / "cancelled" /
 * "reopened" transitions before submitting — see the top-of-file comment
 * for why this exists. Confirm stays disabled until the note is non-empty,
 * and while a submission is in flight, so the request can't be double-
 * submitted by an extra tap.
 */
function StatusNoteModal({
  status,
  requestNumber,
  submitting,
  onClose,
  onSubmit,
}: {
  status: MaintenanceStatus | null;
  requestNumber: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
}) {
  const colors = useThemeColors();
  const [note, setNote] = useState("");

  if (!status) return null;

  const trimmed = note.trim();

  async function handleConfirm() {
    if (!trimmed || submitting) return;
    await onSubmit(trimmed);
    setNote("");
  }

  function handleClose() {
    setNote("");
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
                {maintenanceStatusLabel[status]} — {requestNumber}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>{noteLabelFor(status)}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text, minHeight: 90, textAlignVertical: "top" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Required before this status can be saved"
              placeholderTextColor={colors.textSub}
              multiline
            />
            {status === "resolved" ? (
              <Text style={[styles.helperText, { color: colors.textSub }]}>
                All open work orders for this request must be completed or cancelled first.
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, (!trimmed || submitting) && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={!trimmed || submitting}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Confirm</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function WorkOrderModal({
  visible,
  requestId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  requestId: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const colors = useThemeColors();
  const [description, setDescription] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!requestId) return;
    setSaving(true);
    try {
      await createWorkOrder(requestId, { workDescription: description, vendorName, technicianName, scheduledDate: "", estimatedCost });
      setDescription("");
      setVendorName("");
      setTechnicianName("");
      setEstimatedCost("");
      onCreated();
    } catch (submissionError) {
      Alert.alert("Could not create work order", submissionError instanceof Error ? submissionError.message : "Try again.");
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>New work order</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Work description</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="What needs to be done" placeholderTextColor={colors.textSub} multiline />

            <Text style={[styles.label, { color: colors.text }]}>Vendor name</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={vendorName} onChangeText={setVendorName} placeholder="Optional" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Technician name</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={technicianName} onChangeText={setTechnicianName} placeholder="Optional" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Estimated cost (৳)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={estimatedCost} onChangeText={setEstimatedCost} placeholder="Optional" placeholderTextColor={colors.textSub} keyboardType="decimal-pad" />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Create work order</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", marginLeft: 4 },

  content: { flex: 1, padding: 20 },
  contentScroll: { paddingBottom: 80 },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14 },

  card: { borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 20 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  category: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 16 },

  detailsList: { gap: 10, borderTopWidth: 1, paddingTop: 14 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailText: { flex: 1, fontSize: 13, fontWeight: "600" },

  assignBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, minHeight: 44, borderRadius: 12, borderWidth: 1 },
  assignBtnText: { fontSize: 13, fontWeight: "700" },

  sectionTitle: { fontSize: 12, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  sharedHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 10 },
  addChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  // flexGrow + minWidth (instead of sizing tightly to the label's intrinsic
  // width) give a multi-word status label like "Waiting for parts" enough
  // room to stay on one line on a narrow phone; when two buttons can't both
  // fit at that minimum width, flexWrap drops the second to its own row
  // instead of squeezing the label into an awkward mid-word wrap.
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexGrow: 1, minWidth: 150, paddingHorizontal: 14, minHeight: 48, borderRadius: 14, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: "700", textAlign: "center" },

  list: { gap: 12 },
  metaText: { fontSize: 12 },

  userRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  userName: { fontSize: 14, fontWeight: "700" },
  userRole: { fontSize: 12, marginTop: 2, textTransform: "capitalize" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  // flex + marginRight so a longer two-line title (StatusNoteModal's
  // "<Status> — <request number>") wraps within its own space instead of
  // pushing the Cancel/Close button off the row.
  modalTitle: { fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  helperText: { fontSize: 12, lineHeight: 17, marginTop: 8 },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
