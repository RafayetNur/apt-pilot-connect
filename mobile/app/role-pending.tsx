import { Wrench } from "lucide-react-native";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Shown to owner/manager accounts. Only the tenant experience has been
 * ported in this phase (Phase 1–3 of the integration plan) — owner and
 * manager screens are a separate, later phase. This is an honest holding
 * screen, not a stand-in for real owner/manager functionality.
 */
export default function RolePendingScreen() {
  const colors = useThemeColors();
  const { profile, signOut } = useAuth();

  const roleLabel = profile?.role === "owner" ? "Owner" : profile?.role === "manager" ? "Manager" : "Your";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
          <Wrench color={colors.primary} size={28} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{roleLabel} workspace</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          The {roleLabel.toLowerCase()} mobile experience is still being integrated. Please use
          the AptPilot web app in the meantime — your account and data are unaffected.
        </Text>
        <Pressable style={[styles.button, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]} onPress={signOut}>
          <Text style={[styles.buttonText, { color: colors.danger }]}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  iconBox: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 12, fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: {
    marginTop: 32,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
});
