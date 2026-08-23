import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth-context";
import type { SelfServeRole } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/signup.tsx, with two deliberate
 * departures from the mock (see AptPilot-architecture-comparison.md §5, §9):
 *  - No "Building Invite Code" field: there is no backend endpoint that
 *    redeems such a code. Tenant-to-flat assignment is done by a
 *    manager/owner (`assignTenant` in src/lib/flats.ts), not self-service.
 *  - A role toggle replaces the reference's workspace pre-selection, and
 *    only offers Tenant/Owner — `handle_new_user()` (see supabase/migrations)
 *    silently downgrades any other self-signup role (including "manager")
 *    to "tenant", so offering it here would be misleading.
 */
const roles: { value: SelfServeRole; label: string }[] = [
  { value: "tenant", label: "Tenant" },
  { value: "owner", label: "Owner" },
];

export default function SignupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { signUp } = useAuth();

  const [role, setRole] = useState<SelfServeRole>("tenant");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Missing information", "Enter your name, email and a password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Use at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUp({
      email,
      password,
      fullName: name,
      phone,
      role,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert("Signup failed", error);
      return;
    }
    if (needsEmailConfirmation) {
      Alert.alert(
        "Check your email",
        "Confirm your address using the link we sent, then log in.",
        [{ text: "OK", onPress: () => router.replace("/login") }],
      );
    }
    // Otherwise a session was created immediately and the AuthGate
    // (app/_layout.tsx) will route by the new profile's role.
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>Join AptPilot</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>I am a</Text>
          <View style={styles.roleRow}>
            {roles.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.roleBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  role === option.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setRole(option.value)}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    { color: colors.text },
                    role === option.value && { color: "#ffffff" },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. Shanjida Ahamed"
            placeholderTextColor={colors.textSub}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSub}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="+880 1700 000000"
            placeholderTextColor={colors.textSub}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textSub}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={styles.termsContainer}>
            <Switch
              value={agreeTerms}
              onValueChange={setAgreeTerms}
              trackColor={{ false: colors.border, true: colors.primary + "80" }}
              thumbColor={agreeTerms ? colors.primary : colors.textSub}
            />
            <Text style={[styles.termsText, { color: colors.text }]}>
              I agree to the <Text style={[styles.termsLink, { color: colors.primary }]}>Terms of Service</Text> and{" "}
              <Text style={[styles.termsLink, { color: colors.primary }]}>Privacy Policy</Text>.
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: !agreeTerms || submitting ? colors.border : colors.primary },
            ]}
            onPress={handleSignup}
            disabled={!agreeTerms || submitting}
          >
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Create Account</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  topBar: { paddingHorizontal: 16, paddingTop: 16 },
  backBtn: { padding: 8 },
  content: { flex: 1, padding: 24, paddingTop: 16 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "800" },
  subtitle: { fontSize: 16, marginTop: 8 },
  form: { marginTop: 8 },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 16 },
  roleRow: { flexDirection: "row", gap: 12 },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  roleBtnText: { fontSize: 15, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  termsContainer: { flexDirection: "row", alignItems: "center", marginTop: 24, gap: 12 },
  termsText: { flex: 1, fontSize: 14, lineHeight: 20 },
  termsLink: { fontWeight: "600" },
  submitBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
