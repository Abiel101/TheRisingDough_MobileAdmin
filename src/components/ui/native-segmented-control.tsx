import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import type { NativeSegmentedControlProps } from "@/components/ui/native-segmented-control.types";
import { colors } from "@/theme/tokens";

export function NativeSegmentedControl<T extends string>({ options, value, onChange }: NativeSegmentedControlProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: option.value === value }}
          haptic="selection"
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
  row: { flexDirection: "row", padding: 3, gap: 3, borderRadius: 14, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.card },
  button: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 3 },
  active: { backgroundColor: colors.teal },
  label: { color: colors.espresso, fontSize: 12, fontWeight: "700", textAlign: "center" },
  activeLabel: { color: colors.card },
});
