import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string;
  role: "owner" | "manager" | "tenant";
};

type TenantDashboard = {
  buildingName: string;
  flatNumber: string;
  rent: {
    billing_month: string;
    total_payable: number;
    total_paid: number;
    remaining_due: number;
    payment_status: string;
    due_date: string;
  } | null;
};

export default function HomeScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<TenantDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setDashboardError(error.message);
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setDashboard(null);
        setDashboardError(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let active = true;
    const userId = session.user.id;

    async function loadDashboard() {
      setDashboardLoading(true);
      setDashboardError(null);
      setProfile(null);
      setDashboard(null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", userId)
        .single();

      if (profileError) {
        if (active) {
          setDashboardError(profileError.message);
          setDashboardLoading(false);
        }
        return;
      }

      if (!active) return;
      const currentProfile = profileData as Profile;
      setProfile(currentProfile);

      if (currentProfile.role !== "tenant") {
        setDashboardLoading(false);
        return;
      }

      const { data: flat, error: flatError } = await supabase
        .from("flats")
        .select("id, flat_number, building_id")
        .eq("tenant_id", userId)
        .maybeSingle();

      if (flatError) {
        if (active) setDashboardError(flatError.message);
        if (active) setDashboardLoading(false);
        return;
      }

      if (!flat) {
        if (active) {
          setDashboard(null);
          setDashboardLoading(false);
        }
        return;
      }

      const [{ data: building, error: buildingError }, { data: rent, error: rentError }] =
        await Promise.all([
          supabase.from("buildings").select("name").eq("id", flat.building_id).single(),
          supabase
            .from("rent_records")
            .select(
              "billing_month, total_payable, total_paid, remaining_due, payment_status, due_date",
            )
            .eq("tenant_id", userId)
            .eq("flat_id", flat.id)
            .order("billing_month", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      if (buildingError || rentError) {
        if (active) {
          setDashboardError((buildingError ?? rentError)?.message ?? "Unable to load dashboard.");
          setDashboardLoading(false);
        }
        return;
      }

      if (active) {
        setDashboard({
          buildingName: building.name,
          flatNumber: flat.flat_number,
          rent,
        });
        setDashboardLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [session]);

  function formatAmount(amount: number) {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Enter your email and password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert("Login failed", error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#639873" />
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.dashboardContent}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AP</Text>
          </View>

          <Text style={styles.eyebrow}>APT PILOT DASHBOARD</Text>
          <Text style={styles.title}>Welcome, {profile?.full_name || "there"}</Text>
          <Text style={styles.role}>{profile?.role || "Loading role..."}</Text>

          {dashboardLoading ? (
            <View style={styles.stateBox}>
              <ActivityIndicator size="large" color="#639873" />
              <Text style={styles.stateText}>Loading your dashboard...</Text>
            </View>
          ) : dashboardError ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Unable to load dashboard</Text>
              <Text style={styles.stateText}>{dashboardError}</Text>
            </View>
          ) : profile?.role !== "tenant" ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>Dashboard coming next.</Text>
            </View>
          ) : !dashboard ? (
            <View style={styles.stateBox}>
              <Text style={styles.stateTitle}>No assigned flat</Text>
              <Text style={styles.stateText}>
                Your assigned flat will appear here when available.
              </Text>
            </View>
          ) : (
            <View style={styles.dashboardCard}>
              <Text style={styles.cardLabel}>YOUR HOME</Text>
              <Text style={styles.buildingName}>{dashboard.buildingName}</Text>
              <Text style={styles.flatNumber}>Flat {dashboard.flatNumber}</Text>

              {dashboard.rent ? (
                <View style={styles.rentSection}>
                  <Text style={styles.cardLabel}>LATEST RENT</Text>
                  <Text style={styles.billingMonth}>{dashboard.rent.billing_month}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total payable</Text>
                    <Text style={styles.detailValue}>
                      {formatAmount(dashboard.rent.total_payable)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Verified paid</Text>
                    <Text style={styles.detailValue}>
                      {formatAmount(dashboard.rent.total_paid)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Remaining due</Text>
                    <Text style={styles.detailValue}>
                      {formatAmount(dashboard.rent.remaining_due)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment status</Text>
                    <Text style={styles.detailValue}>{dashboard.rent.payment_status}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due date</Text>
                    <Text style={styles.detailValue}>{dashboard.rent.due_date}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.stateText}>No rent record available yet.</Text>
              )}
            </View>
          )}

          <Pressable style={styles.button} onPress={signOut}>
            <Text style={styles.buttonText}>Log out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AP</Text>
          </View>
          <Text style={styles.brand}>AptPilot</Text>
        </View>

        <Text style={styles.eyebrow}>APARTMENT MANAGEMENT</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to access your AptPilot workspace.</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#9B95A5"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#9B95A5"
            secureTextEntry
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={signIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>Owners, managers and tenants use the same secure login.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FBF7F2",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBF7F2",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 46,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639873",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  brand: {
    marginLeft: 12,
    color: "#292332",
    fontSize: 24,
    fontWeight: "800",
  },
  eyebrow: {
    marginBottom: 10,
    color: "#639873",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: "#292332",
    fontSize: 38,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 30,
    color: "#777184",
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: 10,
  },
  label: {
    marginTop: 7,
    color: "#3B3543",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#DED6CE",
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    color: "#292332",
    fontSize: 16,
  },
  button: {
    height: 54,
    marginTop: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#639873",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  footer: {
    marginTop: 28,
    color: "#8A8492",
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },
  successCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  successText: {
    marginTop: 14,
    color: "#639873",
    fontSize: 17,
    fontWeight: "700",
  },
  email: {
    marginTop: 8,
    color: "#777184",
    fontSize: 15,
  },
  dashboardContent: {
    flexGrow: 1,
    padding: 26,
  },
  role: {
    marginTop: 8,
    color: "#639873",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  stateBox: {
    marginTop: 34,
    padding: 24,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  stateTitle: {
    color: "#292332",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  stateText: {
    marginTop: 10,
    color: "#777184",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  dashboardCard: {
    marginTop: 30,
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#292332",
  },
  cardLabel: {
    color: "#A7C9AF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  buildingName: {
    marginTop: 12,
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
  },
  flatNumber: {
    marginTop: 5,
    color: "#D8D2DE",
    fontSize: 16,
  },
  rentSection: {
    marginTop: 28,
    paddingTop: 22,
    borderTopWidth: 1,
    borderTopColor: "#51495C",
  },
  billingMonth: {
    marginTop: 8,
    marginBottom: 12,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#403849",
  },
  detailLabel: {
    flex: 1,
    color: "#B8B1C0",
    fontSize: 14,
  },
  detailValue: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
    textTransform: "capitalize",
  },
});
