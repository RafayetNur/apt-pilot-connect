import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

type Category = Database["public"]["Enums"]["maintenance_category"];
type Priority = Database["public"]["Enums"]["maintenance_priority"];
type Role = Database["public"]["Enums"]["app_role"];

const categories: Category[] = [
  "plumbing", "electrical", "gas", "water", "appliance", "structural", "lift",
  "security", "cleanliness", "common_area", "internet", "pest_control", "other",
];
const priorities: Priority[] = ["low", "medium", "high", "emergency"];
const categoryLabels: Record<Category, string> = {
  plumbing: "Plumbing", electrical: "Electrical", gas: "Gas", water: "Water supply",
  appliance: "Appliance", structural: "Structural", lift: "Lift", security: "Security",
  cleanliness: "Cleanliness", common_area: "Common area", internet: "Internet",
  pest_control: "Pest control", other: "Other",
};
const priorityLabels: Record<Priority, string> = {
  low: "Low", medium: "Medium", high: "High", emergency: "Emergency",
};

type MaintenanceRequest = Pick<
  Database["public"]["Tables"]["maintenance_requests"]["Row"],
  "id" | "request_number" | "title" | "category" | "priority" | "status" | "created_at"
>;
type TenantLocation = { id: string; flat_number: string; building_id: string; building_name: string };

export default function MaintenanceScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [location, setLocation] = useState<TenantLocation | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("plumbing");
  const [priority, setPriority] = useState<Priority>("medium");
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
      setLocation(null);
      setRequests([]);
      setLoading(false);
      return;
    }
    loadData(session.user.id);
  }, [session]);

  async function loadData(userId: string, isRefresh = false) {
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
    const [{ data: flat, error: flatError }, { data: requestRows, error: requestError }] =
      await Promise.all([
        supabase
          .from("flats")
          .select("id, flat_number, building_id, buildings(name)")
          .eq("tenant_id", userId)
          .maybeSingle(),
        supabase
          .from("maintenance_requests")
          .select("id, request_number, title, category, priority, status, created_at")
          .eq("tenant_id", userId)
          .order("created_at", { ascending: false }),
      ]);
    if (flatError || requestError) {
      setError((flatError ?? requestError)?.message ?? "Unable to load maintenance.");
    } else {
      const flatRow = flat as typeof flat & { buildings?: { name: string } | null };
      setLocation(
        flatRow
          ? {
              id: flatRow.id,
              flat_number: flatRow.flat_number,
              building_id: flatRow.building_id,
              building_name: flatRow.buildings?.name ?? "Your building",
            }
          : null,
      );
      setRequests(requestRows ?? []);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function submitRequest() {
    if (!location) {
      Alert.alert("No assigned flat", "A maintenance request needs an assigned flat.");
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
    if (submitError) {
      Alert.alert("Submission failed", submitError.message);
    } else {
      setTitle("");
      setDescription("");
      Alert.alert("Request submitted", "Your maintenance request was sent.");
      if (session) await loadData(session.user.id, true);
    }
    setSubmitting(false);
  }

  if (!session) {
    return <MessageScreen title="Log in to view maintenance" message="Open the Home tab to log in." />;
  }
  if (!loading && role !== null && role !== "tenant") {
    return (
      <MessageScreen
        title="Maintenance workspace coming later"
        message="Owner and manager maintenance tools will be added in a future milestone."
      />
    );
  }
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => session && loadData(session.user.id, true)}
              tintColor="#639873"
            />
          }>
          <Text style={styles.eyebrow}>APT PILOT</Text>
          <Text style={styles.title}>Maintenance</Text>
          <Text style={styles.subtitle}>Report an issue and follow its progress.</Text>
          {loading ? (
            <StateBox title="Loading requests..." loading />
          ) : error ? (
            <StateBox title="Unable to load maintenance" message={error} />
          ) : (
            <>
              {requests.length === 0 ? (
                <StateBox title="No requests yet" message="Your reported issues will appear here." />
              ) : (
                requests.map((request) => <RequestCard key={request.id} request={request} />)
              )}
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Report an issue</Text>
                <Text style={styles.formHint}>
                  {location ? `${location.building_name} · Flat ${location.flat_number}` : "An assigned flat is required to submit a request."}
                </Text>
                <Text style={styles.label}>Title</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Kitchen tap leaking"
                  placeholderTextColor="#9B95A5"
                  maxLength={160}
                />
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What is wrong and when it started"
                  placeholderTextColor="#9B95A5"
                  multiline
                  textAlignVertical="top"
                  maxLength={4000}
                />
                <Text style={styles.label}>Category</Text>
                <CategorySelector selected={category} onSelect={setCategory} />
                <Text style={styles.label}>Priority</Text>
                <PrioritySelector selected={priority} onSelect={setPriority} />
                <Pressable
                  style={[styles.button, (!location || submitting) && styles.buttonDisabled]}
                  onPress={submitRequest}
                  disabled={!location || submitting}>
                  {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Submit request</Text>}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.messageScreen}>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function StateBox({ title, message, loading = false }: { title: string; message?: string; loading?: boolean }) {
  return (
    <View style={styles.stateBox}>
      {loading ? <ActivityIndicator color="#639873" size="large" /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.stateText}>{message}</Text> : null}
    </View>
  );
}

function RequestCard({ request }: { request: MaintenanceRequest }) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestNumber}>{request.request_number}</Text>
        <Text style={styles.date}>{new Date(request.created_at).toLocaleDateString()}</Text>
      </View>
      <Text style={styles.requestTitle}>{request.title}</Text>
      <View style={styles.tagRow}>
        <Tag text={categoryLabels[request.category]} />
        <Tag text={priorityLabels[request.priority]} />
        <Tag text={request.status.replaceAll("_", " ")} emphasized />
      </View>
    </View>
  );
}

function Tag({ text, emphasized = false }: { text: string; emphasized?: boolean }) {
  return <Text style={[styles.tag, emphasized && styles.emphasizedTag]}>{text}</Text>;
}

function CategorySelector({
  selected,
  onSelect,
}: {
  selected: Category;
  onSelect: (value: Category) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.categorySelector} onPress={() => setOpen(true)}>
        <Text style={styles.categorySelectorText}>{categoryLabels[selected]}</Text>
        <Text style={styles.categorySelectorChevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.categoryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select category</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.categoryOptions}>
              {categories.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.categoryOption, value === selected && styles.selectedCategoryOption]}
                  onPress={() => {
                    onSelect(value);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.categoryOptionText,
                      value === selected && styles.selectedCategoryOptionText,
                    ]}>
                    {categoryLabels[value]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function PrioritySelector({
  selected,
  onSelect,
}: {
  selected: Priority;
  onSelect: (value: Priority) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.categorySelector} onPress={() => setOpen(true)}>
        <Text style={styles.categorySelectorText}>{priorityLabels[selected]}</Text>
        <Text style={styles.categorySelectorChevron}>⌄</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.categoryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select priority</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.categoryOptions}>
              {priorities.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.categoryOption, value === selected && styles.selectedCategoryOption]}
                  onPress={() => {
                    onSelect(value);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.categoryOptionText,
                      value === selected && styles.selectedCategoryOptionText,
                    ]}>
                    {priorityLabels[value]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF7F2" },
  flex: { flex: 1 },
  content: { padding: 24, paddingBottom: 44 },
  eyebrow: { color: "#639873", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 8, color: "#292332", fontSize: 36, fontWeight: "800" },
  subtitle: { marginTop: 8, marginBottom: 22, color: "#777184", fontSize: 16 },
  stateBox: { padding: 22, marginBottom: 16, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center" },
  stateTitle: { marginTop: 8, color: "#292332", fontSize: 17, fontWeight: "800", textAlign: "center" },
  stateText: { marginTop: 8, color: "#777184", fontSize: 14, lineHeight: 20, textAlign: "center" },
  requestCard: { marginBottom: 12, padding: 17, borderRadius: 15, backgroundColor: "#FFFFFF" },
  requestHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  requestNumber: { color: "#639873", fontSize: 12, fontWeight: "800" },
  date: { color: "#8A8492", fontSize: 12 },
  requestTitle: { marginTop: 9, color: "#292332", fontSize: 17, fontWeight: "800" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },
  tag: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: "#F0ECE7", color: "#5D5665", fontSize: 12, overflow: "hidden" },
  emphasizedTag: { backgroundColor: "#DCEDE0", color: "#356943" },
  formCard: { marginTop: 14, padding: 19, borderRadius: 17, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E0D8" },
  formTitle: { color: "#292332", fontSize: 21, fontWeight: "800" },
  formHint: { marginTop: 5, marginBottom: 18, color: "#777184", fontSize: 14 },
  label: { marginTop: 12, marginBottom: 7, color: "#3B3543", fontSize: 13, fontWeight: "700" },
  input: { minHeight: 50, paddingHorizontal: 14, borderWidth: 1, borderColor: "#DED6CE", borderRadius: 11, backgroundColor: "#FFFFFF", color: "#292332", fontSize: 15 },
  descriptionInput: { minHeight: 105, paddingTop: 13 },
  categorySelector: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: "#DED6CE", borderRadius: 10, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  categorySelectorText: { flex: 1, color: "#292332", fontSize: 14, fontWeight: "600" },
  categorySelectorChevron: { marginLeft: 10, color: "#639873", fontSize: 22, lineHeight: 22 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(41, 35, 50, 0.35)" },
  categoryModal: { maxHeight: "78%", paddingTop: 18, paddingHorizontal: 18, paddingBottom: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: "#FBF7F2" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  modalTitle: { color: "#292332", fontSize: 20, fontWeight: "800" },
  modalClose: { color: "#639873", fontSize: 14, fontWeight: "700" },
  categoryOptions: { gap: 8, paddingVertical: 4 },
  categoryOption: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: "#DED6CE", borderRadius: 10, backgroundColor: "#FFFFFF", justifyContent: "center" },
  selectedCategoryOption: { borderColor: "#639873", backgroundColor: "#DCEDE0" },
  categoryOptionText: { color: "#292332", fontSize: 15, lineHeight: 20 },
  selectedCategoryOptionText: { color: "#356943", fontWeight: "800" },
  button: { height: 52, marginTop: 22, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#639873" },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  messageScreen: { flex: 1, justifyContent: "center", padding: 26 },
  messageTitle: { marginTop: 12, color: "#292332", fontSize: 27, fontWeight: "800" },
  messageText: { marginTop: 10, color: "#777184", fontSize: 16, lineHeight: 23 },
});