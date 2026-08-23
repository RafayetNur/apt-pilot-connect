import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/login.tsx. The mock `login(role, user)`
 * store call is replaced with `supabase.auth.signInWithPassword` (via useAuth);
 * post-login routing is handled centrally by the AuthGate in app/_layout.tsx
 * based on the real `profiles.role`, not a pre-selected role.
 */
export default function LoginScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Enter your email and password.");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      Alert.alert("Login failed", error);
    }
    // On success, the AuthGate (app/_layout.tsx) redirects once the
    // session and profile role resolve.
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>
            Log in to your AptPilot account
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
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

          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="••••••••"
            placeholderTextColor={colors.textSub}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.loginBtn, { backgroundColor: colors.primary }, submitting && styles.disabled]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.loginBtnText}>Log In</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  topBar: { paddingHorizontal: 16, paddingTop: 16 },
  backBtn: { padding: 8 },
  content: { flex: 1, padding: 24, paddingTop: 40 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: "800" },
  subtitle: { fontSize: 16, marginTop: 8 },
  form: { marginTop: 8 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  loginBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  disabled: { opacity: 0.65 },
  loginBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
