import { useState } from "react";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowLeft, Send, Sparkles } from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Ported from the Sanjida reference's app/(tenant)/ai.tsx. There is no live
 * AI/LLM backend in this project (no edge function, no model endpoint) —
 * the reference's scripted, keyword-matched replies are kept as-is, but
 * relabeled from "Always online" to an explicit "Demo assistant" so the
 * screen never implies it is a real, connected AI service (per
 * AptPilot-architecture-comparison.md §9/§10).
 */
export default function TenantAptBot() {
  const router = useRouter();
  const colors = useThemeColors();
  const { profile } = useAuth();

  const [messages, setMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([
    {
      sender: "bot",
      text: `Hi ${profile?.full_name || "there"}! I'm AptBot, a demo assistant with a handful of scripted answers about rent, repairs and building policies — I'm not a live AI service.`,
    },
  ]);
  const [input, setInput] = useState("");

  function handleSend(textToSend?: string) {
    const query = textToSend || input;
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    if (!textToSend) setInput("");

    setTimeout(() => {
      let botResponse = "That's outside my scripted answers for this demo — please contact your building manager for that.";
      const q = query.toLowerCase();
      if (q.includes("rent") || q.includes("bill") || q.includes("due")) {
        botResponse = "Check the Bills tab for your exact due date and amount — it's pulled live from your rent record.";
      } else if (q.includes("repair") || q.includes("leak") || q.includes("plumber")) {
        botResponse = "To request a repair, use the Repairs tab. For anything urgent, use Emergency instead.";
      } else if (q.includes("water") || q.includes("cleaning")) {
        botResponse = "Utility and cleaning schedules are usually shared via building Notices — check that tab for the latest.";
      } else if (q.includes("park") || q.includes("car") || q.includes("visitor")) {
        botResponse = "Guest parking rules vary by building — check Notices or ask your manager.";
      }
      setMessages((prev) => [...prev, { sender: "bot", text: botResponse }]);
    }, 500);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <View style={[styles.aiIcon, { backgroundColor: colors.primary }]}>
              <Sparkles color="#ffffff" size={16} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>AptBot</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Demo assistant · not live AI</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.chatArea} contentContainerStyle={styles.chatContent}>
          {messages.map((m, i) => (
            <View key={i} style={[styles.messageWrapper, m.sender === "user" ? styles.messageRight : styles.messageLeft]}>
              <View
                style={[
                  styles.messageBubble,
                  m.sender === "user"
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
                ]}
              >
                <Text style={[styles.messageText, { color: m.sender === "user" ? "#ffffff" : colors.text }]}>{m.text}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.quickPrompts, { backgroundColor: colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptsContent}>
            {["When is rent due?", "How to submit repair?", "Guest parking rules"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.promptBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleSend(p)}
              >
                <Text style={[styles.promptText, { color: colors.primary }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Message AptBot..."
            placeholderTextColor={colors.textSub}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={() => handleSend()}>
            <Send color="#ffffff" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1,
    paddingTop: Platform.OS === "android" ? 40 : 16,
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  aiIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubtitle: { fontSize: 12, fontWeight: "600" },

  chatArea: { flex: 1, padding: 16 },
  chatContent: { gap: 12, paddingBottom: 16 },
  messageWrapper: { flexDirection: "row", width: "100%" },
  messageLeft: { justifyContent: "flex-start" },
  messageRight: { justifyContent: "flex-end" },
  messageBubble: { maxWidth: "80%", padding: 12, borderRadius: 20 },
  messageText: { fontSize: 15, lineHeight: 22 },

  quickPrompts: { paddingVertical: 12 },
  promptsContent: { paddingHorizontal: 16, gap: 8 },
  promptBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  promptText: { fontSize: 13, fontWeight: "600" },

  inputArea: { flexDirection: "row", padding: 16, borderTopWidth: 1, gap: 12, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
});
