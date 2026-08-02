import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/navigation";
import { dashboardPathFor, roleLabel, useAuth, type AppRole } from "@/hooks/useAuth";

export function DashboardShell({
  role,
  title,
  intro,
  children,
}: {
  role: AppRole;
  title: string;
  intro: string;
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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {roleLabel[role]} workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>

        <section className="panel mt-8 p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold">Your profile</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Full name</dt>
              <dd className="mt-1 text-sm font-medium">{profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
              <dd className="mt-1 text-sm font-medium">{profile?.email || user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
              <dd className="mt-1 text-sm font-medium">{profile?.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
              <dd className="mt-1 text-sm font-medium">
                {profile ? roleLabel[profile.role] : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {children}

        <section className="mt-6 rounded-xl border border-dashed border-border bg-surface p-6">
          <h2 className="font-display text-base font-semibold">Coming next</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Buildings, flats, bills, payments, expenses and repairs will appear here as each module
            is added. No placeholder numbers are shown until real data exists.
          </p>
        </section>
      </main>
    </div>
  );
}
