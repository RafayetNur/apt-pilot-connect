import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { ChevronLeft, MapPin, Pencil, Plus, Trash2, User } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerLabel } from "@/components/owner-manager-label";
import { useOwnerBuildingDetail, updateBuilding, deleteBuilding, buildingStatusLabel, type BuildingStatus } from "@/lib/owner/buildings";
import { useOwnerFlats, createFlat, occupancyLabel, type FlatInput } from "@/lib/owner/flats";
import { formatBDT } from "@/lib/owner/shared";

/**
 * Owner building detail. Ported visually from the Sanjida reference's
 * app/(owner)/property-details.tsx (header, manager card, units list),
 * backed by the real `buildings` row (edit/delete mirror the web app's
 * building detail page at src/routes/_authenticated/owner/buildings/
 * $buildingId.tsx) plus the building's real `flats` — tapping a flat opens
 * tenant-details.tsx for occupancy/tenant details, matching the reference's
 * routing.
 */
export default function OwnerPropertyDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { building, loading, error, refresh } = useOwnerBuildingDetail(id ?? null);
  const { flats, loading: flatsLoading, refreshing, refresh: refreshFlats } = useOwnerFlats(id ?? null);
  const [editVisible, setEditVisible] = useState(false);
  const [addFlatVisible, setAddFlatVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!id) return;
    Alert.alert("Delete building?", "This permanently removes the building from your portfolio.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteBuilding(id);
            router.back();
          } catch (deleteError) {
            Alert.alert("Could not delete building", deleteError instanceof Error ? deleteError.message : "Try again.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { refresh(); refreshFlats(); }} tintColor={colors.primary} />}
    >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : error ? (
          <Text style={{ color: colors.danger }}>{error}</Text>
        ) : !building ? (
          <Text style={{ color: colors.textSub }}>Building not found, or it does not belong to your account.</Text>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{building.name}</Text>
            <View style={styles.addressRow}>
              <MapPin color={colors.textSub} size={14} />
              <Text style={[styles.subtitle, { color: colors.textSub }]}>{building.address}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setEditVisible(true)}>
                <Pencil color={colors.text} size={14} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator size="small" color={colors.danger} /> : <Trash2 color={colors.danger} size={14} />}
                <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {building ? (
        <>
          <View style={[styles.managerCard, { backgroundColor: colors.surface }]}>
            <User color={colors.primary} size={24} />
            <View style={styles.managerInfo}>
              <Text style={[styles.managerLabel, { color: colors.textSub }]}>Assigned manager</Text>
              <ManagerLabel value={building.assigned_manager} />
            </View>
          </View>

          <View style={[styles.detailsRow, { borderColor: colors.border }]}>
            <Detail label="Area" value={building.area || "—"} colors={colors} />
            <Detail label="Floors" value={String(building.floors)} colors={colors} />
            <Detail label="Total flats" value={String(building.total_flats)} colors={colors} />
            <Detail label="Status" value={buildingStatusLabel[building.status]} colors={colors} />
          </View>

          <View style={styles.listHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textSub, marginBottom: 0, paddingHorizontal: 0 }]}>Units</Text>
            <TouchableOpacity style={[styles.addChip, { backgroundColor: colors.primary }]} onPress={() => setAddFlatVisible(true)}>
              <Plus color="#ffffff" size={14} />
              <Text style={styles.addChipText}>Add flat</Text>
            </TouchableOpacity>
          </View>

          {flatsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : flats.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub }]}>No flats added yet.</Text>
          ) : (
            <View style={styles.list}>
              {flats.map((flat) => (
                <TouchableOpacity
                  key={flat.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/(owner)/tenant-details", params: { id: flat.id } })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={[styles.flatName, { color: colors.text }]}>Flat {flat.flat_number}</Text>
                    <View
                      style={[
                        styles.badge,
                        flat.occupancy_status === "occupied"
                          ? { backgroundColor: colors.successBg, borderColor: colors.success }
                          : { backgroundColor: colors.warningBg, borderColor: colors.warning },
                      ]}
                    >
                      <Text style={[styles.badgeText, { color: flat.occupancy_status === "occupied" ? colors.success : colors.warning }]}>
                        {occupancyLabel[flat.occupancy_status]}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.cardDetails, { borderTopColor: colors.border }]}>
                    <Text style={[styles.detailText, { color: colors.textSub }]}>
                      Rent: <Text style={{ color: colors.text, fontWeight: "600" }}>{formatBDT(flat.monthly_rent)}</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      ) : null}

      {building ? (
        <EditBuildingModal
          visible={editVisible}
          building={building}
          onClose={() => setEditVisible(false)}
          onSaved={() => {
            setEditVisible(false);
            refresh();
          }}
        />
      ) : null}

      {id ? (
        <AddFlatModal
          visible={addFlatVisible}
          buildingId={id}
          onClose={() => setAddFlatVisible(false)}
          onSaved={() => {
            setAddFlatVisible(false);
            refreshFlats();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function Detail({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={styles.detailBox}>
      <Text style={[styles.detailLabel, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function EditBuildingModal({
  visible,
  building,
  onClose,
  onSaved,
}: {
  visible: boolean;
  building: { name: string; address: string; area: string; floors: number; total_flats: number; assigned_manager: string; status: BuildingStatus };
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [name, setName] = useState(building.name);
  const [address, setAddress] = useState(building.address);
  const [area, setArea] = useState(building.area);
  const [floors, setFloors] = useState(String(building.floors));
  const [totalFlats, setTotalFlats] = useState(String(building.total_flats));
  const [assignedManager, setAssignedManager] = useState(building.assigned_manager);
  const [status, setStatus] = useState<BuildingStatus>(building.status);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await updateBuilding(id, {
        name,
        address,
        area,
        floors: Number(floors) || 0,
        total_flats: Number(totalFlats) || 0,
        assigned_manager: assignedManager,
        status,
      });
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not update building", submissionError instanceof Error ? submissionError.message : "Try again.");
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit building</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Building name</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={name} onChangeText={setName} placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Full address</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={address} onChangeText={setAddress} multiline placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Area</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={area} onChangeText={setArea} placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Number of floors</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={floors} onChangeText={setFloors} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Total flats</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={totalFlats} onChangeText={setTotalFlats} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Assigned manager (optional)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={assignedManager} onChangeText={setAssignedManager} placeholder="Manager name or email" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Status</Text>
            <View style={styles.chipRow}>
              {(["active", "inactive"] as BuildingStatus[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }, status === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
                  onPress={() => setStatus(option)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, status === option && { color: colors.primary }]}>{buildingStatusLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AddFlatModal({ visible, buildingId, onClose, onSaved }: { visible: boolean; buildingId: string; onClose: () => void; onSaved: () => void }) {
  const colors = useThemeColors();
  const [flatNumber, setFlatNumber] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [bedroomCount, setBedroomCount] = useState("");
  const [bathroomCount, setBathroomCount] = useState("");
  const [sizeSqft, setSizeSqft] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFlatNumber("");
    setFloorNumber("");
    setBedroomCount("");
    setBathroomCount("");
    setSizeSqft("");
    setMonthlyRent("");
  }

  async function handleSave() {
    setSaving(true);
    try {
      const input: FlatInput = {
        flat_number: flatNumber,
        floor_number: Number(floorNumber) || 0,
        bedroom_count: Number(bedroomCount) || 0,
        bathroom_count: Number(bathroomCount) || 0,
        size_sqft: Number(sizeSqft) || 0,
        monthly_rent: Number(monthlyRent) || 0,
        occupancy_status: "vacant",
        notes: "",
      };
      await createFlat(buildingId, input);
      reset();
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not add flat", submissionError instanceof Error ? submissionError.message : "Try again.");
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add flat</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Flat number</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={flatNumber} onChangeText={setFlatNumber} placeholder="e.g. A-01" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Floor number</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={floorNumber} onChangeText={setFloorNumber} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Bedrooms</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={bedroomCount} onChangeText={setBedroomCount} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Bathrooms</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={bathroomCount} onChangeText={setBathroomCount} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Size (sqft)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={sizeSqft} onChangeText={setSizeSqft} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Monthly rent (৳)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={monthlyRent} onChangeText={setMonthlyRent} keyboardType="decimal-pad" placeholderTextColor={colors.textSub} />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Add flat</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 48 : 24, paddingBottom: 20, borderBottomWidth: 1 },
  backBtn: { marginBottom: 12, width: 40, height: 40, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "800" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  subtitle: { fontSize: 13, flexShrink: 1 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, minHeight: 38, borderRadius: 10, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },

  // alignItems "flex-start" (not "center") so the icon stays pinned to the
  // top when the manager block grows to two lines (name + wrapped email)
  // instead of re-centering against the whole block's height.
  managerCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, margin: 20, padding: 16, borderRadius: 16 },
  managerInfo: { flex: 1 },
  managerLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  managerName: { fontSize: 16, fontWeight: "700", marginTop: 4 },

  detailsRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 20, gap: 16, paddingBottom: 20, borderBottomWidth: 1, marginBottom: 8 },
  // minWidth + flexGrow instead of a fixed width, so a box can widen (or
  // drop to one per row) instead of clipping its value under large fonts —
  // same technique as the dashboard's statBox.
  detailBox: { minWidth: 130, flexGrow: 1, flexBasis: "45%" },
  detailLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  detailValue: { fontSize: 14, fontWeight: "700", marginTop: 4 },

  listHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  addChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, minHeight: 34, borderRadius: 10 },
  addChipText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 },
  flatName: { fontSize: 17, fontWeight: "800" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  cardDetails: { borderTopWidth: 1, paddingTop: 10, gap: 6 },
  detailText: { fontSize: 13 },

  emptyText: { textAlign: "center", marginTop: 12, marginHorizontal: 20, fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
