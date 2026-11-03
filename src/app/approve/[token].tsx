import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormField, MessageCard } from "@/components/ui/screen-primitives";
import { approveOrder, getOrderForApproval, type ApprovalOrder } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function longDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Public customer page opened from the approval link; it works without signing in.
export default function ApproveOrderScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setOrder(token ? await getOrderForApproval(token) : null);
    } catch {
      setError("We couldn’t load this order. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function approve() {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await approveOrder(token, name.trim());
      if (updated) setOrder(updated);
    } catch {
      setError("We couldn’t record your approval. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <MessageCard
            title="Link unavailable"
            message={error || "This approval link is invalid or has expired."}
            tone="error"
          />
        </View>
      </SafeAreaView>
    );
  }

  const approved = order.approvalStatus === "approved";
  const cancelled = order.status === "Cancelled";
  const canApprove = order.approvalStatus === "pending" && !cancelled;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>THE RISING DOUGH</Text>
        <Text style={styles.title}>Review your order</Text>
        <Text style={styles.muted}>
          {order.orderNumber}
          {order.customerName ? ` · ${order.customerName}` : ""} · Due {longDate(order.dueDate)}
        </Text>

        <View style={styles.card}>
          {order.items.map((item) => (
            <View key={`${item.name}-${item.unitPrice}`} style={styles.row}>
              <Text style={styles.itemName}>
                {item.quantity}× {item.name}
              </Text>
              <Text style={styles.itemName}>{money(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.muted}>{money(order.subtotal)}</Text>
          </View>
          {order.discountAmount > 0 ? (
            <View style={styles.row}>
              <Text style={styles.muted}>Discount</Text>
              <Text style={styles.muted}>−{money(order.discountAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{money(order.total)}</Text>
          </View>
        </View>

        {error ? <MessageCard title="Something went wrong" message={error} tone="error" /> : null}

        {approved ? (
          <MessageCard
            title="Order approved"
            message={`Thank you! You approved ${money(order.approvedTotal ?? order.total)}. The bakery has been notified.`}
          />
        ) : cancelled ? (
          <MessageCard title="Order cancelled" message="This order was cancelled and can no longer be approved." tone="error" />
        ) : canApprove ? (
          <View style={styles.card}>
            <FormField
              autoCapitalize="words"
              editable={!submitting}
              label="Your name (optional)"
              onChangeText={setName}
              placeholder="Name"
              value={name}
            />
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void approve()}
              style={[styles.approveButton, submitting && styles.disabled]}
            >
              <Text style={styles.approveText}>
                {submitting ? "Approving…" : `Approve order · ${money(order.total)}`}
              </Text>
            </Pressable>
          </View>
        ) : (
          <MessageCard title="Not ready yet" message="This order isn’t ready for approval. Please contact the bakery." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  content: { gap: spacing.md, padding: spacing.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  brand: { color: colors.mutedText, fontSize: 11, fontWeight: "700", letterSpacing: 1.4 },
  title: { color: colors.espresso, fontFamily: serifFamily, fontSize: 32, fontWeight: "800" },
  muted: { color: colors.mutedText, fontSize: 14 },
  card: { gap: spacing.sm, borderRadius: 20, backgroundColor: colors.card, padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  itemName: { color: colors.espresso, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  total: { color: colors.espresso, fontFamily: serifFamily, fontSize: 20, fontWeight: "800" },
  approveButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.teal },
  approveText: { color: colors.card, fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.55 },
});
