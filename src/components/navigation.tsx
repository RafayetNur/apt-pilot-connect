import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, LogOut, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, roleLabel, type Profile } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MobileBottomNav } from "@/components/mobile-nav";

export function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 className="h-5 w-5" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">AptPilot</span>
    </Link>
  );
}

const navByRole = {
  owner: [
    { label: "Dashboard", to: "/owner/dashboard" },
    { label: "Buildings", to: "/owner/buildings" },
    { label: "Rent", to: "/owner/rent" },
    { label: "Bills", to: "/owner/bills" },
    { label: "Payments", to: "/owner/payments" },
    { label: "Expenses", to: "/owner/expenses" },
    { label: "Maintenance", to: "/owner/maintenance" },
    { label: "Notices", to: "/owner/communication" },
    { label: "Reports", to: "/owner/reports" },
  ],
  manager: [
    { label: "Dashboard", to: "/manager/dashboard" },
    { label: "Bills", to: "/manager/bills" },
    { label: "Payments", to: "/manager/payments" },
    { label: "Expenses", to: "/manager/expenses" },
    { label: "Maintenance", to: "/manager/maintenance" },
    { label: "Notices", to: "/manager/communication" },
    { label: "Reports", to: "/manager/reports" },
  ],
  tenant: [
    { label: "Dashboard", to: "/tenant/dashboard" },
    { label: "Maintenance", to: "/tenant/maintenance" },
    { label: "Notices", to: "/tenant/notices" },
  ],
} as const;

export function ProfileMenu({ profile, email }: { profile: Profile | null; email: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initials = (profile?.full_name || email || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-card py-1 pl-1 pr-3 text-sm transition-colors hover:bg-muted"
          aria-label="Open profile menu"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {initials || <UserIcon className="h-4 w-4" />}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">
            {profile?.full_name || email}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-semibold">{profile?.full_name || "Your account"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          {profile ? (
          <p className="text-xs font-normal text-muted-foreground">
              Role: {roleLabel[profile.role]}
            </p>
          ) : null}
          {profile?.phone ? (
            <p className="text-xs font-normal text-muted-foreground">Phone: {profile.phone}</p>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profile ? (
          <DropdownMenuItem asChild>
            <Link to={dashboardPathFor(profile.role)}>Go to dashboard</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void handleSignOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppHeader({ profile, email }: { profile: Profile | null; email: string }) {
  const links = profile ? navByRole[profile.role] : [];
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  return (
    <>
    <header
      className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <BrandMark />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  isActive(link.to)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ProfileMenu profile={profile} email={email} />
        </div>
      </div>
    </header>
      <MobileBottomNav profile={profile} email={email} currentPath={currentPath} />
    </>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
