import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { calculateOrderTotals, groupLinesByItem, orderStatuses, orderStatusLabels, resolveStatus, summarizeLineGroup, type OrderStatus } from "@/domain/orders";
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

  const nextStatus =
    status === "Cancelled" || status === "Ready" || status === "Fulfilled"
      ? undefined
      : orderStatuses[orderStatuses.indexOf(status) + 1];

  async function advanceStatus(closeSwipe: () => void) {
    if (!nextStatus || updatingStatus) return;
    setUpdatingStatus(true);
    setStatusError("");
    try {
      const resolved = resolveStatus(nextStatus, order.paymentTrackingAvailable ? order.paid : true);
      await updateOrder(order.id, { status: resolved });
      onStatusUpdated(order.id, resolved);
      closeSwipe();
    } catch (cause) {
      setStatusError(cause instanceof Error ? cause.message : "Could not update this order.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  const { total } = calculateOrderTotals(
    order.items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      optionName: item.optionName,
      unitPrice: item.price,
      quantity: item.quantity,
    })),
    order.discount,
  );
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);
  const itemGroups = groupLinesByItem(order.items);
  const previewItems = itemGroups.slice(0, 2);

  const card = (
    <Pressable
      accessibilityLabel={`Order ${order.number}, ${order.customer}, due ${formatDate(order.dueDate)}, ${orderStatusLabels[status]}. Open details.`}
      accessibilityHint={nextStatus ? `Swipe left to change the status to ${orderStatusLabels[nextStatus]}.` : undefined}
      accessibilityRole="button"
      animated={false}
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
          awaitingApproval={order.approvalStatus === "pending" && status !== "Cancelled"}
          approvalDeclined={order.approvalStatus === "declined" && status !== "Cancelled"}
          status={status}
        />
      </View>
      {previewItems.length ? (
        <View style={styles.items}>
          {previewItems.map((group) => (
            <Text key={group.key} numberOfLines={2} style={styles.itemText}>
              {summarizeLineGroup(group)}
            </Text>
          ))}
          {itemGroups.length > previewItems.length ? (
            <Text style={styles.moreItems}>+ {itemGroups.length - previewItems.length} more items</Text>
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

const pillTones: Record<OrderRecord["status"], { background: string; color: string }> = {
  Pending: { background: "#F3E3B3", color: "#6B4E0A" },
  "In progress": { background: "#D9E8F5", color: "#1F4E79" },
  Ready: { background: "#DCE8D2", color: "#3E5A2C" },
  Fulfilled: { background: "#D3E5E1", color: colors.teal },
  Cancelled: { background: "#F2D9D2", color: colors.brick },
};

export function StatusPill({ status, paid, awaitingApproval, approvalDeclined }: { status: OrderRecord["status"]; paid?: boolean; awaitingApproval?: boolean; approvalDeclined?: boolean }) {
  const tone = pillTones[status];
  return (
    <View style={styles.pillGroup}>
      {awaitingApproval ? (
        <View style={[styles.pill, { backgroundColor: "#F3E3B3" }]}>
          <Text style={[styles.pillText, { color: "#6B4E0A" }]}>Pending approval</Text>
        </View>
      ) : null}
      {approvalDeclined ? (
        <View style={[styles.pill, { backgroundColor: "#F2D9D2" }]}>
          <Text style={[styles.pillText, { color: colors.brick }]}>Declined</Text>
        </View>
      ) : null}
      {!((awaitingApproval || approvalDeclined) && status === "Pending") ? (
        <View style={[styles.pill, { backgroundColor: tone.background }]}>
          <Text style={[styles.pillText, { color: tone.color }]}>{orderStatusLabels[status]}</Text>
        </View>
      ) : null}
      {paid !== undefined ? (
        <View style={[styles.pill, { backgroundColor: paid ? "#DCE8D2" : "#F8DCD5" }]}>
          <Text style={[styles.pillText, { color: paid ? "#3E5A2C" : colors.brick }]}>{paid ? "Paid" : "Unpaid"}</Text>
        </View>
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
    borderRadius: 16,
    gap: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pressed: {
    backgroundColor: "#F0ECE3",
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
    fontSize: 12.5,
  },
  pillGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  items: {
    gap: 1,
  },
  itemText: {
    color: colors.espresso,
    fontSize: 12,
    fontWeight: "500",
  },
  moreItems: {
    color: colors.mutedText,
    fontSize: 10,
  },
  dueLine: {
    color: colors.mutedText,
    fontSize: 10,
  },
});
