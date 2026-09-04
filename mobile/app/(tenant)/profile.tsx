import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { Home, LogOut, Mail, Phone, User } from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";

type BuildingInfo = { name: string; address: string; managerName: string | null; managerPhone: string | null };
type FlatInfo = { flat_number: string };

/**
 * Ported from the Sanjida reference's app/(tenant)/profile.tsx, backed by
 * the real profile/flat/building/manager rows instead of hardcoded demo
 * text. Two reference sections are intentionally dropped rather than faked
 * (see AptPilot-architecture-comparison.md §9/§10):
 *  - The manual Dark Mode switch: theming now follows the device color
 *    scheme (see hooks/use-theme-colors.ts), matching the rest of the app.
 *  - "Lease Expiry" / "View Lease Agreement": there is no lease-term or
 *    lease-document field in the schema to back these.
 */
export default function TenantProfile() {
  const colors = useThemeColors();
  const { session, profile, signOut } = useAuth();

  const [flat, setFlat] = useState<FlatInfo | null>(null);
  const [building, setBuilding] = useState<BuildingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);

    const { data: flatRow, error: flatError } = await supabase
      .from("flats")
      .select("flat_number, building_id")
      .eq("tenant_id", session.user.id)
      .maybeSingle();

    if (flatError) {
      setError(flatError.message);
      setLoading(false);
      return;
    }
    if (!flatRow) {
      setFlat(null);
      setBuilding(null);
      setLoading(false);
      return;
    }
    setFlat({ flat_number: flatRow.flat_number });

    const { data: buildingRow, error: buildingError } = await supabase
      .from("buildings")
      .select("name, address, assigned_manager")
      .eq("id", flatRow.building_id)
      .maybeSingle();

    if (buildingError) {
      setError(buildingError.message);
      setLoading(false);
      return;
    }
    if (!buildingRow) {
      setBuilding(null);
      setLoading(false);
      return;
    }

    let managerName: string | null = null;
    let managerPhone: string | null = null;
    if (buildingRow.assigned_manager) {
      const { data: manager } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", buildingRow.assigned_manager)
        .maybeSingle();
      managerName = manager?.full_name ?? null;
      managerPhone = manager?.phone ?? null;
    }

    setBuilding({ name: buildingRow.name, address: buildingRow.address, managerName, managerPhone });
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch flat/building/manager details on every focus after the first
  // — this screen stays mounted once visited (react-navigation keeps
  // background tabs alive), so without this its own mount-time fetch above
  // never re-runs if an owner assigns/reassigns this tenant's flat while
  // the app is open. `load` is already a stable useCallback (only changes
  // with `session`), so it's safe to depend on directly. The first focus
  // is skipped since the effect above already fetches on mount.
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || "Tenant"}</Text>
        <Text style={[styles.role, { color: colors.textSub }]}>
          Tenant{flat ? ` · Unit ${flat.flat_number}` : ""}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
      ) : error ? (
        <View style={styles.section}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Contact Info</Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.row}>
                <Phone color={colors.textSub} size={20} />
                <Text style={[styles.rowText, { color: colors.text }]}>{profile?.phone || "Not provided"}</Text>
              </View>
              <View style={[styles.row, styles.borderTop, { borderTopColor: colors.border }]}>
                <Mail color={colors.textSub} size={20} />
                <Text style={[styles.rowText, { color: colors.text }]}>{profile?.email || "Not provided"}</Text>
              </View>
            </View>
          </View>

          {building ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Building Details</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <Home color={colors.textSub} size={20} />
                  <View>
                    <Text style={[styles.rowText, { color: colors.text }]}>{building.name}</Text>
                    <Text style={[styles.rowSubtext, { color: colors.textSub }]}>{building.address}</Text>
                  </View>
                </View>
                {building.managerName ? (
                  <View style={[styles.row, styles.borderTop, { borderTopColor: colors.border }]}>
                    <User color={colors.textSub} size={20} />
                    <View>
                      <Text style={[styles.rowText, { color: colors.text }]}>Manager: {building.managerName}</Text>
                      {building.managerPhone ? (
                        <Text style={[styles.rowSubtext, { color: colors.textSub }]}>{building.managerPhone}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Building Details</Text>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
                <Text style={{ color: colors.textSub }}>No assigned flat yet.</Text>
              </View>
            </View>
          )}
        </>
      )}

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
  rowText: { fontSize: 15, fontWeight: "600" },
  rowSubtext: { fontSize: 13, marginTop: 2 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 24, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: "700" },
});
