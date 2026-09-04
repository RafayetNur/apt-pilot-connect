import { useCallback, useRef } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { Building, LogOut, Mail, Phone } from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOwnerBuildingsList } from "@/lib/owner/buildings";

/**
 * Owner profile. Ported from the manager mobile profile screen
 * (mobile/app/(manager)/profile.tsx), backed by the real profile row and
 * this owner's buildings instead of the Sanjida reference's hardcoded
 * "Mr. Rahman / Green View Apartments" demo text and fake Edit
 * Profile/Dark Mode controls (there is no profile-edit RPC and no
 * notification-preferences table to back real versions of either — see the
 * Owner integration report). Role is shown read-only; `profiles.role` is
 * server-side only and this app never offers a way to change it.
 */
export default function OwnerProfile() {
  const colors = useThemeColors();
  const { profile, signOut } = useAuth();
  const { buildings, loading, error, refresh } = useOwnerBuildingsList();

  // Buildings are added/edited from the Properties tab, which stays mounted
  // (not unmounted) once visited — react-navigation's bottom tabs keep
  // background tabs alive — so this screen's own mount-time fetch never
  // re-runs when the owner comes back here. Re-fetch on every focus after
  // the first so a building added elsewhere shows up without an app
  // restart. The first focus is skipped because useOwnerBuildingsList
  // already fetches once on mount; `refresh` itself isn't a stable
  // reference (a fresh closure each render), so the effect callback is
  // deliberately captured once with an empty dependency array — it still
  // calls the hook's underlying stable `load`, and this avoids the
  // callback identity changing every render, which would otherwise
  // re-trigger the focus effect (and reload) in a loop.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function handleLogout() {
    const { error } = await signOut();
    // signOut() clears the local session synchronously (see auth-context.tsx),
    // so the AuthGate (app/_layout.tsx) redirects to /login immediately
    // regardless of whether the server-side call below succeeded.
    if (error) {
      Alert.alert("Signed out", `You've been signed out on this device, but the server could not confirm it: ${error}`);
    }
  }

  const initials = (profile?.full_name || "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{profile?.full_name || "Owner"}</Text>
        <Text style={[styles.role, { color: colors.textSub }]} maxFontSizeMultiplier={1.3}>Owner</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Contact info</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Phone color={colors.textSub} size={20} />
            <Text style={[styles.rowText, styles.rowTextFlex, { color: colors.text }]}>{profile?.phone || "Not provided"}</Text>
          </View>
          <View style={[styles.row, styles.borderTop, { borderTopColor: colors.border }]}>
            <Mail color={colors.textSub} size={20} />
            <Text style={[styles.rowText, styles.rowTextFlex, { color: colors.text }]}>{profile?.email || "Not provided"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Your buildings</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : error ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </View>
        ) : buildings.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ color: colors.textSub }}>No buildings yet.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {buildings.map((building, index) => (
              <View key={building.id} style={[styles.row, index > 0 && styles.borderTop, index > 0 && { borderTopColor: colors.border }]}>
                <Building color={colors.textSub} size={20} />
                <View style={styles.rowTextFlex}>
                  <Text style={[styles.rowText, { color: colors.text }]}>{building.name}</Text>
                  <Text style={[styles.rowSubtext, { color: colors.textSub }]}>
                    {building.address} · {building.flatsTotal} units
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]} onPress={handleLogout}>
        <LogOut color={colors.danger} size={20} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { padding: 40, alignItems: "center", borderBottomWidth: 1 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  avatarText: { fontSize: 28, fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800" },
  role: { fontSize: 14, marginTop: 4, fontWeight: "500" },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingHorizontal: 4 },
  card: { borderRadius: 20, paddingHorizontal: 16, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 16 },
  borderTop: { borderTopWidth: 1 },
  rowTextFlex: { flex: 1 },
  rowText: { fontSize: 15, fontWeight: "600" },
  rowSubtext: { fontSize: 13, marginTop: 2 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 24, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: "700" },
});
