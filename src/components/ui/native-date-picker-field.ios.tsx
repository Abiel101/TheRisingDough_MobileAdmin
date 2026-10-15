import { useState } from "react";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeDatePickerFieldProps } from "@/components/ui/native-date-picker.types";
import { dateFromKey, dateToKey, formatDateKey } from "@/components/ui/native-date-picker.types";
import { colors, spacing } from "@/theme/tokens";

export function NativeDatePickerField({ label, value, onChange }: NativeDatePickerFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => dateFromKey(value));

  function openPicker() {
    setDraft(dateFromKey(value));
    setVisible(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={openPicker} style={styles.trigger}>
        <Text style={styles.value}>{formatDateKey(value)}</Text>
        <Text style={styles.icon}>▦</Text>
      </Pressable>
      <Modal animationType="slide" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Select a due date</Text>
            <Host matchContents={{ vertical: true }} style={styles.host}>
              <DatePicker
                displayedComponents={["date"]}
                onDateChange={setDraft}
                selection={draft}
                title="Due date"
              />
            </Host>
            <View style={styles.actions}>
              <Pressable onPress={() => setVisible(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable onPress={() => { onChange(dateToKey(draft)); setVisible(false); }} style={styles.doneButton}><Text style={styles.doneText}>Done</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  value: { color: colors.espresso, fontSize: 15 },
  icon: { color: colors.teal, fontSize: 19 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0007" },
  sheet: { alignItems: "stretch", gap: spacing.md, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.espresso, fontSize: 17, fontWeight: "700" },
  host: { width: "100%" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  cancelButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  cancelText: { color: colors.mutedText, fontSize: 14, fontWeight: "600" },
  doneButton: { minHeight: 44, justifyContent: "center", borderRadius: 12, backgroundColor: colors.teal, paddingHorizontal: spacing.lg },
  doneText: { color: colors.card, fontSize: 14, fontWeight: "700" },
});
