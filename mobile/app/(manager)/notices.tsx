import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Bell, Plus } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { ManagerBuildingPicker } from "@/components/manager-building-picker";
import { formatDateSafe, useManagerBuildings } from "@/lib/manager/shared";
import {
  createAndPublishNotice,
  noticeAudienceLabel,
  noticePriorityLabel,
  noticePriorityOptions,
  useManagerNotices,
  type NoticeAudience,
  type NoticePriority,
} from "@/lib/manager/notices";

/**
 * Manager notice board. Ported visually from the Sanjida reference's
 * app/(manager)/notices.tsx (header, card list, FAB), replaced with the
 * real `notice_create` + `notice_publish` RPC flow from the web app's
 * src/lib/communication.ts. Only "all tenants" and "owner/manager only"
 * audiences are offered here — see the Manager integration report for why
 * selected-flats/selected-tenants targeting was left out of this pass.
 */
export default function ManagerNotices() {
  const colors = useThemeColors();
  const { buildings, loading: buildingsLoading } = useManagerBuildings();
  const [buildingId, setBuildingId] = useState("all");
  const { notices, loading, refreshing, error, refresh } = useManagerNotices(buildingId);
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
        <Text style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={1.3}>Notices</Text>
        <Text style={[styles.subtitle, { color: colors.textSub }]}>Announcements for your buildings</Text>
      </View>

      {buildingsLoading ? null : <ManagerBuildingPicker buildings={buildings} selected={buildingId} onSelect={setBuildingId} includeAll />}

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh()} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
        ) : notices.length === 0 ? (
          <View style={styles.emptyBox}>
            <Bell color={colors.textSub} size={28} />
            <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 10 }]}>No notices posted yet.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notices.map((notice) => (
              <View key={notice.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{notice.title}</Text>
                  <Text style={[styles.cardDate, { color: colors.textSub }]}>{formatDateSafe(notice.published_at ?? notice.created_at)}</Text>
                </View>
                <Text style={[styles.metaText, { color: colors.textSub }]}>
                  {notice.building_name} · {noticePriorityLabel[notice.priority]} · {notice.status}
                </Text>
                <Text style={[styles.cardContent, { color: colors.textSub }]}>{notice.content}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setModalVisible(true)}>
        <Plus color="#ffffff" size={24} />
      </TouchableOpacity>

      <AddNoticeModal
        visible={modalVisible}
        buildings={buildings}
        defaultBuildingId={buildingId !== "all" ? buildingId : (buildings[0]?.id ?? "")}
        onClose={() => setModalVisible(false)}
        onSaved={() => {
          setModalVisible(false);
          refresh();
        }}
      />
    </View>
  );
}

function AddNoticeModal({
  visible,
  buildings,
  defaultBuildingId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  buildings: { id: string; name: string }[];
  defaultBuildingId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const colors = useThemeColors();
  const [buildingId, setBuildingId] = useState(defaultBuildingId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<NoticePriority>("normal");
  const [audience, setAudience] = useState<NoticeAudience>("all_tenants");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await createAndPublishNotice({
        buildingId: buildingId || defaultBuildingId,
        title,
        content,
        priority,
        audienceType: audience === "all_tenants" ? "all_tenants" : "owner_manager_only",
      });
      setTitle("");
      setContent("");
      setPriority("normal");
      setAudience("all_tenants");
      onSaved();
    } catch (submissionError) {
      Alert.alert("Could not post notice", submissionError instanceof Error ? submissionError.message : "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New notice</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={[styles.close, { color: colors.primary }]}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Building</Text>
            <View style={styles.chipRow}>
              {buildings.map((building) => (
                <TouchableOpacity
                  key={building.id}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    buildingId === building.id && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                  ]}
                  onPress={() => setBuildingId(building.id)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, buildingId === building.id && { color: colors.primary }]}>{building.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Water line maintenance"
              placeholderTextColor={colors.textSub}
              maxLength={160}
            />

            <Text style={[styles.label, { color: colors.text }]}>Content</Text>
            <TextInput
              style={[styles.input, styles.multiline, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={content}
              onChangeText={setContent}
              placeholder="Details for tenants"
              placeholderTextColor={colors.textSub}
              multiline
              numberOfLines={4}
            />

            <Text style={[styles.label, { color: colors.text }]}>Priority</Text>
            <View style={styles.chipRow}>
              {noticePriorityOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    priority === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                  ]}
                  onPress={() => setPriority(option)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, priority === option && { color: colors.primary }]}>{noticePriorityLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Audience</Text>
            <View style={styles.chipRow}>
              {(["all_tenants", "owner_manager_only"] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    audience === option && { backgroundColor: colors.primary + "20", borderColor: colors.primary },
                  ]}
                  onPress={() => setAudience(option)}
                >
                  <Text style={[styles.chipText, { color: colors.textSub }, audience === option && { color: colors.primary }]}>{noticeAudienceLabel[option]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Post notice</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingTop: Platform.OS === "android" ? 40 : 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 4 },
  scrollArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },

  list: { padding: 20, gap: 16, paddingBottom: 100 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "700" },
  cardDate: { fontSize: 12 },
  metaText: { fontSize: 12, marginBottom: 8, textTransform: "capitalize" },
  cardContent: { fontSize: 14, lineHeight: 20 },

  emptyBox: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyText: { textAlign: "center", fontSize: 14 },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  close: { fontSize: 14, fontWeight: "700" },

  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14 },
  multiline: { minHeight: 96, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, minHeight: 36, justifyContent: "center", borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },

  submitBtn: { marginTop: 24, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
