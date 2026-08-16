import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/navigation";
import { dashboardPathFor, useAuth } from "@/hooks/useAuth";

export function OwnerShell({ children }: { children: ReactNode }) {
  const { profile, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (profile && profile.role !== "owner") {
    return <Navigate to={dashboardPathFor(profile.role)} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader profile={profile} email={user?.email ?? ""} />
      <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-8">{children}</main>
    </div>
  );
}
