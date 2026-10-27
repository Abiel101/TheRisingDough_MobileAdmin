import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import {
  orderStatuses,
  orderStatusLabels,
  paymentMethods,
  resolveStatus,
  type OrderStatus,
  type PaymentMethod,
} from "@/domain/orders";
import { formatDate } from "@/components/order-card";
import { NativeIcon } from "@/components/ui/native-icon";
import { FormField, MessageCard } from "@/components/ui/screen-primitives";
import {
  addItemsToOrder,
  deleteOrder,
  getOrder,
  listProducts,
  removeOrderItems,
  updateOrder,
  type OrderRecord,
  type ProductRecord,
} from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

// Client-side manager check only; it does not protect the data on the server.
const MANAGER_PASSWORD = "2585";
const ADD_ITEMS_CUTOFF_DAYS = 3;
const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  zelle: "Zelle",
  other: "Other",
};

const statusColors = {
  Pending: colors.mustard,
  "In progress": "#2F6F9F",
  Ready: colors.orange,
  Fulfilled: colors.sage,
} as const;

type OrderChanges = Parameters<typeof updateOrder>[1];
type MenuMode = "closed" | "menu" | "cancel" | "delete";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function daysUntil(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const due = new Date(year, (month || 1) - 1, day || 1);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

function formatDueLong(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function OrderDetailScreen() {
  // Swipe-to-dismiss is limited to dragging down on the top bar.
  const headerDismiss = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 80) router.back();
        },
      }),
    [],
  );

  const { session } = useAuth();
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<PaymentMethod>("cash");
  const [paymentMethodOtherChoice, setPaymentMethodOtherChoice] = useState("");
  const [menuMode, setMenuMode] = useState<MenuMode>("closed");
  const [cancelReason, setCancelReason] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [menuError, setMenuError] = useState("");
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
      if (result) {
        setPaymentMethodChoice(result.paymentMethod ?? "cash");
        setPaymentMethodOtherChoice(result.paymentMethodOther);
      }
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

  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load catalog items."));
  }, []);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      await action();
      const updated = id ? await getOrder(id) : null;
      if (updated) setOrder(updated);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this order.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function changeOrder(changes: OrderChanges) {
    if (!order) return Promise.resolve(false);
    return run(() => updateOrder(order.id, changes));
  }

  function markPaid() {
    if (!order) return;
    if (paymentMethodChoice === "other" && !paymentMethodOtherChoice.trim()) {
      setError("Enter the custom payment method before marking this order paid.");
      return;
    }
    void changeOrder({
      paid: true,
      paymentMethod: paymentMethodChoice,
      paymentMethodOther: paymentMethodChoice === "other" ? paymentMethodOtherChoice.trim() : null,
      status: resolveStatus(order.status, true),
    });
  }

  function undoPayment() {
    if (!order) return;
    void changeOrder({
      paid: false,
      paymentMethod: null,
      paymentMethodOther: null,
      ...(order.status === "Fulfilled" ? { status: "Ready" as const } : {}),
    });
  }

  async function handleAddItems() {
    if (!order || !session?.user.id) return;
    const items = products.flatMap((product) => {
      const quantity = itemQuantities[product.id] ?? 0;
      return quantity > 0 ? [{ product, quantity }] : [];
    });
    if (!items.length) return;
    const ownerId = session.user.id;
    if (await run(() => addItemsToOrder(ownerId, order.id, items))) {
      setItemQuantities({});
      setAddOpen(false);
    }
  }

  function removeItem(itemId: string) {
    if (!order) return;
    void run(() => removeOrderItems(order.id, [itemId]));
  }

  function closeMenu() {
    setMenuMode("closed");
    setCancelReason("");
    setDeletePassword("");
    setMenuError("");
  }

  async function confirmCancel() {
    if (!order) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setMenuError("Add a reason for cancelling this order.");
      return;
    }
    const notes = [order.notes.trim(), `Cancelled: ${reason}`].filter(Boolean).join("\n");
    if (await changeOrder({ status: "Cancelled", notes })) closeMenu();
  }

  async function confirmDelete() {
    if (!order) return;
    if (deletePassword !== MANAGER_PASSWORD) {
      setMenuError("Incorrect manager password.");
      return;
    }
    if (await run(() => deleteOrder(order.id))) {
      closeMenu();
      router.back();
    }
  }

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          {loading ? (
            <>
              <ActivityIndicator color={colors.teal} />
              <Text style={styles.muted}>Loading order…</Text>
            </>
          ) : (
            <MessageCard title="Order unavailable" message={error || "This order could not be found."} tone="error" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const cancelled = order.status === "Cancelled";
  const completed = order.status === "Fulfilled";
  const progressIndex = order.status === "Cancelled" ? -1 : orderStatuses.indexOf(order.status);
  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const paymentTracked = order.paymentTrackingAvailable;
  const canAddItems = !cancelled && !completed && daysUntil(order.dueDate) >= ADD_ITEMS_CUTOFF_DAYS;
  const canRemoveItems = order.status === "Pending" && order.items.length > 1;
  const hasSelection = Object.values(itemQuantities).some((quantity) => quantity > 0);
  const otherMethodMissing = paymentMethodChoice === "other" && !paymentMethodOtherChoice.trim();
  const statusColor = cancelled ? colors.brick : statusColors[order.status as keyof typeof statusColors];
  const previousStatus = progressIndex > 0 ? orderStatuses[progressIndex - 1] : undefined;
  const advanceTarget: OrderStatus | undefined = cancelled || completed
    ? undefined
    : order.status === "Ready"
      ? undefined
      : orderStatuses[progressIndex + 1];
  const showPayAction = paymentTracked && !order.paid && !cancelled;
  const payDisabled = saving || otherMethodMissing;
  const firstName = order.customer.trim().split(/\s+/)[0] || "Customer";
  const initial = (order.customer.trim()[0] ?? "?").toUpperCase();

  function advance() {
    if (!advanceTarget || !order) return;
    void changeOrder({ status: resolveStatus(advanceTarget, paymentTracked ? order.paid : true) });
  }

  function openMenu() {
    if (Platform.OS !== "ios") {
      setMenuMode("menu");
      return;
    }
    const actions: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (previousStatus) actions.push({ label: `Move back to ${orderStatusLabels[previousStatus]}`, run: () => void changeOrder({ status: previousStatus }) });
    if (!cancelled) actions.push({ label: "Cancel order", run: () => setMenuMode("cancel") });
    actions.push({ label: "Delete order (manager)", run: () => setMenuMode("delete"), destructive: true });
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Order options",
        options: [...actions.map((action) => action.label), "Close"],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex((action) => action.destructive),
      },
      (index) => actions[index]?.run(),
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View {...headerDismiss.panHandlers} style={styles.topBar}>
        <Pressable accessibilityLabel="Close" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={styles.roundButton}>
          <NativeIcon name="back" size={20} />
        </Pressable>
        <Text style={styles.brand}>THE RISING DOUGH</Text>
        <Pressable accessibilityLabel="More order options" accessibilityRole="button" onPress={openMenu} style={styles.roundButton}>
          <NativeIcon name="more" size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{firstName}’s order</Text>
        <View style={styles.pillRow}>
          <View style={[styles.pill, { backgroundColor: `${statusColor}22` }]}>
            <Text style={[styles.pillText, { color: statusColor }]}>{orderStatusLabels[order.status]}</Text>
          </View>
          {paymentTracked ? (
            <View style={[styles.pill, { backgroundColor: order.paid ? `${colors.sage}26` : `${colors.brick}1F` }]}>
              <Text style={[styles.pillText, { color: order.paid ? colors.sage : colors.brick }]}>
                {order.paid ? "Paid" : "Unpaid"}
              </Text>
            </View>
          ) : null}
          <Text style={styles.orderNumber}>{order.number}</Text>
        </View>

        {error ? <MessageCard title="Update failed" message={error} tone="error" /> : null}

        <View style={styles.dueCard}>
          <View style={styles.dueTop}>
            <View>
              <Text style={styles.dueLabel}>DUE</Text>
              <Text style={styles.dueValue}>{formatDueLong(order.dueDate)}</Text>
            </View>
            <View style={styles.totalBlock}>
              <Text style={styles.dueLabel}>TOTAL</Text>
              <Text style={styles.dueValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
          <View style={styles.segmentRow}>
            {orderStatuses.map((status, index) => {
              const reached = !cancelled && index <= progressIndex;
              return (
                <View key={status} style={styles.segmentCell}>
                  <View style={[styles.segment, reached && { backgroundColor: statusColors[status] }]} />
                  <Text style={[styles.segmentLabel, reached && styles.segmentLabelReached]} numberOfLines={1}>
                    {orderStatusLabels[status]}
                  </Text>
                </View>
              );
            })}
          </View>
          {cancelled ? <Text style={styles.cancelledBanner}>This order was cancelled</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.customerCopy}>
              <Text style={styles.customerName}>{order.customer}</Text>
              <Text style={styles.muted}>{order.customerPhone || "No phone"}</Text>
            </View>
            {order.customerPhone ? (
              <Pressable
                accessibilityLabel={`Call ${order.customer}`}
                accessibilityRole="button"
                onPress={() => void Linking.openURL(`tel:${order.customerPhone}`)}
                style={styles.callButton}
              >
                <Text style={styles.callGlyph}>✆</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.divider} />
          <InfoRow label="Placed" value={order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"} strong />
          {order.fulfilledDate ? <InfoRow label="Completed" value={formatDate(order.fulfilledDate)} strong /> : null}
          <InfoRow label="Email" value={order.customerEmail || "Not provided"} />
          <InfoRow label="Address" value={order.customerAddress || "Not provided"} />
          {order.notes ? <InfoRow label="Notes" value={order.notes} /> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Items</Text>
            <Text style={styles.muted}>{itemCount} total</Text>
          </View>
          {order.items.length ? order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.qtyBadge}>
                <Text style={styles.qtyBadgeText}>{item.quantity}×</Text>
              </View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.muted}>{formatCurrency(item.price)} each</Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(item.quantity * item.price)}</Text>
              {canRemoveItems ? (
                <Pressable
                  accessibilityLabel={`Remove ${item.name}`}
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => removeItem(item.id)}
                  style={styles.removeItemButton}
                >
                  <NativeIcon color={colors.brick} name="close" size={14} />
                </Pressable>
              ) : null}
            </View>
          )) : <Text style={styles.muted}>No item details were saved with this order.</Text>}
        </View>

        {paymentTracked ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment method</Text>
            {order.paid ? (
              <>
                <InfoRow
                  label="Received via"
                  value={
                    order.paymentMethod === "other"
                      ? order.paymentMethodOther || "Other"
                      : order.paymentMethod
                        ? paymentMethodLabels[order.paymentMethod]
                        : "Not recorded"
                  }
                  strong
                />
                <Pressable accessibilityRole="button" disabled={saving} onPress={undoPayment} style={[styles.outlineAction, saving && styles.disabled]}>
                  <Text style={styles.outlineActionText}>Undo payment received</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.chipRow}>
                  {paymentMethods.map((method) => {
                    const selected = paymentMethodChoice === method;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: saving }}
                        disabled={saving}
                        key={method}
                        onPress={() => setPaymentMethodChoice(method)}
                        style={[styles.chip, selected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{paymentMethodLabels[method]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {paymentMethodChoice === "other" ? (
                  <FormField
                    autoCapitalize="words"
                    editable={!saving}
                    label="Other payment method"
                    onChangeText={setPaymentMethodOtherChoice}
                    placeholder="Enter payment method"
                    value={paymentMethodOtherChoice}
                  />
                ) : null}
                {order.status !== "Ready" && !cancelled ? (
                  <Text style={styles.hint}>Paying early keeps the order open. It completes once it is Ready.</Text>
                ) : null}
                {order.status === "Ready" ? (
                  <Text style={styles.hint}>Ready. This order completes automatically once payment is received.</Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {canAddItems && addOpen ? (
          <View style={[styles.addCard, styles.addCardActive]}>
            <Pressable accessibilityRole="button" onPress={() => setAddOpen(false)} style={styles.addHeader}>
              <Text style={styles.addPlus}>＋</Text>
              <View style={styles.itemCopy}>
                <Text style={styles.addTitle}>Add items</Text>
                <Text style={styles.muted}>Tap to collapse</Text>
              </View>
            </Pressable>
            {products.map((product) => {
              const quantity = itemQuantities[product.id] ?? 0;
              return (
                <View key={product.id} style={styles.productRow}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{product.name}</Text>
                    <Text style={styles.muted}>{formatCurrency(product.price)}</Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove one ${product.name}`}
                    disabled={!quantity || saving}
                    onPress={() => setItemQuantities((current) => ({ ...current, [product.id]: Math.max((current[product.id] ?? 0) - 1, 0) }))}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantitySymbol}>−</Text>
                  </Pressable>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <Pressable
                    accessibilityLabel={`Add one ${product.name}`}
                    disabled={saving}
                    onPress={() => setItemQuantities((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantitySymbol}>+</Text>
                  </Pressable>
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              disabled={saving || !hasSelection}
              onPress={() => void handleAddItems()}
              style={[styles.solidAction, (saving || !hasSelection) && styles.disabled]}
            >
              <Text style={styles.solidActionText}>{saving ? "Adding items…" : "Add selected items"}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAddItems }}
            disabled={!canAddItems}
            onPress={() => setAddOpen(true)}
            style={[styles.addCard, canAddItems ? styles.addCardActive : styles.addCardDisabled]}
          >
            <View style={styles.addHeader}>
              <Text style={[styles.addPlus, !canAddItems && styles.addTextDisabled]}>＋</Text>
              <View style={styles.itemCopy}>
                <Text style={[styles.addTitle, !canAddItems && styles.addTextDisabled]}>Add items</Text>
                <Text style={styles.muted}>
                  {cancelled
                    ? "Cancelled orders can’t be changed."
                    : completed
                      ? "Completed orders can’t be changed."
                      : canAddItems
                        ? `Only until ${ADD_ITEMS_CUTOFF_DAYS} days before the due date.`
                        : `Closed — items can only be added until ${ADD_ITEMS_CUTOFF_DAYS} days before the due date.`}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      </ScrollView>

      {showPayAction || advanceTarget || cancelled ? (
        <View style={styles.footer}>
          {showPayAction ? (
            <Pressable
              accessibilityRole="button"
              disabled={payDisabled}
              onPress={markPaid}
              style={[styles.footerOutline, advanceTarget ? null : styles.footerFlex, payDisabled && styles.disabled]}
            >
              <Text style={styles.footerOutlineText}>{saving ? "Saving…" : "Mark as paid"}</Text>
            </Pressable>
          ) : null}
          {advanceTarget ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={advance}
              style={[styles.footerSolid, { backgroundColor: statusColors[advanceTarget as keyof typeof statusColors] }, saving && styles.disabled]}
            >
              <Text style={styles.footerSolidText}>Mark as {orderStatusLabels[advanceTarget]}</Text>
            </Pressable>
          ) : null}
          {cancelled ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void changeOrder({ status: "Pending" })}
              style={[styles.footerSolid, { backgroundColor: statusColors.Pending }, saving && styles.disabled]}
            >
              <Text style={styles.footerSolidText}>Reopen order</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Modal animationType="fade" onRequestClose={closeMenu} transparent visible={menuMode !== "closed"}>
        <Pressable onPress={closeMenu} style={styles.backdrop}>
          <Pressable onPress={() => undefined} style={styles.menuSheet}>
            {menuMode === "menu" ? (
              <>
                <Text style={styles.menuTitle}>Order options</Text>
                {previousStatus ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      closeMenu();
                      void changeOrder({ status: previousStatus });
                    }}
                    style={styles.menuItem}
                  >
                    <Text style={styles.menuItemText}>Move back to {orderStatusLabels[previousStatus]}</Text>
                  </Pressable>
                ) : null}
                {!cancelled ? (
                  <Pressable accessibilityRole="button" onPress={() => setMenuMode("cancel")} style={styles.menuItem}>
                    <Text style={styles.menuItemText}>Cancel order</Text>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" onPress={() => setMenuMode("delete")} style={styles.menuItem}>
                  <Text style={styles.menuItemDestructive}>Delete order (manager)</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={closeMenu} style={styles.outlineAction}>
                  <Text style={styles.outlineActionText}>Close</Text>
                </Pressable>
              </>
            ) : null}
            {menuMode === "cancel" ? (
              <>
                <Text style={styles.menuTitle}>Cancel this order?</Text>
                <Text style={styles.muted}>The order moves to the Cancelled tab. Add a reason so it is on record.</Text>
                <FormField
                  label="Reason"
                  multiline
                  onChangeText={setCancelReason}
                  placeholder="Why is this order being cancelled?"
                  value={cancelReason}
                />
                {menuError ? <Text style={styles.menuError}>{menuError}</Text> : null}
                <View style={styles.menuActions}>
                  <Pressable accessibilityRole="button" onPress={closeMenu} style={styles.outlineAction}>
                    <Text style={styles.outlineActionText}>Keep order</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirmCancel()} style={[styles.destructiveAction, saving && styles.disabled]}>
                    <Text style={styles.solidActionText}>{saving ? "Saving…" : "Cancel order"}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
            {menuMode === "delete" ? (
              <>
                <Text style={styles.menuTitle}>Delete this order?</Text>
                <Text style={styles.muted}>This permanently deletes the order and its items. Enter the manager password to continue.</Text>
                <FormField
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  label="Manager password"
                  onChangeText={setDeletePassword}
                  secureTextEntry
                  value={deletePassword}
                />
                {menuError ? <Text style={styles.menuError}>{menuError}</Text> : null}
                <View style={styles.menuActions}>
                  <Pressable accessibilityRole="button" onPress={closeMenu} style={styles.outlineAction}>
                    <Text style={styles.outlineActionText}>Keep order</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirmDelete()} style={[styles.destructiveAction, saving && styles.disabled]}>
                    <Text style={styles.solidActionText}>{saving ? "Deleting…" : "Delete order"}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  roundButton: {
    minWidth: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
  },
  roundButtonText: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  brand: { color: colors.mutedText, fontSize: 10, fontWeight: "700", letterSpacing: 1.4 },
  content: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  title: { color: colors.espresso, fontFamily: serif, fontSize: 36, fontWeight: "800", lineHeight: 40 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: { borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 5 },
  pillText: { fontSize: 11, fontWeight: "700" },
  orderNumber: { color: colors.mutedText, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  dueCard: { gap: spacing.md, borderRadius: 20, backgroundColor: "#FBE6D8", padding: spacing.md },
  dueTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  totalBlock: { alignItems: "flex-end" },
  dueLabel: { color: colors.espresso, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  dueValue: { color: colors.espresso, fontFamily: serif, fontSize: 22, fontWeight: "800" },
  segmentRow: { flexDirection: "row", gap: spacing.xs },
  segmentCell: { flex: 1, gap: 6 },
  segment: { height: 6, borderRadius: 3, backgroundColor: "#00000014" },
  segmentLabel: { color: colors.mutedText, fontSize: 10, textAlign: "center" },
  segmentLabelReached: { color: colors.espresso, fontWeight: "700" },
  cancelledBanner: { color: colors.brick, fontSize: 13, fontWeight: "700", textAlign: "center" },
  card: { gap: spacing.sm, borderRadius: 20, backgroundColor: colors.card, padding: spacing.md },
  customerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#E4EBDD" },
  avatarText: { color: colors.teal, fontFamily: serif, fontSize: 18, fontWeight: "800" },
  customerCopy: { flex: 1, gap: 2 },
  customerName: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  callButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.teal },
  callGlyph: { color: colors.card, fontSize: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  infoRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, paddingVertical: 4 },
  infoLabel: { color: "#4A6FA5", fontSize: 13 },
  infoValue: { flex: 1, color: colors.mutedText, fontSize: 13, textAlign: "right" },
  infoValueStrong: { color: colors.espresso, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.espresso, fontFamily: serif, fontSize: 18, fontWeight: "800" },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  hint: { color: "#4A6FA5", fontSize: 12, lineHeight: 17 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  qtyBadge: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.cream },
  qtyBadgeText: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  itemCopy: { flex: 1, gap: 2 },
  itemName: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  itemTotal: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  removeItemButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.parchment },
  removeItemText: { color: colors.brick, fontSize: 12, fontWeight: "700" },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: { minHeight: 38, justifyContent: "center", borderColor: colors.border, borderWidth: 1, borderRadius: 999, backgroundColor: colors.card, paddingHorizontal: spacing.lg },
  chipSelected: { borderColor: colors.teal, backgroundColor: colors.teal },
  chipText: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: colors.card },
  addCard: { gap: spacing.sm, borderRadius: 20, borderStyle: "dashed", borderWidth: 1.5, padding: spacing.md },
  addCardActive: { borderColor: colors.mustard, backgroundColor: colors.cream },
  addCardDisabled: { borderColor: colors.border, backgroundColor: "#ECEBE8", opacity: 0.75 },
  addHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  addPlus: { color: colors.teal, fontSize: 20, fontWeight: "700" },
  addTitle: { color: colors.teal, fontSize: 14, fontWeight: "700" },
  addTextDisabled: { color: colors.mutedText },
  productRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.xs },
  quantityButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.card },
  quantitySymbol: { color: colors.teal, fontSize: 18, fontWeight: "700" },
  quantityText: { minWidth: 18, color: colors.espresso, textAlign: "center", fontWeight: "700" },
  footer: { flexDirection: "row", gap: spacing.md, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  footerFlex: { flex: 1 },
  footerOutline: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderColor: colors.teal, borderWidth: 1.5, borderRadius: 14, backgroundColor: colors.card },
  footerOutlineText: { color: colors.teal, fontSize: 14, fontWeight: "700" },
  footerSolid: { flex: 1.3, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  footerSolidText: { color: colors.card, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.55 },
  outlineAction: { minHeight: 44, alignItems: "center", justifyContent: "center", borderColor: colors.border, borderWidth: 1, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  outlineActionText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  solidAction: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.teal },
  solidActionText: { color: colors.card, fontSize: 14, fontWeight: "700" },
  destructiveAction: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.brick, paddingHorizontal: spacing.md },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0007" },
  menuSheet: { gap: spacing.md, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.card, padding: spacing.lg, paddingBottom: spacing.xl },
  menuTitle: { color: colors.espresso, fontSize: 17, fontWeight: "700" },
  menuItem: { minHeight: 48, justifyContent: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  menuItemText: { color: colors.espresso, fontSize: 15, fontWeight: "600" },
  menuItemDestructive: { color: colors.brick, fontSize: 15, fontWeight: "600" },
  menuActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  menuError: { color: colors.brick, fontSize: 13 },
});
