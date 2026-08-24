import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';

/**
 * Segment-based redirect gate, ported from the Sanjida reference's
 * `app/_layout.tsx` (which drove the same kind of redirect off a Zustand
 * `isLoggedIn`/`role` pair). Here it is driven by the real Supabase session
 * and `profiles.role` from `useAuth()` instead.
 *
 * "tenant" and "manager" are live in this phase. `role` always comes from
 * the server-side `profiles.role` column (read-only from the client — RLS
 * does not allow a user to change their own role), so this redirect cannot
 * be spoofed by client state. Owner accounts still route to a placeholder
 * screen — see app/role-pending.tsx.
 */
function AuthGate() {
  const { session, role, initializing, profileLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inTenantGroup = segments[0] === '(tenant)';
    const inManagerGroup = segments[0] === '(manager)';
    const onRolePending = segments[0] === 'role-pending';

    if (!session) {
      if (inTenantGroup || inManagerGroup || onRolePending) router.replace('/');
      return;
    }

    // Session exists but the profile row (and therefore role) hasn't
    // resolved yet — wait rather than guessing where to send the user.
    if (profileLoading || role === null) return;

    if (role === 'tenant') {
      if (!inTenantGroup) router.replace('/(tenant)');
    } else if (role === 'manager') {
      if (!inManagerGroup) router.replace('/(manager)');
    } else if (!onRolePending) {
      router.replace('/role-pending');
    }
  }, [initializing, profileLoading, session, role, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="role-pending" />
      <Stack.Screen name="(tenant)" />
      <Stack.Screen name="(manager)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
