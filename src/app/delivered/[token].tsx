import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageCard } from "@/components/ui/screen-primitives";
import { Pressable } from "@/components/ui/pressable";
import { invoiceFromApprovalOrder, printOrSaveInvoice } from "@/lib/invoice";
import { deliveryPhotoUrl, getOrderForApproval, type ApprovalOrder } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

// Public customer page opened from the delivery confirmation link; it works without signing in.
export default function DeliveredOrderScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
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

  async function downloadInvoice() {
    if (!order) return;
    setError("");
    try {
      await printOrSaveInvoice(invoiceFromApprovalOrder(order));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the invoice.");
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
          <MessageCard title="Link unavailable" message={error || "This link is invalid or has expired."} tone="error" />
        </View>
      </SafeAreaView>
    );
  }

  const pickedUp = order.deliveryMethod === "pickup";
  const confirmed = Boolean(order.deliveredAt);
  const photo = deliveryPhotoUrl(order.deliveryPhotoPath);
  const when = confirmed
    ? new Date(order.deliveredAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>THE RISING DOUGH</Text>
        <View style={styles.card}>
          <View style={styles.accent} />
          <Text style={styles.title}>
            {!confirmed ? "Your order is on the way" : pickedUp ? "Your order has been picked up" : "Your order has been delivered"}
          </Text>
          <Text style={styles.meta}>Order {order.orderNumber}</Text>
          {confirmed ? <Text style={styles.meta}>{when}</Text> : order.deliveryTime ? <Text style={styles.meta}>Expected around {order.deliveryTime}</Text> : null}
          {photo ? <Image accessibilityLabel="Photo of your order" contentFit="cover" source={{ uri: photo }} style={styles.photo} /> : null}
          <Text style={styles.total}>Order total {money(order.total)}</Text>
        </View>
        {error ? <MessageCard title="Something went wrong" message={error} tone="error" /> : null}
        <Pressable accessibilityRole="button" onPress={() => void downloadInvoice()} style={styles.button}>
          <Text style={styles.buttonText}>Download or print invoice</Text>
        </Pressable>
        <Text style={styles.footer}>Thank you for choosing The Rising Dough.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, padding: spacing.md, width: "100%", maxWidth: 560, alignSelf: "center" },
  brand: { color: colors.teal, fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  card: { width: "100%", gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.card, padding: spacing.md },
  accent: { height: 4, borderRadius: 2, backgroundColor: colors.teal, marginBottom: spacing.sm },
  title: { color: colors.espresso, fontFamily: serifFamily, fontSize: 26, fontWeight: "800", textAlign: "center" },
  meta: { color: colors.mutedText, fontSize: 13, textAlign: "center" },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 12, marginTop: spacing.sm, backgroundColor: colors.parchment },
  total: { color: colors.espresso, fontSize: 15, fontWeight: "700", textAlign: "center", marginTop: spacing.sm },
  button: { width: "100%", minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.teal },
  buttonText: { color: colors.card, fontSize: 14, fontWeight: "800" },
  footer: { color: colors.mutedText, fontSize: 11, textAlign: "center" },
});
