import { StyleSheet, Text, View } from "react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Presentation-only helper for `buildings.assigned_manager` — the single
 * free-text "Manager name or email" field the web app's building form
 * writes (see mobile/lib/owner/buildings.ts; there is no separate
 * manager-name / manager-email column to read from). Splits that one
 * string into a name line and an email line for display when it looks
 * like it contains an email address, so a manager entered as (or
 * including) an email is never crammed, unreadable, into a single
 * truncated line. Nothing is invented or written back — this only changes
 * how the existing stored value is rendered.
 */
const EMAIL_PATTERN = /[^\s<>()]+@[^\s<>()]+\.[^\s<>()]+/;

export function parseManagerLabel(value: string): { name: string | null; email: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { name: null, email: null };

  const match = trimmed.match(EMAIL_PATTERN);
  if (!match) return { name: trimmed, email: null };

  const email = match[0];
  const name = trimmed
    .replace(email, "")
    .replace(/[-–—|(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { name: name || null, email };
}

export function ManagerLabel({ value, unassignedText = "Unassigned" }: { value: string; unassignedText?: string }) {
  const colors = useThemeColors();
  const { name, email } = parseManagerLabel(value);

  if (!name && !email) {
    return (
      <Text style={[styles.name, { color: colors.textSub }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {unassignedText}
      </Text>
    );
  }

  return (
    <View>
      <Text style={[styles.name, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={2}>
        {name ?? "Assigned manager"}
      </Text>
      {email ? (
        <Text style={[styles.email, { color: colors.text }]} maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {email}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 14, fontWeight: "700" },
  // Smaller than the name, but full-contrast (colors.text, not the faded
  // colors.textSub other secondary lines use) — the email is the thing
  // that was reported unreadable, so it keeps strong contrast and is
  // allowed to wrap to a second line instead of being truncated.
  email: { fontSize: 12, fontWeight: "500", marginTop: 2, lineHeight: 16 },
});
