import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import type { ManagerBuilding } from "@/lib/manager/shared";

/**
 * Horizontal pill selector for the buildings a manager is assigned to.
 * Reused across the dashboard, bills, payments, maintenance and expenses
 * screens instead of duplicating the same picker markup in each one.
 */
export function ManagerBuildingPicker({
  buildings,
  selected,
  onSelect,
  includeAll = false,
}: {
  buildings: ManagerBuilding[];
  selected: string;
  onSelect: (id: string) => void;
  includeAll?: boolean;
}) {
  const colors = useThemeColors();

  if (buildings.length === 0) return null;

  const options = includeAll ? [{ id: "all", name: "All buildings" }, ...buildings] : buildings;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {options.map((building) => {
        const active = building.id === selected;
        return (
          <TouchableOpacity
            key={building.id}
            style={[
              styles.pill,
              { backgroundColor: colors.surface, borderColor: colors.border },
              active && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => onSelect(building.id)}
          >
            <Text
              style={[styles.pillText, { color: colors.text }, active && { color: "#ffffff" }]}
              numberOfLines={1}
            >
              {building.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// Fixed (not flex-grown) height keeps the row compact and prevents it from
// stretching to fill a taller parent — it only ever takes the height of one
// row of pills, and that row scrolls horizontally when it overflows.
const PILL_HEIGHT = 48;

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { paddingHorizontal: 20, gap: 8, paddingVertical: 4, alignItems: "center" },
  pill: {
    height: PILL_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontSize: 13, fontWeight: "700" },
});
