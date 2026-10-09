import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeText } from "@/components/ui/native-text";
import { colors, spacing } from "@/theme/tokens";

export function AppScreen({ children, ...scrollProps }: ScrollViewProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          <NativeText textStyle={styles.eyebrow}>THE RISING DOUGH</NativeText>
          <NativeText textStyle={styles.title}>{title}</NativeText>
          <NativeText textStyle={styles.subtitle}>{subtitle}</NativeText>
        </View>
        <SettingsButton />
      </View>
    </View>
  );
}

export function SettingsButton() {
  return (
    <Pressable
      accessibilityLabel="Open settings"
      accessibilityRole="button"
      onPress={() => router.push("/settings")}
      style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsPressed]}
    >
      <Text style={styles.settingsButtonText}>Settings</Text>
    </Pressable>
  );
}

export function SheetHeader({
  title,
  subtitle,
  showSettings = true,
}: {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
}) {
  return (
    <View style={styles.sheetHeader}>
      <View style={styles.sheetHeading}>
        {subtitle ? <Text style={styles.eyebrowText}>THE RISING DOUGH</Text> : null}
        <Text style={styles.sheetTitle}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sheetActions}>
        {showSettings ? <SettingsButton /> : null}
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Text style={styles.settingsButtonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ContentCard({ children, style, ...props }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...props}>
      {children}
    </View>
  );
}

export function FormField({
  label,
  ...inputProps
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <NativeText textStyle={styles.fieldLabel}>{label}</NativeText>
      <TextInput
        placeholderTextColor={colors.mutedText}
        selectionColor={colors.teal}
        style={styles.input}
        {...inputProps}
      />
    </View>
  );
}

export function LoadingState({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.teal} />
      <NativeText textStyle={styles.stateText}>{label}</NativeText>
    </View>
  );
}

export function MessageCard({
  title,
  message,
  tone = "default",
}: {
  title: string;
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <ContentCard style={tone === "error" ? styles.errorCard : undefined}>
      <NativeText textStyle={tone === "error" ? styles.errorTitle : styles.cardTitle}>
        {title}
      </NativeText>
      <NativeText textStyle={styles.cardBody}>{message}</NativeText>
    </ContentCard>
  );
}

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  settingsButton: {
    flexShrink: 0,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingsPressed: {
    opacity: 0.72,
  },
  settingsButtonText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sheetHeading: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: colors.parchment,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sheetTitle: {
    color: colors.espresso,
    fontSize: 22,
    fontWeight: "700",
  },
  eyebrowText: {
    color: colors.sage,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  subtitleText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
  eyebrow: {
    color: colors.sage,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.7,
  },
  title: {
    color: colors.espresso,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 37,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.espresso,
    fontSize: 16,
    fontWeight: "700",
  },
  cardBody: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.parchment,
    color: colors.espresso,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  state: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  stateText: {
    color: colors.mutedText,
    fontSize: 14,
    textAlign: "center",
  },
  error: {
    color: colors.brick,
    fontSize: 13,
    lineHeight: 19,
  },
  errorCard: {
    borderColor: colors.brick,
  },
  errorTitle: {
    color: colors.brick,
    fontSize: 16,
    fontWeight: "700",
  },
});
