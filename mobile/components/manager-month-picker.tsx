import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { formatMonthLabel, monthToDate, shiftMonthInput } from "@/lib/manager/shared";

/** Prev/next month stepper for the "YYYY-MM" inputs the manager bill/expense
 * screens filter by. Reused across the dashboard, bills and expenses screens. */
export function ManagerMonthPicker({ month, onChange }: { month: string; onChange: (next: string) => void }) {
  const colors = useThemeColors();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => onChange(shiftMonthInput(month, -1))}
      >
        <ChevronLeft color={colors.text} size={18} />
      </TouchableOpacity>
      <Text style={[styles.label, { color: colors.text }]}>{formatMonthLabel(monthToDate(month))}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => onChange(shiftMonthInput(month, 1))}
      >
        <ChevronRight color={colors.text} size={18} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  button: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "700", minWidth: 130, textAlign: "center" },
});
