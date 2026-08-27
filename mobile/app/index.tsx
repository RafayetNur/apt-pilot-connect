import { useRouter } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/index.tsx (splash) merged with
 * app/welcome.tsx (Log In / Create Account CTA). The reference's role-picker
 * screen (app/workspace.tsx) is intentionally not ported: role comes from
 * the real `profiles.role` after authentication, not from a pre-login
 * choice — see AptPilot-architecture-comparison.md, section 5.
 */
export default function SplashScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { session, initializing } = useAuth();

  const resolvingSession = initializing || !!session;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.brandMark, { color: colors.text }]}>AptPilot</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
          <Text style={styles.logoText}>AP</Text>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>AptPilot</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>
          Smart apartment management for tenants, owners and managers.
        </Text>
      </View>

      <View style={styles.footer}>
        {resolvingSession ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              onPress={() => router.push("/login")}
            >
              <Text style={styles.primaryBtnText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => router.push("/signup")}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Create Account</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16 },
  brandMark: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  logoBox: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  logoText: { color: "#ffffff", fontSize: 24, fontWeight: "800" },
  title: { fontSize: 30, fontWeight: "800" },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 22, textAlign: "center" },
  footer: { padding: 24, paddingBottom: 32, minHeight: 130, justifyContent: "center" },
  actions: { gap: 14 },
  btn: { paddingVertical: 16, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryBtn: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {},
  secondaryBtnText: { fontSize: 16, fontWeight: "700" },
});
