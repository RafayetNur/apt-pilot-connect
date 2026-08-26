import { useMemo, useState } from "react";
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
import { ArrowLeft, DollarSign, Mail, Pencil, Phone, Search, UserMinus, UserPlus } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOwnerFlatDetail, updateFlat, assignTenant, removeTenant, useTenantProfiles, occupancyLabel, type FlatInput } from "@/lib/owner/flats";
import { formatBDT } from "@/lib/owner/shared";

/**
 * Owner flat + tenant detail. Ported visually from the Sanjida reference's
 * app/(owner)/tenant-details.tsx (lease card, contact rows), backed by the
 * real `flats` row and its `tenant_id` join to `profiles`. Assigning a
 * tenant picks an actual tenant profile id from the real `profiles` table
 * (role = "tenant") and writes it the same way the web app's
 * src/lib/flats.ts assignTenant()/removeTenant() do — never a typed name.
 */
export default function OwnerTenantDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { detail, loading, error, refresh } = useOwnerFlatDetail(id ?? null);
  const [editVisible, setEditVisible] = useState(false);
  const [assignVisible, setAssignVisible] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemoveTenant() {
    if (!id) return;
    Alert.alert("Remove tenant?", "This clears the flat's tenant and marks it vacant.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setRemoving(true);
          try {
            await removeTenant(id);
            refresh();
          } catch (removeError) {
            Alert.alert("Could not remove tenant", removeError instanceof Error ? removeError.message : "Try again.");
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>{detail ? `Flat ${detail.flat.flat_number}` : "Flat"}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      ) : !detail ? (
        <Text style={[styles.emptyText, { color: colors.textSub }]}>Flat not found, or it does not belong to your account.</Text>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentScroll}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.unitText, { color: colors.textSub }]}>{detail.buildingName}</Text>
                <Text style={[styles.leaseTitle, { color: colors.text }]}>Flat {detail.flat.flat_number}</Text>
              </View>
              <View
                style={[
                  styles.badge,
                  detail.flat.occupancy_status === "occupied"
                    ? { backgroundColor: colors.successBg, borderColor: colors.success }
                    : { backgroundColor: colors.warningBg, borderColor: colors.warning },
                ]}
              >
                <Text style={[styles.badgeText, { color: detail.flat.occupancy_status === "occupied" ? colors.success : colors.warning }]}>
                  {occupancyLabel[detail.flat.occupancy_status]}
                </Text>
              </View>
            </View>

            <View style={[styles.detailsList, { borderTopColor: colors.border }]}>
              <View style={styles.detailRow}>
                <DollarSign color={colors.textSub} size={18} />
                <Text style={[styles.detailText, { color: colors.text }]}>Rent: {formatBDT(detail.flat.monthly_rent)}</Text>
              </View>
              {detail.tenant ? (
                <>
                  <View style={styles.detailRow}>
                    <Mail color={colors.textSub} size={18} />
                    <Text style={[styles.detailText, { color: colors.text }]}>{detail.tenant.email || "N/A"}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Phone color={colors.textSub} size={18} />
                    <Text style={[styles.detailText, { color: colors.text }]}>{detail.tenant.phone || "N/A"}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setEditVisible(true)}>
                <Pencil color={colors.text} size={14} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit flat</Text>
              </TouchableOpacity>
              {detail.tenant ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
                  onPress={handleRemoveTenant}
                  disabled={removing}
                >
                  {removing ? <ActivityIndicator size="small" color={colors.danger} /> : <UserMinus color={colors.danger} size={14} />}
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>Remove tenant</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setAssignVisible(true)}>
                  <UserPlus color="#ffffff" size={14} />
                  <Text style={[styles.actionBtnText, { color: "#ffffff" }]}>Assign tenant</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {detail ? (
        <EditFlatModal
          visible={editVisible}
          flatId={detail.flat.id}
          flat={detail.flat}
          onClose={() => setEditVisible(false)}
          onSaved={() => {
            setEditVisible(false);
            refresh();
          }}
        />
      ) : null}

      {id ? (
        <AssignTenantModal
          visible={assignVisible}
          flatId={id}
          onClose={() => setAssignVisible(false)}
          onAssigned={() => {
            setAssignVisible(false);
            refresh();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function EditFlatModal({
  visible,
  flatId,
  flat,
  onClose,
  onSaved,
}: {
  visible: boolean;
  flatId: string;
  flat: { flat_number: string; floor_number: number; bedroom_count: number; bathroom_count: number; size_sqft: number; monthly_rent: number; occupancy_status: FlatInput["occupancy_status"]; notes: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [flatNumber, setFlatNumber] = useState(flat.flat_number);
  const [monthlyRent, setMonthlyRent] = useState(String(flat.monthly_rent));
  const [floorNumber, setFloorNumber] = useState(String(flat.floor_number));
  const [notes, setNotes] = useState(flat.notes);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateFlat(flatId, {
        flat_number: flatNumber,
        floor_number: Number(floorNumber) || 0,
        bedroom_count: flat.bedroom_count,
        bathroom_count: flat.bathroom_count,
        size_sqft: flat.size_sqft,
        monthly_rent: Number(monthlyRent) || 0,
        occupancy_status: flat.occupancy_status,
        notes,
      });
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not update flat", submissionError instanceof Error ? submissionError.message : "Try again.");
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit flat</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Flat number</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={flatNumber} onChangeText={setFlatNumber} placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Floor number</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={floorNumber} onChangeText={setFloorNumber} keyboardType="number-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Monthly rent (৳)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={monthlyRent} onChangeText={setMonthlyRent} keyboardType="decimal-pad" placeholderTextColor={colors.textSub} />

            <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]} value={notes} onChangeText={setNotes} multiline placeholderTextColor={colors.textSub} />

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AssignTenantModal({ visible, flatId, onClose, onAssigned }: { visible: boolean; flatId: string; onClose: () => void; onAssigned: () => void }) {
  const colors = useThemeColors();
  const { tenants, loading } = useTenantProfiles();
  const [search, setSearch] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => tenant.full_name.toLowerCase().includes(term) || tenant.email.toLowerCase().includes(term));
  }, [tenants, search]);

  async function handleAssign(tenantId: string) {
    setAssigningId(tenantId);
    try {
      await assignTenant(flatId, tenantId);
      onAssigned();
    } catch (assignError) {
      Alert.alert("Could not assign tenant", assignError instanceof Error ? assignError.message : "Try again.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: "80%" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Assign tenant</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Search color={colors.textSub} size={18} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search tenants by name or email"
              placeholderTextColor={colors.textSub}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : filtered.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSub }]}>No tenant accounts found. Tenants must sign up before they can be assigned.</Text>
          ) : (
            <ScrollView style={{ marginTop: 12 }}>
              {filtered.map((tenant) => (
                <TouchableOpacity
                  key={tenant.id}
                  style={[styles.tenantRow, { borderColor: colors.border }]}
                  onPress={() => handleAssign(tenant.id)}
                  disabled={assigningId !== null}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tenantName, { color: colors.text }]}>{tenant.full_name}</Text>
                    <Text style={[styles.tenantSub, { color: colors.textSub }]}>{tenant.email}</Text>
                  </View>
                  {assigningId === tenant.id ? <ActivityIndicator size="small" color={colors.primary} /> : <UserPlus color={colors.primary} size={18} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 4 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800" },

  content: { flex: 1, padding: 20 },
  contentScroll: { paddingBottom: 60 },
  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },

  card: { borderRadius: 24, padding: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 8 },
  unitText: { fontSize: 13, fontWeight: "500" },
  leaseTitle: { fontSize: 22, fontWeight: "800", marginTop: 4 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700" },

  detailsList: { gap: 16, borderTopWidth: 1, paddingTop: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailText: { flex: 1, fontSize: 15, fontWeight: "600" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 14 },

  tenantRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1 },
  tenantName: { fontSize: 14, fontWeight: "700" },
  tenantSub: { fontSize: 12, marginTop: 2 },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
