import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { orderStatuses, type OrderStatus } from "@/domain/orders";
import { formatDate } from "@/components/order-card";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getOrder, updateOrder, type OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

const statusLabels: Record<OrderStatus, string> = {
  Pending: "New",
  "In progress": "In progress",
  Ready: "Ready",
  Fulfilled: "Done",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function todayKey() {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function OrderDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("This order link is missing its order ID.");
      setLoading(false);
      return;
    }
    try {
      const result = await getOrder(id);
      setOrder(result);
      setError(result ? "" : "This order could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function save(changes: { status?: OrderStatus; paid?: boolean }) {
    if (!order) return;
    setSaving(true);
    setError("");
    try {
      await updateOrder(order.id, changes);
      setOrder((current) => {
        if (!current) return current;
        const nextStatus = changes.status ?? current.status;
        return {
          ...current,
          ...changes,
          status: nextStatus,
          paid: changes.paid ?? current.paid,
          fulfilledDate:
            changes.status === "Fulfilled"
              ? todayKey()
              : changes.status
                ? ""
                : current.fulfilledDate,
        };
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this order.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.teal} />
          <Text style={styles.muted}>Loading order…</Text>
        </View>
      </AppScreen>
    );
  }

  if (!order) {
    return (
      <AppScreen>
        <SheetHeader title="Order details" />
        <MessageCard title="Order unavailable" message={error || "This order could not be found."} tone="error" />
      </AppScreen>
    );
  }

  const progressIndex = orderStatuses.indexOf(order.status);
  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AppScreen>
      <SheetHeader title={`Order ${order.number}`} subtitle="Order details and progress." />

      {error ? <MessageCard title="Update failed" message={error} tone="error" /> : null}

      <ContentCard style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View>
            <Text style={styles.customerName}>{order.customer}</Text>
            <Text style={styles.muted}>{itemCount} item{itemCount === 1 ? "" : "s"}</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.progressRow}>
          {orderStatuses.map((status, index) => {
            const complete = index <= progressIndex;
            return (
              <View key={status} style={styles.progressStep}>
                <View style={[styles.progressDot, complete && styles.progressDotComplete]}>
                  <Text style={[styles.progressCheck, complete && styles.progressCheckComplete]}>
                    {index < progressIndex ? "✓" : String(index + 1)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={[styles.progressLabel, complete && styles.progressLabelComplete]}>
                  {statusLabels[status]}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.dateRow}>
          <InfoBlock label="Due date" value={formatDate(order.dueDate)} />
          {order.fulfilledDate ? <InfoBlock label="Completed" value={formatDate(order.fulfilledDate)} /> : null}
        </View>
      </ContentCard>

      <ContentCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Update status</Text>
        <View style={styles.statusGrid}>
          {orderStatuses.map((status) => {
            const active = order.status === status;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: saving }}
                disabled={saving || active}
                key={status}
                onPress={() => void save({ status })}
                style={[styles.statusOption, active && styles.statusOptionActive, saving && styles.disabled]}
              >
                <Text style={[styles.statusText, active && styles.statusTextActive]}>{status}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.paymentRow}>
          <View style={styles.paymentCopy}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <Text style={order.paymentTrackingAvailable ? (order.paid ? styles.paidText : styles.unpaidText) : styles.muted}>
              {order.paymentTrackingAvailable ? (order.paid ? "Paid" : "Unpaid") : "Not set up yet"}
            </Text>
          </View>
          {order.paymentTrackingAvailable ? (
            <Switch
              accessibilityLabel={order.paid ? "Mark order unpaid" : "Mark order paid"}
              disabled={saving}
              onValueChange={(paid) => void save({ paid })}
              thumbColor={colors.card}
              trackColor={{ false: colors.border, true: colors.sage }}
              value={order.paid}
            />
          ) : null}
        </View>
        <Text style={styles.paymentNote}>
          {order.paymentTrackingAvailable
            ? "This records payment status for the order. It does not charge a payment method."
            : "Apply the order payment migration to enable payment tracking. Status and completion controls are available now."}
        </Text>
      </ContentCard>

      <ContentCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <InfoRow label="Name" value={order.customer} />
        <InfoRow label="Phone" value={order.customerPhone || "Not provided"} />
        <InfoRow label="Email" value={order.customerEmail || "Not provided"} />
        <InfoRow label="Address" value={order.customerAddress || "Not provided"} />
      </ContentCard>

      <ContentCard style={styles.sectionCard}>
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Items</Text>
          <Text style={styles.muted}>{itemCount} total</Text>
        </View>
        {order.items.length ? order.items.map((item, index) => (
          <View key={`${item.productId}-${item.name}-${index}`} style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.muted}>{item.quantity} × {formatCurrency(item.price)}</Text>
            </View>
            <Text style={styles.itemTotal}>{formatCurrency(item.quantity * item.price)}</Text>
          </View>
        )) : <Text style={styles.muted}>No item details were saved with this order.</Text>}
        <View style={styles.grandTotalRow}>
          <Text style={styles.sectionTitle}>Order total</Text>
          <Text style={styles.total}>{formatCurrency(total)}</Text>
        </View>
      </ContentCard>

      {order.notes ? (
        <ContentCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order notes</Text>
          <Text style={styles.note}>{order.notes}</Text>
        </ContentCard>
      ) : null}
    </AppScreen>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: colors.sage,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  title: {
    color: colors.espresso,
    fontSize: 24,
    fontWeight: "700",
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: colors.parchment,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  customerName: {
    color: colors.espresso,
    fontSize: 16,
    fontWeight: "700",
  },
  total: {
    color: colors.espresso,
    fontSize: 17,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressStep: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  progressDot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.parchment,
  },
  progressDotComplete: {
    backgroundColor: colors.teal,
  },
  progressCheck: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
  },
  progressCheckComplete: {
    color: colors.card,
  },
  progressLabel: {
    color: colors.mutedText,
    fontSize: 9,
  },
  progressLabelComplete: {
    color: colors.teal,
    fontWeight: "700",
  },
  dateRow: {
    flexDirection: "row",
    gap: spacing.xl,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  infoBlock: {
    gap: 2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  infoLabel: {
    color: colors.mutedText,
    fontSize: 11,
  },
  infoValue: {
    flex: 1,
    color: colors.espresso,
    fontSize: 13,
    textAlign: "right",
  },
  sectionCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.espresso,
    fontSize: 14,
    fontWeight: "700",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  statusOption: {
    flexGrow: 1,
    flexBasis: "48%",
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: colors.parchment,
    paddingHorizontal: spacing.sm,
  },
  statusOptionActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  disabled: {
    opacity: 0.55,
  },
  statusText: {
    color: colors.espresso,
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextActive: {
    color: colors.card,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  paymentCopy: {
    gap: 2,
  },
  paidText: {
    color: colors.sage,
    fontSize: 12,
    fontWeight: "700",
  },
  unpaidText: {
    color: colors.brick,
    fontSize: 12,
    fontWeight: "700",
  },
  paymentNote: {
    color: colors.mutedText,
    fontSize: 10,
    lineHeight: 15,
  },
  muted: {
    color: colors.mutedText,
    fontSize: 12,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: "600",
  },
  itemTotal: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: "600",
  },
  grandTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  note: {
    color: colors.espresso,
    fontSize: 13,
    lineHeight: 19,
  },
});
