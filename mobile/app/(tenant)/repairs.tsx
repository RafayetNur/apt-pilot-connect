import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, Plus, Wrench } from "lucide-react-native";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

type Category = Database["public"]["Enums"]["maintenance_category"];
type Priority = Database["public"]["Enums"]["maintenance_priority"];

const categories: Category[] = [
  "plumbing", "electrical", "gas", "water", "appliance", "structural", "lift",
  "security", "cleanliness", "common_area", "internet", "pest_control", "other",
];
const categoryLabels: Record<Category, string> = {
  plumbing: "Plumbing", electrical: "Electrical", gas: "Gas", water: "Water supply",
  appliance: "Appliance", structural: "Structural", lift: "Lift", security: "Security",
  cleanliness: "Cleanliness", common_area: "Common area", internet: "Internet",
  pest_control: "Pest control", other: "Other",
};
const priorities: Priority[] = ["low", "medium", "high", "emergency"];
const priorityLabels: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", emergency: "Emergency",
};

type MaintenanceRequest = Pick<
  Database["public"]["Tables"]["maintenance_requests"]["Row"],
  "id" | "request_number" | "title" | "category" | "priority" | "status" | "created_at" | "assigned_to"
>;
type TenantLocation = { id: string; flat_number: string; building_id: string };

/**
 * Ported from the Sanjida reference's app/(tenant)/repairs.tsx (list + FAB +
 * new-request modal), wired to the exact same live queries and
 * `create_maintenance_request` RPC as the currently-tested
 * mobile/app/(tabs)/explore.tsx. Categories/priorities use the real
 * `maintenance_category`/`maintenance_priority` enum values instead of the
 * reference's free-text mock list.
 */
export default function TenantRepairs() {
  const colors = useThemeColors();
  const { session } = useAuth();

  const [location, setLocation] = useState<TenantLocation | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("plumbing");
  const [priority, setPriority] = useState<Priority>("medium");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      const userId = session.user.id;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [{ data: flat, error: flatError }, { data: requestRows, error: requestError }] = await Promise.all([
        supabase.from("flats").select("id, flat_number, building_id").eq("tenant_id", userId).maybeSingle(),
        supabase
          .from("maintenance_requests")
          .select("id, request_number, title, category, priority, status, created_at, assigned_to")
          .eq("tenant_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (flatError || requestError) {
        setError((flatError ?? requestError)?.message ?? "Unable to load repairs.");
      } else {
        setLocation(flat ? { id: flat.id, flat_number: flat.flat_number, building_id: flat.building_id } : null);
        setRequests(requestRows ?? []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [session],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!location) {
      Alert.alert("No assigned flat", "A repair request needs an assigned flat.");
      return;
    }
    if (title.trim().length < 3 || description.trim().length < 5) {
      Alert.alert("More detail needed", "Add a title and description so the issue can be fixed.");
      return;
    }
    setSubmitting(true);
    const { error: submitError } = await supabase.rpc("create_maintenance_request", {
      _building_id: location.building_id,
      _category: category,
      _title: title.trim(),
      _description: description.trim(),
      _priority: priority,
      _is_common_area: false,
      _flat_id: location.id,
    });
    setSubmitting(false);
    if (submitError) {
      Alert.alert("Submission failed", submitError.message);
      return;
    }
    setModalVisible(false);
    setTitle("");
    setDescription("");
    setCategory("plumbing");
    setPriority("medium");
    Alert.alert("Submitted", "Your repair request has been sent to the manager.");
    await load(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      >
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Repairs</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>Maintenance requests</Text>
        </View>

        <View style={styles.list}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
          ) : requests.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub }]}>No repair requests found.</Text>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.titleBox}>
                    <Wrench color={colors.primary} size={16} />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{req.title}</Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      req.status === "resolved" || req.status === "closed"
                        ? { backgroundColor: colors.successBg, borderColor: colors.success }
                        : { backgroundColor: colors.warningBg, borderColor: colors.warning },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: req.status === "resolved" || req.status === "closed" ? colors.success : colors.warning },
                      ]}
                    >
                      {req.status.replaceAll("_", " ")}
                    </Text>
                  </View>
                </View>
                <View style={styles.tagRow}>
                  <Text style={[styles.tag, { backgroundColor: colors.surface, color: colors.textSub }]}>
                    {categoryLabels[req.category]}
                  </Text>
                  <Text style={[styles.tag, { backgroundColor: colors.surface, color: colors.textSub }]}>
                    {priorityLabels[req.priority]}
                  </Text>
                </View>

                <View style={[styles.metaRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.metaText, { color: colors.textSub }]}>
                    {req.request_number} · {new Date(req.created_at).toLocaleDateString()}
                  </Text>
                  {req.assigned_to ? <Text style={[styles.metaAssigned, { color: colors.primary }]}>Assigned</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
        <Plus color="#ffffff" size={24} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>New Request</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={[styles.closeText, { color: colors.primary }]}>Close</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.textSub }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Kitchen tap leaking"
                placeholderTextColor={colors.textSub}
                maxLength={160}
              />

              <Text style={[styles.label, { color: colors.textSub }]}>Category</Text>
              <View style={styles.categoryRow}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      category === cat && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.categoryText, { color: colors.textSub }, category === cat && { color: colors.primary }]}>
                      {categoryLabels[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSub }]}>Urgency Level</Text>
              <View style={styles.priorityRow}>
                {priorities.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      priority === p && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text style={[styles.priorityText, { color: colors.textSub }, priority === p && { color: colors.primary }]}>
                      {priorityLabels[p]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSub }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Describe the issue..."
                placeholderTextColor={colors.textSub}
                value={description}
                onChangeText={setDescription}
                maxLength={4000}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, (!location || submitting) && styles.disabled]}
                onPress={handleSubmit}
                disabled={!location || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Check color="#ffffff" size={20} />
                    <Text style={styles.submitBtnText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>
              {!location ? (
                <Text style={[styles.hint, { color: colors.danger }]}>An assigned flat is required to submit a request.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flex: 1 },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },

  list: { padding: 20, paddingBottom: 100, gap: 16 },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  titleBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700" },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontSize: 12, overflow: "hidden" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 12 },
  metaText: { fontSize: 12, fontWeight: "500" },
  metaAssigned: { fontSize: 12, fontWeight: "600" },
  emptyText: { textAlign: "center", marginTop: 40 },

  fab: {
    position: "absolute", bottom: 24, right: 24, width: 56, height: 56,
    borderRadius: 28, justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "88%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  closeText: { fontSize: 16, fontWeight: "600" },

  label: { fontSize: 14, fontWeight: "700", marginBottom: 10, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15 },
  multiline: { minHeight: 96, marginBottom: 4 },

  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  categoryText: { fontSize: 13, fontWeight: "600" },

  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  priorityBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  priorityText: { fontSize: 14, fontWeight: "600" },

  submitBtn: { marginTop: 20, borderRadius: 12, paddingVertical: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  disabled: { opacity: 0.55 },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  hint: { marginTop: 10, fontSize: 12, textAlign: "center" },
});
