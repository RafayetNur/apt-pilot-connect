import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import type { TenantFlat } from "@/lib/tenant/flats";

/**
 * Compact "Selected flat" field for tenants assigned to more than one flat,
 * reused across Home, Bills, Repairs, Profile and Emergency instead of
 * duplicating the same field + modal markup in each one.
 *
 * - Zero flats: renders nothing — each screen has its own "no assigned
 *   flat" empty state.
 * - Exactly one flat: renders a compact, non-interactive read-only field
 *   (no chevron, no modal) — nothing to choose from.
 * - More than one: renders the same compact field as a pressable row with
 *   a chevron; tapping it opens a bottom-sheet modal listing every flat
 *   (building name, flat number, a checkmark on the current selection) in
 *   a scrollable list, so it stays usable at 4-5+ flats.
 */
export function TenantFlatSelector({
  flats,
  selectedId,
  onSelect,
}: {
  flats: TenantFlat[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const colors = useThemeColors();
  const [modalVisible, setModalVisible] = useState(false);

  if (flats.length === 0) return null;

  const selected = flats.find((flat) => flat.id === selectedId) ?? null;
  const multiple = flats.length > 1;
  const label = selected ? `${selected.building_name} · ${selected.flat_number}` : "Choose a flat";

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={multiple ? () => setModalVisible(true) : undefined}
        disabled={!multiple}
        activeOpacity={multiple ? 0.7 : 1}
      >
        <View style={styles.fieldText}>
          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Selected flat</Text>
          <Text style={[styles.fieldValue, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {multiple ? <ChevronDown color={colors.textSub} size={20} /> : null}
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose a flat</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={flats}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const active = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderColor: colors.border }]}
                    onPress={() => {
                      onSelect(item.id);
                      setModalVisible(false);
                    }}
                  >
                    <View style={styles.rowText}>
                      <Text style={[styles.rowBuilding, { color: colors.text }]} numberOfLines={1}>
                        {item.building_name}
                      </Text>
                      <Text style={[styles.rowFlat, { color: colors.textSub }]}>Flat {item.flat_number}</Text>
                    </View>
                    {active ? <Check color={colors.primary} size={20} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, marginBottom: 4 },
  field: {
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldText: { flex: 1, marginRight: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { marginTop: 2, fontSize: 15, fontWeight: "700" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "70%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderTopWidth: 1 },
  rowText: { flex: 1, marginRight: 12 },
  rowBuilding: { fontSize: 15, fontWeight: "700" },
  rowFlat: { marginTop: 2, fontSize: 13 },
});
