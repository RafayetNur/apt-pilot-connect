import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
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
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
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
        <View style={styles.successCard}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AP</Text>
          </View>

          <Text style={styles.title}>Welcome to AptPilot</Text>
          <Text style={styles.successText}>Backend login successful</Text>
          <Text style={styles.email}>{session.user.email}</Text>

          <Pressable style={styles.button} onPress={signOut}>
            <Text style={styles.buttonText}>Log out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AP</Text>
          </View>
          <Text style={styles.brand}>AptPilot</Text>
        </View>

        <Text style={styles.eyebrow}>APARTMENT MANAGEMENT</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Log in to access your AptPilot workspace.
        </Text>

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
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Owners, managers and tenants use the same secure login.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FBF7F2',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBF7F2',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 46,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#639873',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  brand: {
    marginLeft: 12,
    color: '#292332',
    fontSize: 24,
    fontWeight: '800',
  },
  eyebrow: {
    marginBottom: 10,
    color: '#639873',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    color: '#292332',
    fontSize: 38,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 30,
    color: '#777184',
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    gap: 10,
  },
  label: {
    marginTop: 7,
    color: '#3B3543',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#DED6CE',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    color: '#292332',
    fontSize: 16,
  },
  button: {
    height: 54,
    marginTop: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#639873',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    marginTop: 28,
    color: '#8A8492',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  successCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  successText: {
    marginTop: 14,
    color: '#639873',
    fontSize: 17,
    fontWeight: '700',
  },
  email: {
    marginTop: 8,
    color: '#777184',
    fontSize: 15,
  },
});