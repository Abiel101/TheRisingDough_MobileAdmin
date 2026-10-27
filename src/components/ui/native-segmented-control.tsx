import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeSegmentedControlProps } from "@/components/ui/native-segmented-control.types";
import { colors } from "@/theme/tokens";

export function NativeSegmentedControl<T extends string>({ options, value, onChange }: NativeSegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === value }}
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.button, option.value === value && styles.active]}
        >
          <Text style={[styles.label, option.value === value && styles.activeLabel]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", padding: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  button: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  active: { backgroundColor: colors.teal },
  label: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },
  activeLabel: { color: colors.card },
});
