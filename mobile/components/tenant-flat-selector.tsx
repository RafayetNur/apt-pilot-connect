import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import type { TenantFlat } from "@/lib/tenant/flats";

/**
 * Compact "Selected flat" field for tenants assigned to more than one flat,
 * reused across Home, Bills, Repairs, Profile and Emergency instead of
 * duplicating the same field + modal markup in each one — fixing this one
 * component fixes the picker everywhere it's used.
 *
 * - Zero flats: renders nothing — each screen has its own "no assigned
 *   flat" empty state.
 * - Exactly one flat: renders a compact, non-interactive read-only field
 *   (no chevron, no dialog) — nothing to choose from.
 * - More than one: renders the same compact field, in its current closed
 *   position, as a pressable row with a chevron; tapping it opens a
 *   React Native `<Modal>` showing every flat (building name, flat number,
 *   a highlighted row + checkmark on the current selection) in a
 *   vertically scrollable, centered dialog card.
 *
 * Every tenant screen sits inside a `<Tabs>` navigator with its own native
 * header, rendered outside this component's own view tree. Rather than
 * trying to out-rank that header in z-order (unreliable with
 * react-native-screens, and the previous attempt at it did not hold up on
 * a real device), the dialog card is instead *positioned* so it can never
 * reach the header/status-bar region in the first place: the overlay pads
 * itself by the real device safe-area insets (`useSafeAreaInsets`) before
 * centering the card inside what's left, so the card's own top edge always
 * sits below the safe area — and therefore below the header — regardless
 * of any native stacking-order quirk. `transparent` Modals already render
 * as a full-window overlay above the current screen by default on both
 * platforms; no extra `presentationStyle`/`statusBarTranslucent` override
 * is needed (or used) here.
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
  const insets = useSafeAreaInsets();
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

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        {/* Padding by the real safe-area insets (plus a small buffer) means the
            centered card below can never be laid out inside the header/status-bar
            strip at top, or the home-indicator/gesture-bar strip at bottom — a
            structural guarantee, not a z-order one. */}
        <Pressable
          style={[
            styles.overlay,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={[styles.dialog, { backgroundColor: colors.card }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.dialogHeader}>
              <Text style={[styles.dialogTitle, { color: colors.text }]}>Choose a flat</Text>
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
                    style={[
                      styles.row,
                      { borderColor: colors.border },
                      active ? { backgroundColor: colors.surface } : null,
                    ]}
                    onPress={() => {
                      onSelect(item.id);
                      setModalVisible(false);
                    }}
                  >
                    <View style={styles.rowText}>
                      <Text
                        style={[styles.rowBuilding, { color: active ? colors.primary : colors.text }]}
                        numberOfLines={1}
                      >
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

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    borderRadius: 24,
    padding: 24,
  },
  dialogHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  dialogTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, borderTopWidth: 1 },
  rowText: { flex: 1, marginRight: 12 },
  rowBuilding: { fontSize: 15, fontWeight: "700" },
  rowFlat: { marginTop: 2, fontSize: 13 },
});
