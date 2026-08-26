import { useState } from "react";
import { useRouter } from "expo-router";
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
import { ChevronRight, Plus, User } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerLabel } from "@/components/owner-manager-label";
import { useOwnerBuildingsList, createBuilding, type BuildingStatus } from "@/lib/owner/buildings";

/**
 * Owner properties list. Ported visually from the Sanjida reference's
 * app/(owner)/properties.tsx (card with unit/occupancy stat row + manager
 * row), backed by the real `buildings` table (RLS-scoped to
 * owner_id = auth.uid()) and a flat count computed from `flats`, matching
 * the web app's src/lib/buildings.ts. Adding a building inserts through the
 * same `buildings` table the web app's "Add building" dialog uses.
 */
export default function OwnerProperties() {
  const router = useRouter();
  const colors = useThemeColors();
  const { buildings, loading, refreshing, error, refresh } = useOwnerBuildingsList();
  const [addModalVisible, setAddModalVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Properties</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>Manage your buildings</Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setAddModalVisible(true)}>
          <Plus color="#ffffff" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : buildings.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No buildings yet. Tap + to add your first one.</Text>
        ) : (
          <View style={styles.list}>
            {buildings.map((building) => (
              <TouchableOpacity
                key={building.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/(owner)/property-details", params: { id: building.id } })}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.buildingName, { color: colors.text }]}>{building.name}</Text>
                    <Text style={[styles.address, { color: colors.textSub }]} numberOfLines={2}>{building.address}</Text>
                  </View>
                  <ChevronRight color={colors.textSub} size={20} />
                </View>

                <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Units</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{building.flatsTotal}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={[styles.statLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>Occupancy</Text>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{building.flatsOccupied} / {building.flatsTotal}</Text>
                  </View>
                </View>

                <View style={[styles.managerRow, { backgroundColor: colors.surface }]}>
                  <User color={colors.primary} size={16} />
                  <View style={styles.managerTextBlock}>
                    <Text style={[styles.managerCaption, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                      Manager
                    </Text>
                    <ManagerLabel value={building.assigned_manager} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <AddBuildingModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSaved={() => {
          setAddModalVisible(false);
          refresh();
        }}
      />
    </View>
  );
}

function AddBuildingModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [floors, setFloors] = useState("");
  const [totalFlats, setTotalFlats] = useState("");
  const [assignedManager, setAssignedManager] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setAddress("");
    setArea("");
    setFloors("");
    setTotalFlats("");
    setAssignedManager("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createBuilding({
        name,
        address,
        area,
        floors: Number(floors) || 0,
        total_flats: Number(totalFlats) || 0,
        assigned_manager: assignedManager,
        status: "active" as BuildingStatus,
      });
      reset();
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not add building", submissionError instanceof Error ? submissionError.message : "Try again.");
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add building</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Building name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Green View Apartments"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Full address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={address}
              onChangeText={setAddress}
              placeholder="House, road, area, city"
              placeholderTextColor={colors.textSub}
              multiline
            />

            <Text style={[styles.label, { color: colors.text }]}>Area</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Dhanmondi"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Number of floors</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={floors}
              onChangeText={setFloors}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Total flats</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={totalFlats}
              onChangeText={setTotalFlats}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textSub}
            />

            <Text style={[styles.label, { color: colors.text }]}>Assigned manager (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={assignedManager}
              onChangeText={setAssignedManager}
              placeholder="Manager name or email"
              placeholderTextColor={colors.textSub}
            />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Add building</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  addBtn: { padding: 10, borderRadius: 12 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  list: { padding: 20, paddingBottom: 40, gap: 16 },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 },
  buildingName: { fontSize: 18, fontWeight: "800" },
  address: { fontSize: 13, marginTop: 2 },

  statsRow: { flexDirection: "row", borderTopWidth: 1, paddingTop: 16, marginBottom: 16 },
  stat: { flex: 1 },
  statLabel: { fontSize: 12, fontWeight: "500" },
  statValue: { fontSize: 16, fontWeight: "700", marginTop: 4 },

  // alignItems "flex-start" (not "center") so the icon stays pinned to the
  // top when the manager block grows to two lines (name + wrapped email)
  // instead of re-centering against the whole block's height.
  managerRow: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: 12, gap: 8 },
  managerTextBlock: { flex: 1 },
  managerCaption: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
