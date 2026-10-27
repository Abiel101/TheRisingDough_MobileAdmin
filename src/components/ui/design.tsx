import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NativeIcon } from "@/components/ui/native-icon";
import { colors, serifFamily, spacing } from "@/theme/tokens";

export function SearchField({
  accessibilityLabel,
  ...inputProps
}: Omit<TextInputProps, "style"> & { accessibilityLabel: string }) {
  return (
    <View style={styles.search}>
      <View style={styles.searchIcon}>
        <NativeIcon color={colors.mutedText} name="search" size={16} />
      </View>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        placeholderTextColor={colors.mutedText}
        selectionColor={colors.teal}
        style={styles.searchInput}
        {...inputProps}
      />
    </View>
  );
}

export function AddFab({ label, onPress }: { label: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  // iOS native tab bar floats over content, so lift the button above it.
  const bottom = Platform.OS === "ios" ? insets.bottom + spacing.xl : spacing.lg;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.pressed]}
    >
      <Text style={styles.fabPlus}>＋</Text>
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

const avatarTones = [
  { background: "#E4EBDD", color: colors.teal },
  { background: "#F5E1D2", color: colors.orange },
] as const;

export function Avatar({ name, size = 44, index = 0 }: { name: string; size?: number; index?: number }) {
  const tone = avatarTones[index % avatarTones.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone.background }]}>
      <Text style={[styles.avatarText, { color: tone.color, fontSize: size * 0.42 }]}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

export function RoundButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.round}>
      <Text style={styles.roundText}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { width: 16, height: 16 },
  searchInput: { flex: 1, minHeight: 46, color: colors.espresso, fontSize: 15 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    shadowColor: colors.espresso,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  fabPlus: { color: colors.card, fontSize: 16, fontWeight: "700" },
  fabText: { color: colors.card, fontSize: 14, fontWeight: "700" },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: serifFamily, fontWeight: "800" },
  round: {
    minWidth: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 19,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
  },
  roundText: { color: colors.teal, fontSize: 16, fontWeight: "700" },
});
