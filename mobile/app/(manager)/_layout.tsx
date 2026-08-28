import { Tabs } from "expo-router";
import { FileText, Home, User, Wallet, Wrench } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/(manager)/_layout.tsx (same
 * header-shown Tabs shape, same "extra screens via hidden href:null routes"
 * pattern the reference used for properties/charges/utilities). The visible
 * tab set is narrowed to the operational MVP this phase ports — Home, Bills,
 * Payments, Maintenance, Profile — matching the tenant tab bar's 5-tab shape
 * (see app/(tenant)/_layout.tsx). Notices and Expenses are reachable from
 * the dashboard's quick actions as hidden routes, the same way the
 * reference hid Properties/Charges/Utilities behind its dashboard's
 * QuickActions grid instead of the tab bar.
 */
export default function ManagerLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSub,
        // Caps the 5 bottom-tab labels so they don't grow (and
        // truncate/wrap) under Android's larger accessibility font
        // settings — matches app/(owner)/_layout.tsx's fix for the same
        // tab bar shape. Only this compact nav element is capped; every
        // screen's own content still scales normally.
        tabBarAllowFontScaling: false,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color }) => <Home color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="bills"
        options={{ title: "Bills", tabBarIcon: ({ color }) => <FileText color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: "Payments", tabBarIcon: ({ color }) => <Wallet color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{ title: "Maintenance", tabBarIcon: ({ color }) => <Wrench color={color} size={24} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color }) => <User color={color} size={24} /> }}
      />
      <Tabs.Screen name="notices" options={{ href: null, title: "Notices" }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: "Expenses" }} />
      <Tabs.Screen name="maintenance-details" options={{ href: null, title: "Request Details" }} />
    </Tabs>
  );
}
