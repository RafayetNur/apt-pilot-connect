import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "tenant";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: AppRole;
  created_at: string;
};

export function dashboardPathFor(role: AppRole): string {
  return `/${role}/dashboard`;
}

export const roleLabel: Record<AppRole, string> = {
  owner: "Owner",
  manager: "Manager",
  tenant: "Tenant",
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (uid: string | undefined) => {
      if (!uid) {
        if (active) setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .eq("id", uid)
        .maybeSingle();
      if (active) setProfile((data as Profile | null) ?? null);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadProfile(nextSession?.user?.id);
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadProfile(data.session?.user?.id);
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user, profile, loading };
}
