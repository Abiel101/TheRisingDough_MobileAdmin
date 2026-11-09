import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { NativeButton } from "@/components/ui/native-button";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { markRequestRead } from "@/lib/approval-inbox";
import { listHolidayRequestActivity, type HolidayRequestActivity } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<HolidayRequestActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const requests = await listHolidayRequestActivity();
      const next = requests.find((item) => item.id === id) ?? null;
      setRequest(next);
      setError("");
      if (next) await markRequestRead(next.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this request.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void Promise.resolve().then(load); }, [load]));

  function startOrder() {
    if (!request) return;
    router.push({
      pathname: "/order/new",
      params: {
        requestId: request.id,
        customerName: request.customer,
        customerPhone: request.phone,
        customerEmail: request.email,
        dueDate: request.dueDate,
        requestNotes: request.notes,
        requestItems: JSON.stringify(request.requestedItems),
      },
    });
  }

  return (
    <AppScreen header={<SheetHeader showSettings={false} title="Website request" subtitle="Review what the customer sent before creating an order." />}>
      {error ? <MessageCard title="Request unavailable" message={error} tone="error" /> : null}
      {!error && !loading && !request ? <MessageCard title="Request not found" message="This request may have been removed from the workspace." /> : null}
      {request ? <>
        <ContentCard style={styles.card}>
          <Text style={styles.reference}>THANKSGIVING REQUEST · {request.number}</Text>
          <Text style={styles.name}>{request.customer || "Customer"}</Text>
          <Text style={styles.fieldLabel}>Phone</Text>
          <Text selectable style={styles.contact}>{request.phone || "Not provided"}</Text>
          {request.email ? <>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text selectable style={styles.contact}>{request.email}</Text>
          </> : null}
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>Requested pickup</Text>
          <Text style={styles.body}>{formatDate(request.dueDate)}</Text>
          <Text style={styles.meta}>Received {new Date(request.createdAt).toLocaleString()}</Text>
        </ContentCard>

        <ContentCard style={styles.card}>
          <Text style={styles.sectionTitle}>Requested items</Text>
          {request.requestedItems.length ? request.requestedItems.map((item, index) => (
            <View key={`${item.productName}-${index}`} style={styles.itemRow}>
              <Text style={styles.itemQuantity}>{item.quantity}×</Text>
              <Text style={styles.itemName}>{item.productName}</Text>
            </View>
          )) : <Text style={styles.meta}>This request was submitted before the website item picker was added.</Text>}
          <View style={styles.divider} />
          <Text style={styles.fieldLabel}>{request.requestedItems.length ? "Additional notes" : "Original request notes"}</Text>
          <Text selectable style={styles.notes}>{request.notes || "No additional notes were included."}</Text>
        </ContentCard>

        {request.status === "converted" && request.convertedOrderId ? (
          <ContentCard style={styles.card}>
            <Text style={styles.sectionTitle}>Order started</Text>
            <Text style={styles.body}>This request has been used to create an order. You can review it and share its approval link.</Text>
            <NativeButton label="Open order" onPress={() => router.push({ pathname: "/order/[id]", params: { id: request.convertedOrderId! } })} />
          </ContentCard>
        ) : (
          <ContentCard style={styles.card}>
            <Text style={styles.sectionTitle}>Create their order</Text>
            <Text style={styles.body}>Customer details, pickup date, and these notes will carry into a new order. Add the requested catalog items, then open the order to send its approval link.</Text>
            <NativeButton label="Start new order" onPress={startOrder} />
          </ContentCard>
        )}
      </> : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  reference: { color: colors.mutedText, fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  name: { color: colors.espresso, fontSize: 22, fontWeight: "700" },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  fieldLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { color: colors.espresso, fontSize: 14, lineHeight: 21 },
  contact: { color: colors.espresso, fontSize: 15, lineHeight: 21, fontWeight: "600" },
  meta: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  notes: { color: colors.espresso, fontSize: 14, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  itemQuantity: { minWidth: 34, color: colors.teal, fontSize: 14, fontWeight: "800" },
  itemName: { flex: 1, color: colors.espresso, fontSize: 14, fontWeight: "600" },
});
