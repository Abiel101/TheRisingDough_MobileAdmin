import { useState } from "react";
import { DatePickerDialog, Host } from "@expo/ui/jetpack-compose";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeDatePickerFieldProps } from "@/components/ui/native-date-picker.types";
import { formatDateKey } from "@/components/ui/native-date-picker.types";
import { colors, spacing } from "@/theme/tokens";

export function NativeDatePickerField({ label, value, onChange }: NativeDatePickerFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.trigger}>
        <Text style={styles.value}>{formatDateKey(value)}</Text>
        <Text style={styles.icon}>▦</Text>
      </Pressable>
      {visible ? (
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <DatePickerDialog
            color={colors.teal}
            confirmButtonLabel="Done"
            dismissButtonLabel="Cancel"
            initialDate={new Date(`${value}T00:00:00Z`).toISOString()}
            onDateSelected={(date) => {
              onChange(formatDateKeyFromDate(date));
              setVisible(false);
            }}
            onDismissRequest={() => setVisible(false)}
          />
        </Host>
      ) : null}
    </View>
  );
}

// The Material date picker reports the chosen day as UTC midnight, so read UTC parts.
function formatDateKeyFromDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  value: { color: colors.espresso, fontSize: 15 },
  icon: { color: colors.teal, fontSize: 19 },
  host: { width: "100%" },
});
