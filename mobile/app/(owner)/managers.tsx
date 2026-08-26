import { useState } from "react";
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
import { Building2, Pencil } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOwnerBuildingsList, updateBuilding, type OwnerBuildingSummary } from "@/lib/owner/buildings";

/**
 * Owner "Managers" screen. The current backend has no manager-account
 * assignment table — a building's manager is a single free-text
 * `assigned_manager` label on the `buildings` row (see
 * src/components/buildings/building-form-dialog.tsx on the web app, whose
 * "Assigned manager" field is a plain text input with placeholder "Manager
 * name or email", not a picker over `profiles`). There is also no dedicated
 * owner "managers" page on the web app to port from. This screen is
 * therefore the honest real-backend equivalent of the Sanjida reference's
 * managers.tsx: one row per building showing (and letting the owner edit)
 * that same label, through the same `buildings` update the web app's
 * building-edit dialog uses. It intentionally does not offer "add a new
 * manager account", a manager list independent of buildings, or a
 * manager-details screen — none of those have a supported backend workflow
 * from the mobile app. See the Owner integration report for detail.
 */
export default function OwnerManagers() {
  const colors = useThemeColors();
  const { buildings, loading, refreshing, error, refresh } = useOwnerBuildingsList();
  const [editing, setEditing] = useState<OwnerBuildingSummary | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Managers</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Manager label for each of your buildings</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        <View style={[styles.noteBanner, { backgroundColor: colors.surface }]}>
          <Text style={[styles.noteText, { color: colors.textSub }]}>
            Manager accounts aren&apos;t tracked separately yet — each building stores one manager name or email as a label. This matches the
            current web app.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : buildings.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No buildings yet.</Text>
        ) : (
          <View style={styles.list}>
            {buildings.map((building) => (
              <View key={building.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                  <Building2 color={colors.primary} size={20} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.buildingName, { color: colors.text }]} numberOfLines={1}>{building.name}</Text>
                  <Text style={[styles.managerText, { color: colors.textSub }]} numberOfLines={1}>
                    {building.assigned_manager || "Unassigned"}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.surface }]} onPress={() => setEditing(building)}>
                  <Pencil color={colors.primary} size={16} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <EditManagerModal
        building={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </View>
  );
}

function EditManagerModal({ building, onClose, onSaved }: { building: OwnerBuildingSummary | null; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const [value, setValue] = useState(building?.assigned_manager ?? "");
  const [saving, setSaving] = useState(false);

  if (!building) return null;

  async function handleSave() {
    if (!building) return;
    setSaving(true);
    try {
      await updateBuilding(building.id, {
        name: building.name,
        address: building.address,
        area: building.area,
        floors: building.floors,
        total_flats: building.total_flats,
        assigned_manager: value,
        status: building.status,
      });
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not update manager", submissionError instanceof Error ? submissionError.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{building.name}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Assigned manager (name or email)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={value}
            onChangeText={setValue}
            placeholder="Manager name or email"
            placeholderTextColor={colors.textSub}
          />

          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save</Text>}
          </TouchableOpacity>
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
  scrollContent: { paddingBottom: 100 },

  noteBanner: { marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 14 },
  noteText: { fontSize: 12, lineHeight: 18 },

  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  iconBox: { padding: 10, borderRadius: 12 },
  cardInfo: { flex: 1 },
  buildingName: { fontSize: 15, fontWeight: "800" },
  managerText: { fontSize: 13, marginTop: 2 },
  editBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
