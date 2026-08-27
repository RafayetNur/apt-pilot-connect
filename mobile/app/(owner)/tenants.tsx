import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Search } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOwnerTenantRoster } from "@/lib/owner/flats";
import { formatBDT } from "@/lib/owner/shared";

/**
 * Owner tenant roster. Ported visually from the Sanjida reference's
 * app/(owner)/tenants.tsx (card list with rent + status), backed by every
 * occupied flat across the owner's buildings (RLS-scoped `flats`, joined to
 * `profiles`) instead of a hardcoded 3-tenant list. There is no separate
 * "lease status" (Active/Renewal/Ending) or "payment status" concept in the
 * schema — occupancy is a plain occupied/vacant flag, so this list shows
 * flat + rent + contact rather than the reference's fabricated statuses.
 */
export default function OwnerTenants() {
  const router = useRouter();
  const colors = useThemeColors();
  const { tenants, loading, refreshing, error, refresh } = useOwnerTenantRoster();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter(
      (row) =>
        row.tenant.full_name.toLowerCase().includes(term) ||
        row.flatNumber.toLowerCase().includes(term) ||
        row.buildingName.toLowerCase().includes(term),
    );
  }, [tenants, search]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Tenants</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Every tenant across your buildings</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search color={colors.textSub} size={18} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by tenant, flat or building"
          placeholderTextColor={colors.textSub}
        />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : filtered.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSub }]}>No tenants found.</Text>
        ) : (
          <View style={styles.list}>
            {filtered.map((row) => (
              <TouchableOpacity
                key={row.flatId}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/(owner)/tenant-details", params: { id: row.flatId } })}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.tenantName, { color: colors.text }]}>{row.tenant.full_name}</Text>
                    <Text style={[styles.flatText, { color: colors.textSub }]}>{row.buildingName} · Flat {row.flatNumber}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
                    <Text style={[styles.badgeText, { color: colors.success }]}>Occupied</Text>
                  </View>
                </View>
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.rentText, { color: colors.text }]}>Rent: {formatBDT(row.monthlyRent)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46 },
  searchInput: { flex: 1, fontSize: 14 },

  list: { padding: 20, paddingBottom: 40, gap: 12 },
  card: { borderRadius: 20, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 8 },
  tenantName: { fontSize: 16, fontWeight: "800" },
  flatText: { fontSize: 13, marginTop: 2 },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700" },

  cardFooter: { borderTopWidth: 1, paddingTop: 12 },
  rentText: { fontSize: 14, fontWeight: "600" },

  emptyText: { textAlign: "center", marginTop: 40, marginHorizontal: 20, fontSize: 14 },
});
