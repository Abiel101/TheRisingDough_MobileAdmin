import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { calculateOrderTotal, orderStatuses, orderStatusLabels, type OrderStatus } from "@/domain/orders";
import { updateOrder, type OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export function OrderCard({
  order,
  onStatusUpdated,
}: {
  order: OrderRecord;
  onStatusUpdated: (orderId: string, status: OrderStatus) => void;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  const status = order.status;

  const nextStatus = orderStatuses[orderStatuses.indexOf(status) + 1];

  async function advanceStatus(closeSwipe: () => void) {
    if (!nextStatus || updatingStatus) return;
    setUpdatingStatus(true);
    setStatusError("");
    try {
      await updateOrder(order.id, { status: nextStatus });
      onStatusUpdated(order.id, nextStatus);
      closeSwipe();
    } catch (cause) {
      setStatusError(cause instanceof Error ? cause.message : "Could not update this order.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const total = calculateOrderTotal(
    order.items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      unitPrice: item.price,
      quantity: item.quantity,
    })),
  );
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);
  const previewItems = order.items.slice(0, 2);

  const card = (
    <Pressable
      accessibilityLabel={`Order ${order.number}, ${order.customer}, due ${formatDate(order.dueDate)}, ${orderStatusLabels[status]}. Open details.`}
      accessibilityHint={nextStatus ? `Swipe left to change the status to ${orderStatusLabels[nextStatus]}.` : undefined}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.orderNumber}>Order {order.number}</Text>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text numberOfLines={1} style={styles.customer}>{order.customer}</Text>
        <StatusPill
          paid={order.paymentTrackingAvailable ? order.paid : undefined}
          status={status}
        />
      </View>
      {previewItems.length ? (
        <View style={styles.items}>
          {previewItems.map((item) => (
            <Text key={`${item.productId}-${item.name}`} numberOfLines={1} style={styles.itemText}>
              {item.quantity} × {item.name}
            </Text>
          ))}
          {order.items.length > previewItems.length ? (
            <Text style={styles.moreItems}>+ {order.items.length - previewItems.length} more items</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.dueLine}>Due {formatDate(order.dueDate)} · {itemCount} item{itemCount === 1 ? "" : "s"}</Text>
      {statusError ? <Text style={styles.statusError}>{statusError}</Text> : null}
    </Pressable>
  );

  if (!nextStatus) return card;

  return (
    <Swipeable
      containerStyle={styles.swipeContainer}
      friction={2}
      overshootRight={false}
      rightThreshold={40}
      renderRightActions={(_progress, _translation, swipeableMethods) => (
        <Pressable
          accessibilityLabel={`Set order ${order.number} to ${orderStatusLabels[nextStatus]}`}
          accessibilityRole="button"
          disabled={updatingStatus}
          onPress={() => void advanceStatus(swipeableMethods.close)}
          style={[styles.swipeAction, updatingStatus && styles.disabled]}
        >
          <Text style={styles.swipeArrow}>→</Text>
          <Text style={styles.swipeActionText}>
            {updatingStatus ? "Saving…" : orderStatusLabels[nextStatus]}
          </Text>
        </Pressable>
      )}
    >
      {card}
    </Swipeable>
  );
}

export function StatusPill({ status, paid }: { status: OrderRecord["status"]; paid?: boolean }) {
  const color = status === "Ready" || status === "Fulfilled" ? colors.sage : colors.teal;
  const background = status === "Pending" ? colors.cream : colors.parchment;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color }]}>{orderStatusLabels[status]}</Text>
      {paid !== undefined ? (
        <Text style={[styles.pillText, { color: paid ? colors.sage : colors.brick }]}>
          {paid ? "Paid" : "Unpaid"}
        </Text>
      ) : null}
    </View>
  );
}

export function formatDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  swipeContainer: {
    borderRadius: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.7,
  },
  swipeAction: {
    width: 124,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 16,
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.sm,
  },
  swipeArrow: {
    color: colors.card,
    fontSize: 20,
    lineHeight: 22,
  },
  swipeActionText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  statusError: {
    color: colors.brick,
    fontSize: 11,
    lineHeight: 15,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  orderNumber: {
    flex: 1,
    color: colors.espresso,
    fontSize: 14,
    fontWeight: "700",
  },
  total: {
    color: colors.espresso,
    fontSize: 14,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  customer: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 13,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  items: {
    gap: 2,
  },
  itemText: {
    color: colors.espresso,
    fontSize: 12,
  },
  moreItems: {
    color: colors.mutedText,
    fontSize: 11,
  },
  dueLine: {
    color: colors.mutedText,
    fontSize: 11,
  },
});
