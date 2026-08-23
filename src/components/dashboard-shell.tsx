import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/navigation";
import { dashboardPathFor, roleLabel, useAuth, type AppRole } from "@/hooks/useAuth";

export function DashboardShell({
  role,
  title,
  intro,
  action,
  children,
}: {
  role: AppRole;
  title: string;
  intro: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const { profile, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  if (profile && profile.role !== role) {
    return <Navigate to={dashboardPathFor(profile.role)} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader profile={profile} email={user?.email ?? ""} />
      <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {roleLabel[role]} workspace
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
          </div>
          {action}
        </div>
        {children}
      </main>
    </div>
  );
}
