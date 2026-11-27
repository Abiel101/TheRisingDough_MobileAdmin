import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Platform, Share, StyleSheet, Text, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { orderStatusLabels } from "@/domain/orders";
import { approvalLinkFor } from "@/lib/customer-links";
import type { OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

type MessageKind = "status" | "approval" | "reminder" | "confirmation";

export function CustomerUpdateCard({ order }: { order: OrderRecord }) {
  const [selected, setSelected] = useState<MessageKind>("status");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const link = approvalLinkFor(order.approvalToken);
  const cancelled = order.status === "Cancelled";
  const confirmed = Boolean(order.deliveredAt) && !cancelled;
  const options: { value: MessageKind; label: string }[] = [
    { value: "status", label: "Order status" },
    ...(order.approvalAvailable && order.approvalStatus === "pending" && !cancelled
      ? [{ value: "approval" as const, label: "Approval" }]
      : []),
    ...(!cancelled && !confirmed ? [{ value: "reminder" as const, label: "Delivery reminder" }] : []),
    ...(confirmed ? [{ value: "confirmation" as const, label: "Confirmation" }] : []),
  ];
  const kind = options.some((option) => option.value === selected) ? selected : "status";
  const firstName = order.customer.trim().split(/\s+/)[0] || "there";
  const intro = `Hi ${firstName}!`;
  const update = kind === "approval"
    ? `Please review and approve your order ${order.number}.`
    : kind === "reminder"
      ? `Your order ${order.number} is scheduled for delivery${order.deliveryTime ? ` around ${order.deliveryTime}` : ""}.`
      : kind === "confirmation"
        ? `Your order ${order.number} has been ${order.deliveryMethod === "pickup" ? "picked up" : "delivered"}.`
        : `Your order ${order.number} is ${orderStatusLabels[order.status].toLowerCase()}.`;
  const message = `${intro} ${update} View your order: ${link}`;

  async function copy(text: string, label: string) {
    setNotice("");
    setError("");
    try {
      if (Platform.OS === "web") {
        if (!navigator.clipboard) throw new Error("Clipboard access is unavailable in this browser.");
        await navigator.clipboard.writeText(text);
      } else if (!(await Clipboard.setStringAsync(text, { android: { isSensitive: true } }))) {
        throw new Error("Clipboard access was denied.");
      }
      setNotice(`${label} copied.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not copy the ${label.toLowerCase()}.`);
    }
  }

  async function share() {
    setNotice("");
    setError("");
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({ text: message });
        else await copy(message, "Message");
      } else {
        await Share.share({ message });
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Could not open sharing.");
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Share an order update</Text>
      <Text style={styles.hint}>Choose a message, then send it yourself. The link always shows the latest order information.</Text>
      {link ? (
        <>
          <View style={styles.choices}>
            {options.map((option) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: kind === option.value }}
                key={option.value}
                onPress={() => {
                  setSelected(option.value);
                  setNotice("");
                  setError("");
                }}
                style={[styles.chip, kind === option.value && styles.chipSelected]}
              >
                <Text style={[styles.chipText, kind === option.value && styles.chipTextSelected]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text selectable style={styles.preview}>{message}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => void copy(link, "Link")} style={[styles.outline, styles.flex]}>
              <Text style={styles.outlineText}>Copy link</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void copy(message, "Message")} style={[styles.outline, styles.flex]}>
              <Text style={styles.outlineText}>Copy message</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.solid}>
            <Text style={styles.solidText}>Share message</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.hint}>
          {order.approvalToken
            ? "Set EXPO_PUBLIC_APPROVAL_BASE_URL to create the customer link."
            : "This order does not have a customer link available."}
        </Text>
      )}
      {notice ? <Text style={styles.hint}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, borderRadius: 16, backgroundColor: colors.card, padding: spacing.md },
  title: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  error: { color: colors.brick, fontSize: 12, lineHeight: 18 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { minHeight: 40, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md },
  chipSelected: { borderColor: colors.teal, backgroundColor: colors.teal },
  chipText: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  chipTextSelected: { color: colors.card },
  preview: { color: colors.espresso, fontSize: 13, lineHeight: 20, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  outline: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: spacing.sm },
  outlineText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  solid: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.teal },
  solidText: { color: colors.card, fontSize: 14, fontWeight: "700" },
});
