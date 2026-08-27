import { Tabs } from "expo-router";
import { Building2, Home, User, Wallet, Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/(owner)/_layout.tsx (same
 * header-shown Tabs shape, same "extra screens via hidden href:null routes"
 * pattern it used for property-details/tenant-details/maintenance-details/
 * manager-details/activity/notices). The visible tab set is narrowed to a
 * 5-tab shape matching the tenant and manager tab bars (see
 * app/(tenant)/_layout.tsx, app/(manager)/_layout.tsx) so the bottom bar
 * stays readable on a narrow screen: Home, Properties, Payments,
 * Maintenance, Profile. Tenants, Managers, Rent, Bills, Expenses, Notices
 * and Reports are reachable from the dashboard's quick actions as hidden
 * routes, the same way the manager tab bar hides Notices/Expenses.
 *
 * The reference's dedicated "Activity" screen and "manager-details" screen
 * are not ported — see the Owner integration report for why.
 *
 * `tabBarAllowFontScaling: false` keeps the 5 bottom-tab labels from
 * growing (and truncating/wrapping) under Android's larger accessibility
 * font settings — a targeted cap on this one compact nav element, not a
 * global disable of font scaling (every screen's own content still scales
 * normally).
 */
export default function OwnerLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        tabBarAllowFontScaling: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <Home color={color} size={24} /> }} />
      <Tabs.Screen name="properties" options={{ title: "Properties", tabBarIcon: ({ color }) => <Building2 color={color} size={24} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color }) => <Wallet color={color} size={24} /> }} />
      <Tabs.Screen name="maintenance" options={{ title: "Maintenance", tabBarIcon: ({ color }) => <Wrench color={color} size={24} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User color={color} size={24} /> }} />

      <Tabs.Screen name="property-details" options={{ href: null, title: "Building" }} />
      <Tabs.Screen name="tenant-details" options={{ href: null, title: "Flat" }} />
      <Tabs.Screen name="tenants" options={{ href: null, title: "Tenants" }} />
      <Tabs.Screen name="managers" options={{ href: null, title: "Managers" }} />
      <Tabs.Screen name="rent" options={{ href: null, title: "Rent" }} />
      <Tabs.Screen name="bills" options={{ href: null, title: "Bills" }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: "Expenses" }} />
      <Tabs.Screen name="notices" options={{ href: null, title: "Notices" }} />
      <Tabs.Screen name="reports" options={{ href: null, title: "Reports" }} />
      <Tabs.Screen name="maintenance-details" options={{ href: null, title: "Request Details" }} />
    </Tabs>
  );
}
