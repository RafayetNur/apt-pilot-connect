import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ClipboardList,
  Home,
  LayoutGrid,
  LogOut,
  Megaphone,
  Receipt,
  Wallet,
  Wrench,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, type Profile, type AppRole } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type NavItem = { label: string; to: string; icon: LucideIcon };

const primaryByRole: Record<AppRole, NavItem[]> = {
  owner: [
    { label: "Home", to: "/owner/dashboard", icon: Home },
    { label: "Properties", to: "/owner/buildings", icon: Building2 },
    { label: "Rent", to: "/owner/rent", icon: Wallet },
    { label: "Repairs", to: "/owner/maintenance", icon: Wrench },
  ],
  manager: [
    { label: "Home", to: "/manager/dashboard", icon: Home },
    { label: "Bills", to: "/manager/bills", icon: Receipt },
    { label: "Payments", to: "/manager/payments", icon: Wallet },
    { label: "Repairs", to: "/manager/maintenance", icon: Wrench },
  ],
  tenant: [
    { label: "Home", to: "/tenant/dashboard", icon: Home },
    { label: "Repairs", to: "/tenant/maintenance", icon: Wrench },
    { label: "Notices", to: "/tenant/notices", icon: Megaphone },
  ],
};

const moreByRole: Record<AppRole, NavItem[]> = {
  owner: [
    { label: "Bills", to: "/owner/bills", icon: Receipt },
    { label: "Payments", to: "/owner/payments", icon: Wallet },
    { label: "Expenses", to: "/owner/expenses", icon: ClipboardList },
    { label: "Notices", to: "/owner/communication", icon: Megaphone },
    { label: "Reports", to: "/owner/reports", icon: BarChart3 },
  ],
  manager: [
    { label: "Expenses", to: "/manager/expenses", icon: ClipboardList },
    { label: "Notices", to: "/manager/communication", icon: Megaphone },
    { label: "Reports", to: "/manager/reports", icon: BarChart3 },
  ],
  tenant: [],
};

function isActivePath(currentPath: string, path: string) {
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export function MobileBottomNav({
  profile,
  email,
  currentPath,
}: {
  profile: Profile | null;
  email: string;
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!profile) return null;
  const primary = primaryByRole[profile.role];
  const more = moreByRole[profile.role];
  const moreActive = more.some((item) => isActivePath(currentPath, item.to));

  async function handleSignOut() {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const itemClass =
    "flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch gap-0.5 px-2 py-1.5">
        {primary.map((item) => {
          const active = isActivePath(currentPath, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                itemClass,
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="More navigation and account options"
              className={cn(
                itemClass,
                moreActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <LayoutGrid className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center">More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <SheetHeader className="text-left">
              <SheetTitle className="font-display">
                {profile.full_name || email}
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {roleLabel[profile.role]} · {email}
              </p>
            </SheetHeader>
            {more.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {more.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(currentPath, item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-[44px] items-center gap-3 rounded-xl border border-border/50 px-3 py-3 text-sm font-medium",
                        active ? "bg-accent text-accent-foreground" : "bg-card text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="mt-3 flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-border/50 px-3 py-3 text-sm font-medium text-destructive"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
