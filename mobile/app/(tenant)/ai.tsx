import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
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
 * Live AptBot chat, backed by the production AptBot API. The screen is
 * chat-only: it never submits repairs, payments, or any other action on the
 * tenant's behalf, and it never falls back to scripted answers when the
 * live API fails — a failed request is surfaced as a failure with a Retry
 * action, not disguised as a real reply.
 */
const AI_ENDPOINT = "https://apt-pilot-connect.lovable.app/api/public/aptbot";
const REQUEST_TIMEOUT_MS = 25000;
const MAX_HISTORY_MESSAGES = 10;
const WELCOME_ID = "welcome";

type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
  /** True when this (user) message failed to get a live reply and can be retried. */
  failed?: boolean;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function TenantAptBot() {
  const router = useRouter();
  const colors = useThemeColors();
  const { session, profile } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: WELCOME_ID,
      sender: "bot",
      text: `Hi ${profile?.full_name || "there"}! I'm AptBot, your AI assistant. I can help with questions about using AptPilot, your bills, repairs, notices, and general building-management guidance.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  function markFailed(userMsgId: string, errorText: string) {
    if (!mountedRef.current) return;
    setMessages((prev) => [
      ...prev.map((m) => (m.id === userMsgId ? { ...m, failed: true } : m)),
      { id: makeId(), sender: "bot", text: errorText },
    ]);
  }

  async function performSend(rawText: string, retryId?: string) {
    const text = rawText.trim();
    if (!text || sending) return;

    let userMsgId: string;
    if (retryId) {
      userMsgId = retryId;
      setMessages((prev) => prev.map((m) => (m.id === retryId ? { ...m, failed: false } : m)));
    } else {
      userMsgId = makeId();
      setMessages((prev) => [...prev, { id: userMsgId, sender: "user", text }]);
      setInput("");
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      markFailed(userMsgId, "You're not signed in. Please sign in again to use AptBot.");
      return;
    }

    setSending(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const history = messages
        .filter((m) => m.id !== WELCOME_ID && m.id !== userMsgId)
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ sender: m.sender, text: m.text }));

      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      if (response.status === 401) {
        markFailed(userMsgId, "Your session expired. Please sign in again.");
        return;
      }

      let data: { ok?: boolean; reply?: string; error?: string } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok && data && data.ok === true && typeof data.reply === "string") {
        if (mountedRef.current) {
          setMessages((prev) => [...prev, { id: makeId(), sender: "bot", text: data!.reply as string }]);
        }
        return;
      }

      const serverMessage =
        response.ok && data && data.ok === false && typeof data.error === "string" && data.error.trim()
          ? data.error.trim().slice(0, 300)
          : "AptBot couldn't respond right now. Please try again.";

      markFailed(userMsgId, serverMessage);
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      markFailed(
        userMsgId,
        isTimeout
          ? "That took too long to respond. Please check your connection and try again."
          : "Couldn't reach AptBot. Please check your connection and try again."
      );
    } finally {
      clearTimeout(timeoutId);
      if (mountedRef.current) setSending(false);
    }
  }

  function handleSend(promptText?: string) {
    void performSend(promptText ?? input);
  }

  function handleRetry(id: string) {
    const target = messages.find((m) => m.id === id);
    if (!target) return;
    void performSend(target.text, id);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
  style={styles.keyboardView}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={0}
>
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
              <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>AI assistant · review responses</Text>
            </View>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.map((m) => (
            <View key={m.id} style={[styles.messageWrapper, m.sender === "user" ? styles.messageRight : styles.messageLeft]}>
              <View style={styles.messageColumn}>
                <View
                  style={[
                    styles.messageBubble,
                    m.sender === "user"
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 4, opacity: m.failed ? 0.6 : 1 }
                      : { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <Text style={[styles.messageText, { color: m.sender === "user" ? "#ffffff" : colors.text }]}>{m.text}</Text>
                </View>
                {m.failed && (
                  <TouchableOpacity style={styles.retryRow} onPress={() => handleRetry(m.id)} disabled={sending}>
                    <Text style={[styles.retryText, { color: colors.primary }]}>Failed to send · Tap to retry</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {sending && (
            <View style={[styles.messageWrapper, styles.messageLeft]}>
              <View style={styles.messageColumn}>
                <View
                  style={[
                    styles.messageBubble,
                    styles.thinkingBubble,
                    { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.textSub} />
                  <Text style={[styles.messageText, { color: colors.textSub, marginLeft: 8 }]}>AptBot is thinking…</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[styles.quickPrompts, { backgroundColor: colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptsContent}>
            {["When is rent due?", "How to submit repair?", "Guest parking rules"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.promptBtn, { backgroundColor: colors.card, borderColor: colors.border }, sending && styles.disabled]}
                onPress={() => handleSend(p)}
                disabled={sending}
              >
                <Text style={[styles.promptText, { color: colors.primary }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.inputArea}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Message AptBot..."
              placeholderTextColor={colors.textSub}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => handleSend()}
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }, (sending || !input.trim()) && styles.disabled]}
              onPress={() => handleSend()}
              disabled={sending || !input.trim()}
            >
              {sending ? <ActivityIndicator color="#ffffff" size="small" /> : <Send color="#ffffff" size={20} />}
            </TouchableOpacity>
          </View>
          <Text style={[styles.disclaimer, { color: colors.textSub }]}>
            AI responses may be inaccurate. Verify important information.
          </Text>
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
  messageColumn: { maxWidth: "80%" },
  messageBubble: { padding: 12, borderRadius: 20 },
  messageText: { fontSize: 15, lineHeight: 22 },
  thinkingBubble: { flexDirection: "row", alignItems: "center" },
  retryRow: { marginTop: 4, alignSelf: "flex-end" },
  retryText: { fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },

  quickPrompts: { paddingVertical: 12 },
  promptsContent: { paddingHorizontal: 16, gap: 8 },
  promptBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  promptText: { fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.5 },

  inputContainer: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 8 : 12 },
  inputArea: { flexDirection: "row", gap: 12, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  disclaimer: { fontSize: 11, textAlign: "center", marginTop: 8 },
});
