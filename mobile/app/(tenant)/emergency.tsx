import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ambulance, ArrowLeft, Bell, Home as HomeIcon, ShieldAlert, Wrench, Zap } from "lucide-react-native";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useTenantFlat } from "@/lib/tenant/flats";
import { TenantFlatSelector } from "@/components/tenant-flat-selector";

type Category = Database["public"]["Enums"]["maintenance_category"];

const emergencyCategories: { value: Category; label: string }[] = [
  { value: "security", label: "Security" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing/Water" },
  { value: "structural", label: "Structural" },
  { value: "other", label: "Other" },
];

const emergencyContacts = [
  { label: "Building Security", icon: HomeIcon, phone: "+880 1755 908 221" },
  { label: "Fire Service", icon: Bell, phone: "199" },
  { label: "Ambulance", icon: Ambulance, phone: "999" },
  { label: "Plumber", icon: Wrench, phone: "+880 1712 220 118" },
  { label: "Electrician", icon: Zap, phone: "+880 1712 330 447" },
];

/**
 * Ported from the Sanjida reference's app/(tenant)/emergency.tsx. The
 * reference's "Broadcast Incident Alert" button only showed a "Coming Soon"
 * alert with no backend behind it. It is replaced here with a real
 * emergency report, submitted through the same `create_maintenance_request`
 * RPC used by Repairs, with `_priority` fixed to the existing "emergency"
 * enum value — no new backend API is introduced. The static contacts list
 * is unchanged (presentational; "Call" now dials via Linking).
 */
export default function TenantEmergency() {
  const router = useRouter();
  const colors = useThemeColors();
  const {
    flats,
    selectedFlat,
    selectFlat,
    loading: loadingLocation,
    error: locationError,
  } = useTenantFlat();

  const [category, setCategory] = useState<Category>("security");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function call(phone: string) {
    Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`).catch(() => {
      Alert.alert("Could not place call", "Your device does not support dialing from this app.");
    });
  }

  async function handleSend() {
    if (!selectedFlat) {
      Alert.alert("No assigned flat", "An emergency report needs an assigned flat.");
      return;
    }
    if (description.trim().length < 5) {
      Alert.alert("More detail needed", "Briefly describe the emergency.");
      return;
    }
    setSubmitting(true);
    const categoryLabel = emergencyCategories.find((c) => c.value === category)?.label ?? "Emergency";
    const { error } = await supabase.rpc("create_maintenance_request", {
      _building_id: selectedFlat.building_id,
      _category: category,
      _title: `Emergency — ${categoryLabel}`,
      _description: description.trim(),
      _priority: "emergency",
      _is_common_area: false,
      _flat_id: selectedFlat.id,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert("Could not send report", error.message);
      return;
    }
    setDescription("");
    Alert.alert("Emergency report sent", "Your building manager has been notified as a top-priority request.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Emergency Desk</Text>
      </View>

      <TenantFlatSelector flats={flats} selectedId={selectedFlat?.id ?? null} onSelect={selectFlat} />

      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Emergency Contacts</Text>
          <View style={styles.contactList}>
            {emergencyContacts.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.contactItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => call(item.phone)}
              >
                <View style={[styles.contactIcon, { backgroundColor: colors.dangerBg }]}>
                  <item.icon color={colors.danger} size={20} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.contactPhone, { color: colors.textSub }]}>{item.phone}</Text>
                </View>
                <View style={[styles.callBtn, { backgroundColor: colors.background }]}>
                  <Text style={[styles.callBtnText, { color: colors.primary }]}>Call</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.alertCard, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
          <View style={styles.alertHeader}>
            <ShieldAlert color={colors.danger} size={24} />
            <Text style={[styles.alertTitle, { color: colors.danger }]}>Send Emergency Report</Text>
          </View>
          <Text style={[styles.alertBody, { color: colors.danger }]}>
            This creates a top-priority maintenance request your building manager sees immediately.
          </Text>

          <Text style={[styles.label, { color: colors.danger }]}>Type</Text>
          <View style={styles.categoryRow}>
            {emergencyCategories.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.categoryBtn,
                  { borderColor: colors.danger, backgroundColor: "#ffffff" },
                  category === item.value && { backgroundColor: colors.danger },
                ]}
                onPress={() => setCategory(item.value)}
              >
                <Text style={[styles.categoryText, { color: colors.danger }, category === item.value && { color: "#ffffff" }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.danger }]}>What&apos;s happening</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.danger, color: colors.text, backgroundColor: "#ffffff" }]}
            placeholder="Describe the emergency..."
            placeholderTextColor={colors.textSub}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
            maxLength={4000}
          />

          {loadingLocation ? (
            <ActivityIndicator color={colors.danger} style={{ marginTop: 16 }} />
          ) : (
            <TouchableOpacity
              style={[
                styles.dispatchBtn,
                { backgroundColor: colors.danger, shadowColor: colors.danger },
                (!selectedFlat || submitting) && styles.disabled,
              ]}
              onPress={handleSend}
              disabled={!selectedFlat || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.dispatchBtnText}>🚨 SEND EMERGENCY REPORT</Text>
              )}
            </TouchableOpacity>
          )}
          {!loadingLocation && locationError ? (
            // Never shown raw: report that something went wrong without
            // leaking the underlying Supabase/PostgREST message text.
            <Text style={[styles.label, { color: colors.danger, marginTop: 12 }]}>
              Something went wrong loading your flats. Call a contact above instead.
            </Text>
          ) : !loadingLocation && flats.length > 1 && !selectedFlat ? (
            <Text style={[styles.label, { color: colors.danger, marginTop: 12 }]}>
              Choose a flat above before sending a report.
            </Text>
          ) : !loadingLocation && !selectedFlat ? (
            <Text style={[styles.label, { color: colors.danger, marginTop: 12 }]}>
              An assigned flat is required to send a report. Call a contact above instead.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1,
    paddingTop: Platform.OS === "android" ? 40 : 16,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: "800" },

  content: { flex: 1, padding: 16 },

  card: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },

  contactList: { gap: 12 },
  contactItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 1 },
  contactIcon: { padding: 10, borderRadius: 12, marginRight: 12 },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 15, fontWeight: "700" },
  contactPhone: { fontSize: 13, marginTop: 2 },
  callBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  callBtnText: { fontWeight: "700", fontSize: 13 },

  alertCard: { borderRadius: 24, padding: 20, marginBottom: 40, borderWidth: 1 },
  alertHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  alertTitle: { fontSize: 16, fontWeight: "800", textTransform: "uppercase" },
  alertBody: { marginBottom: 16, fontSize: 13, lineHeight: 19 },

  label: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1 },
  categoryText: { fontSize: 13, fontWeight: "600" },

  input: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 15, minHeight: 100, marginBottom: 4 },

  dispatchBtn: { marginTop: 16, borderRadius: 16, paddingVertical: 16, alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  disabled: { opacity: 0.6 },
  dispatchBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
});
