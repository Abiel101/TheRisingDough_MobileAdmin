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
  row: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 16, borderWidth: 1.5, borderColor: colors.teal, backgroundColor: colors.card },
  button: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 4 },
  active: { backgroundColor: colors.teal },
  label: { color: colors.espresso, fontSize: 13, fontWeight: "700", textAlign: "center" },
  activeLabel: { color: colors.card },
});
