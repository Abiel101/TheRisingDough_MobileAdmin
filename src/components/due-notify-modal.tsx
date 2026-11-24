import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Modal, Platform, ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { approvalLinkFor } from "@/lib/customer-links";
import { markOrderNotified, setOrderDeliveryTime, type OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

// 7:00 AM to 10:00 PM in 30 minute steps.
const TIME_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes % 60 === 0 ? "00" : "30"} ${hour24 < 12 ? "AM" : "PM"}`;
});

// Current time rounded to the nearest 30 minutes, kept inside the selectable range.
function nearestTimeOption() {
  const now = new Date();
  const rounded = Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  const index = Math.min(Math.max((rounded - 7 * 60) / 30, 0), TIME_OPTIONS.length - 1);
  return TIME_OPTIONS[index];
}

export function dueLabel(dueDate: string) {
  const [year, month, day] = dueDate.split("-").map(Number);
  const now = new Date();
  const days = Math.round((new Date(year, month - 1, day).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  return days <= 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

export function DueNotifyModal({
  order,
  onClose,
  onNotified,
}: {
  order: OrderRecord;
  onClose: () => void;
  onNotified: (id: string) => void;
}) {
  const [time, setTime] = useState(order.deliveryTime || nearestTimeOption());
  const [savedTime, setSavedTime] = useState(order.deliveryTime.trim());
  const [sent, setSent] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const link = approvalLinkFor(order.approvalToken);
  const firstName = order.customer.split(" ")[0] || "there";
  const when = dueLabel(order.dueDate) === "Due today" ? "today" : `on ${new Date(`${order.dueDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`;
  const text = `Hi ${firstName}, your order ${order.number} will be delivered ${when}${time.trim() ? ` around ${time.trim()}` : ""}.${link ? ` View your order: ${link}` : ""}`;

  // The customer link reads the delivery time from the order, so save it before sending.
  async function saveTime() {
    if (time.trim() === savedTime) return true;
    try {
      await setOrderDeliveryTime(order.id, time);
      setSavedTime(time.trim());
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save the delivery time.");
      return false;
    }
  }

  async function share() {
    setMessage("");
    if (!(await saveTime())) return;
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({ text });
        else await navigator.clipboard.writeText(text);
        setSent(true);
      } else {
        const result = await Share.share({ message: text });
        if (result.action === Share.sharedAction) setSent(true);
      }
    } catch {
      // Dismissing the share sheet is not an error.
    }
  }

  async function copy() {
    if (!(await saveTime())) return;
    try {
      await Clipboard.setStringAsync(text);
      setSent(true);
      setMessage("Message copied.");
    } catch {
      setMessage("Could not copy the message.");
    }
  }

  async function markNotified() {
    setBusy(true);
    try {
      await markOrderNotified(order.id, time);
      onNotified(order.id);
      onClose();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not save.");
      setBusy(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Order {order.number}</Text>
              <Text style={styles.subtitle}>{order.customer} · {dueLabel(order.dueDate)}</Text>
            </View>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>DELIVERY TIME</Text>
          <Pressable accessibilityRole="button" onPress={() => setPickerOpen((open) => !open)} style={[styles.input, styles.select]}>
            <Text style={time ? styles.selectValue : styles.placeholder}>{time || "Select a time"}</Text>
            <Text style={styles.chevron}>{pickerOpen ? "▲" : "▼"}</Text>
          </Pressable>
          {pickerOpen ? (
            <ScrollView nestedScrollEnabled style={styles.options}>
              {TIME_OPTIONS.map((option) => (
                <Pressable
                  accessibilityRole="button"
                  key={option}
                  onPress={() => {
                    setTime(option);
                    setPickerOpen(false);
                  }}
                  style={[styles.option, option === time && styles.optionActive]}
                >
                  <Text style={[styles.optionText, option === time && styles.optionTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => void share()} style={[styles.button, styles.primary]}>
              <Text style={styles.primaryText}>Share</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void copy()} style={[styles.button, styles.secondary]}>
              <Text style={styles.secondaryText}>Copy</Text>
            </Pressable>
          </View>
          {message ? <Text style={styles.hint}>{message}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !sent || busy }}
            disabled={!sent || busy}
            onPress={() => void markNotified()}
            style={[styles.button, styles.mark, (!sent || busy) && styles.dimmed]}
          >
            <Text style={styles.primaryText}>{busy ? "Saving…" : "Mark as notified"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: spacing.lg },
  card: { width: "100%", maxWidth: 420, gap: spacing.sm, borderRadius: 20, backgroundColor: colors.card, padding: spacing.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerCopy: { flex: 1, gap: 2 },
  title: { color: colors.espresso, fontSize: 20, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13 },
  close: { padding: 4 },
  closeText: { color: colors.mutedText, fontSize: 16 },
  label: { color: colors.mutedText, fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment, color: colors.espresso, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: 11 },
  actions: { flexDirection: "row", gap: spacing.sm },
  select: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectValue: { color: colors.espresso, fontSize: 15 },
  placeholder: { color: colors.mutedText, fontSize: 15 },
  chevron: { color: colors.mutedText, fontSize: 11 },
  options: { maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment },
  option: { paddingHorizontal: spacing.md, paddingVertical: 11 },
  optionActive: { backgroundColor: colors.teal },
  optionText: { color: colors.espresso, fontSize: 15 },
  optionTextActive: { color: colors.card, fontWeight: "700" },
  button: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  primary: { backgroundColor: colors.teal },
  primaryText: { color: colors.card, fontSize: 14, fontWeight: "700" },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.parchment },
  secondaryText: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  mark: { flex: 0, backgroundColor: colors.espresso, marginTop: spacing.xs },
  dimmed: { opacity: 0.35 },
  hint: { color: colors.mutedText, fontSize: 12 },
});
