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
import { ArrowLeft, Calendar, CheckCircle, Plus, User, Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatDateSafe } from "@/lib/manager/shared";
import {
  allowedTransitions,
  changeMaintenanceStatus,
  createWorkOrder,
  maintenanceCategoryLabel,
  maintenanceStatusLabel,
  useMaintenanceDetail,
  useWorkOrders,
  type MaintenanceStatus,
} from "@/lib/manager/maintenance";

/**
 * Manager maintenance request detail + work orders. Ported visually from the
 * Sanjida reference's app/(manager)/repair-details.tsx (badge row, action
 * grid), replaced with the real status machine from
 * lib/manager/maintenance.ts's allowedTransitions (mirrors the database's
 * maintenance_transition_allowed) so only valid next statuses are offered,
 * and real work orders via the `work_order_create` RPC.
 */
export default function ManagerMaintenanceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { request, loading, error, refresh } = useMaintenanceDetail(id ?? null);
  const { workOrders, refresh: refreshWorkOrders } = useWorkOrders(id ?? null);
  const [updatingStatus, setUpdatingStatus] = useState<MaintenanceStatus | null>(null);
  const [workOrderModalVisible, setWorkOrderModalVisible] = useState(false);

  async function handleStatusChange(status: MaintenanceStatus) {
    if (!request) return;
    setUpdatingStatus(status);
    try {
      await changeMaintenanceStatus(request.id, status);
      await refresh();
    } catch (statusError) {
      Alert.alert("Could not update status", statusError instanceof Error ? statusError.message : "Try again.");
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{request?.request_number ?? "Request"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      ) : !request ? (
        <Text style={[styles.emptyText, { color: colors.textSub }]}>Request not found.</Text>
      ) : (
        <ScrollView style={styles.content}>
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
                  onPress={() => handleStatusChange(next)}
                  disabled={updatingStatus !== null}
                >
                  {updatingStatus === next ? (
                    <ActivityIndicator color={colors.primary} size="small" />
                  ) : (
                    <CheckCircle color={colors.primary} size={18} />
                  )}
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>{maintenanceStatusLabel[next]}</Text>
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
    </SafeAreaView>
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
      await createWorkOrder(requestId, {
        workDescription: description,
        vendorName,
        technicianName,
        scheduledDate: "",
        estimatedCost,
      });
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
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What needs to be done"
              placeholderTextColor={colors.textSub}
              multiline
            />

            <Text style={[styles.label, { color: colors.text }]}>Vendor name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={vendorName}
              onChangeText={setVendorName}
              placeholder="Optional"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Technician name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={technicianName}
              onChangeText={setTechnicianName}
              placeholder="Optional"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Estimated cost (৳)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={estimatedCost}
              onChangeText={setEstimatedCost}
              placeholder="Optional"
              placeholderTextColor={colors.textSub}
              keyboardType="decimal-pad"
            />

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

  sectionTitle: { fontSize: 12, fontWeight: "700", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  sharedHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 10 },
  addChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: 14, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },

  list: { gap: 12 },
  metaText: { fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
