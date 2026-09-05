import { Tabs } from "expo-router";
import { Bell, FileText, Home, User, Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { TenantFlatProvider } from "@/lib/tenant/flats";

/**
 * Ported from the Sanjida reference's app/(tenant)/_layout.tsx. A "Notices"
 * tab is added (the reference's mock frontend omitted it) so the already-
 * tested, RLS-scoped notices/acknowledgement screen has a home in the
 * tenant navigation — see AptPilot-architecture-comparison.md §9/§10.
 *
 * TenantFlatProvider wraps the whole tab group (not each screen) so a
 * tenant's selected flat — for tenants assigned to more than one — is
 * shared and remembered across every tab, not re-resolved per screen.
 */
export default function TenantLayout() {
  const colors = useThemeColors();

  return (
    <TenantFlatProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSub,
          headerShown: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <Home color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="bills"
          options={{
            title: "Bills",
            tabBarIcon: ({ color }) => <FileText color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="repairs"
          options={{
            title: "Repairs",
            tabBarIcon: ({ color }) => <Wrench color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="notices"
          options={{
            title: "Notices",
            tabBarIcon: ({ color }) => <Bell color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color }) => <User color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="emergency"
          options={{
            href: null,
            title: "Emergency",
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            href: null,
            title: "AptBot",
          }}
        />
      </Tabs>
    </TenantFlatProvider>
  );
}
