import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Roles a person may claim for themselves at signup. This intentionally
 * excludes "manager" — `handle_new_user()` (supabase/migrations) silently
 * downgrades any self-signup role other than "owner"/"tenant" to "tenant",
 * so offering "manager" here would be misleading. Manager accounts are
 * created by an owner via the `assign_user_role` RPC (see src/lib in the
 * web app), which is out of scope for this tenant-focused phase.
 */
export type SelfServeRole = Extract<AppRole, "owner" | "tenant">;

type AuthResult = { error: string | null };
type SignUpResult = { error: string | null; needsEmailConfirmation: boolean };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  /** True until the very first session check has resolved. */
  initializing: boolean;
  /** True while a profile row is being (re)fetched for the current session. */
  profileLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: SelfServeRole;
  }) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data ?? null);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      if (active) setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession) {
        void loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      role: SelfServeRole;
    }): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            phone: params.phone.trim(),
            role: params.role,
          },
        },
      });
      return {
        error: error?.message ?? null,
        // When email confirmation is required, Supabase returns a user but
        // no session; the caller should send the person to the login
        // screen with a "check your email" message instead of expecting
        // the AuthGate to pick up a session automatically.
        needsEmailConfirmation: !error && !data.session,
      };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      initializing,
      profileLoading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, initializing, profileLoading, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
