import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { Building, LogOut, Mail, Phone } from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";

type AssignedBuilding = { id: string; name: string; address: string; total_flats: number };

/**
 * Ported from the Sanjida reference's app/(manager)/profile.tsx, backed by
 * the real profile row and the manager's assigned buildings instead of the
 * hardcoded "Ayesha Rahman / Green View Apartments" demo text. The
 * reference's manual Dark Mode switch and static notification-preference
 * rows are dropped — theming follows the device color scheme (see
 * hooks/use-theme-colors.ts, matching the tenant profile screen) and there
 * is no notification-preferences table to back per-toggle settings yet.
 */
export default function ManagerProfile() {
  const colors = useThemeColors();
  const { session, profile, signOut } = useAuth();

  const [buildings, setBuildings] = useState<AssignedBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("buildings")
      .select("id, name, address, total_flats")
      .order("name", { ascending: true });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setBuildings(data ?? []);
    }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch assigned buildings on every focus after the first — this
  // screen stays mounted once visited (react-navigation keeps background
  // tabs alive), so without this its own mount-time fetch above never
  // re-runs if an owner reassigns/adds a building while the app is open.
  // `load` is already a stable useCallback (only changes with `session`),
  // so it's safe to depend on directly. The first focus is skipped since
  // the effect above already fetches on mount.
  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      load();
    }, [load]),
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
        <Text style={[styles.name, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{profile?.full_name || "Manager"}</Text>
        <Text style={[styles.role, { color: colors.textSub }]} maxFontSizeMultiplier={1.3}>Property manager</Text>
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
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Assigned buildings</Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : error ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </View>
        ) : buildings.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ color: colors.textSub }}>No building assigned yet.</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {buildings.map((building, index) => (
              <View
                key={building.id}
                style={[styles.row, index > 0 && styles.borderTop, index > 0 && { borderTopColor: colors.border }]}
              >
                <Building color={colors.textSub} size={20} />
                <View style={styles.rowTextFlex}>
                  <Text style={[styles.rowText, { color: colors.text }]}>{building.name}</Text>
                  <Text style={[styles.rowSubtext, { color: colors.textSub }]}>
                    {building.address} · {building.total_flats} units
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}
        onPress={handleLogout}
      >
        <LogOut color={colors.danger} size={20} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
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
  // Lets the text block wrap instead of overflowing past the icon on a
  // narrow screen — long emails/addresses would otherwise run past the card.
  rowTextFlex: { flex: 1 },
  rowText: { fontSize: 15, fontWeight: "600" },
  rowSubtext: { fontSize: 13, marginTop: 2 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 24, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: "700" },
});
