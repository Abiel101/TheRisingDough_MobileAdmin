import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeConfirmButtonProps } from "@/components/ui/native-confirm-button.types";
import { colors, spacing } from "@/theme/tokens";

export function NativeConfirmButton({
  label,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "delete",
  onConfirm,
}: NativeConfirmButtonProps) {
  const [visible, setVisible] = useState(false);
  const actionColor = tone === "cancel" ? colors.orange : colors.brick;
  return (
    <>
      <Pressable onPress={() => setVisible(true)} style={[styles.trigger, { backgroundColor: actionColor }]}>
        <Text style={styles.triggerText}>{label}</Text>
      </Pressable>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => setVisible(false)}><Text style={styles.cancel}>{cancelLabel}</Text></Pressable>
              <Pressable onPress={() => { setVisible(false); void onConfirm(); }}><Text style={styles.confirm}>{confirmLabel}</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: spacing.md },
  triggerText: { color: colors.card, fontSize: 13, fontWeight: "700" },
  backdrop: { flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: "#0008" },
  dialog: { borderRadius: 18, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.espresso, fontSize: 18, fontWeight: "700" },
  message: { color: colors.mutedText, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.xs },
  cancel: { color: colors.teal, fontSize: 14, fontWeight: "600" },
  confirm: { color: colors.brick, fontSize: 14, fontWeight: "700" },
});
