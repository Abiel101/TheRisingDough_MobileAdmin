import { StyleSheet, Text, View } from "react-native";

import type { NativeDatePickerFieldProps } from "@/components/ui/native-date-picker.types";
import { formatDateKey } from "@/components/ui/native-date-picker.types";
import { colors, spacing } from "@/theme/tokens";

export function NativeDatePickerField({ label, value, onChange }: NativeDatePickerFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.value}>{formatDateKey(value)}</Text>
        <input aria-label={label} onChange={(event) => onChange(event.currentTarget.value)} type="date" value={value} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  row: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  value: { color: colors.espresso, fontSize: 15 },
});
