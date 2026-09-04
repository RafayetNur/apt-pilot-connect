import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Database["public"]["Enums"]["app_role"];
type Location = { buildingName: string; flatNumber: string };

export default function AccountScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    setProfile(profileRow);
    setRole(profileRow.role);
    if (profileRow.role === "tenant") {
      const { data: flat, error: flatError } = await supabase
        .from("flats")
        .select("flat_number, buildings(name)")
        .eq("tenant_id", userId)
        .maybeSingle();
      if (flatError) setError(flatError.message);
      else if (flat) {
        const row = flat as typeof flat & { buildings?: { name: string } | null };
        setLocation({
          buildingName: row.buildings?.name ?? "Building unavailable",
          flatNumber: row.flat_number,
        });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLocation(null);
      setRole(null);
      setLoading(false);
      return;
    }
    loadProfile(session.user.id);
  }, [session, loadProfile]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!session)
    return (
      <MessageScreen title="Log in to view your account" message="Open the Home tab to log in." />
    );
  if (!loading && role !== null && role !== "tenant") {
    return (
      <MessageScreen
        title="Account workspace coming later"
        message="Owner and manager account tools will be added in a future milestone."
        showLogout
        onLogout={signOut}
      />
    );
  }
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.title}>Account</Text>
        {loading ? (
          <State title="Loading your account..." />
        ) : error ? (
          <State title="Unable to load account" message={error} />
        ) : profile ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>FULL NAME</Text>
              <Text style={styles.value}>{profile.full_name || "Not provided"}</Text>
              <Text style={styles.label}>EMAIL</Text>
              <Text style={styles.value}>{profile.email}</Text>
              <Text style={styles.label}>PHONE</Text>
              <Text style={styles.value}>{profile.phone || "Not provided"}</Text>
              <Text style={styles.label}>ROLE</Text>
              <Text style={styles.value}>{profile.role}</Text>
            </View>
            {location ? (
              <View style={styles.card}>
                <Text style={styles.label}>ASSIGNED HOME</Text>
                <Text style={styles.value}>{location.buildingName}</Text>
                <Text style={styles.secondary}>Flat {location.flatNumber}</Text>
              </View>
            ) : null}
            <Pressable style={styles.button} onPress={signOut}>
              <Text style={styles.buttonText}>Log out</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function MessageScreen({
  title,
  message,
  showLogout = false,
  onLogout,
}: {
  title: string;
  message: string;
  showLogout?: boolean;
  onLogout?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.message}>
        <Text style={styles.eyebrow}>APT PILOT</Text>
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
        {showLogout && onLogout ? (
          <Pressable style={styles.button} onPress={onLogout}>
            <Text style={styles.buttonText}>Log out</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
function State({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.state}>
      {message ? null : <ActivityIndicator color="#639873" size="large" />}
      <Text style={styles.stateTitle}>{title}</Text>
      {message ? <Text style={styles.messageText}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FBF7F2" },
  content: { padding: 24 },
  eyebrow: { color: "#639873", fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  title: { marginTop: 8, color: "#292332", fontSize: 36, fontWeight: "800" },
  card: {
    marginTop: 20,
    padding: 19,
    borderWidth: 1,
    borderColor: "#E8E0D8",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  label: { marginTop: 10, color: "#639873", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  value: { marginTop: 4, color: "#292332", fontSize: 17, fontWeight: "700" },
  secondary: { marginTop: 5, color: "#777184", fontSize: 15 },
  button: {
    height: 52,
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639873",
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  state: {
    marginTop: 24,
    padding: 22,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  stateTitle: {
    marginTop: 9,
    color: "#292332",
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  message: { flex: 1, justifyContent: "center", padding: 26 },
  messageTitle: { marginTop: 12, color: "#292332", fontSize: 27, fontWeight: "800" },
  messageText: { marginTop: 10, color: "#777184", fontSize: 16, lineHeight: 23 },
});
