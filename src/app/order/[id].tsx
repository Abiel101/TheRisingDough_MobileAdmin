import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import {
  orderStatuses,
  orderStatusLabels,
  paymentMethods,
  type OrderStatus,
  type PaymentMethod,
} from "@/domain/orders";
import { formatDate } from "@/components/order-card";
import { AppScreen, ContentCard, FormField, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getOrder, updateOrder, type OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  zelle: "Zelle",
  other: "Other",
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
  const [editing, setEditing] = useState(false);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>("Pending");
  const [draftPaid, setDraftPaid] = useState(false);
  const [draftPaymentMethod, setDraftPaymentMethod] = useState<PaymentMethod>("cash");
  const [draftPaymentMethodOther, setDraftPaymentMethodOther] = useState("");
  const [paymentMethodChoice, setPaymentMethodChoice] = useState<PaymentMethod>("cash");
  const [paymentMethodOtherChoice, setPaymentMethodOtherChoice] = useState("");
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
        setDraftStatus(result.status);
        setDraftPaid(result.paid);
        setDraftPaymentMethod(result.paymentMethod ?? "cash");
        setDraftPaymentMethodOther(result.paymentMethodOther);
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

  async function persist(changes: {
    status?: OrderStatus;
    paid?: boolean;
    paymentMethod?: PaymentMethod | null;
    paymentMethodOther?: string | null;
  }): Promise<boolean> {
    if (!order) return false;
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
          paymentMethod: changes.paymentMethod !== undefined ? changes.paymentMethod : current.paymentMethod,
          paymentMethodOther:
            changes.paymentMethodOther !== undefined ? changes.paymentMethodOther ?? "" : current.paymentMethodOther,
          fulfilledDate:
            changes.status === "Fulfilled"
              ? todayKey()
              : changes.status
                ? ""
                : current.fulfilledDate,
        };
      });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this order.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function beginEdit() {
    if (!order) return;
    setDraftStatus(order.status);
    setDraftPaid(order.paid);
    setDraftPaymentMethod(order.paymentMethod ?? "cash");
    setDraftPaymentMethodOther(order.paymentMethodOther);
    setEditing(true);
    setError("");
  }

  function cancelEdit() {
    if (!order) return;
    setDraftStatus(order.status);
    setDraftPaid(order.paid);
    setDraftPaymentMethod(order.paymentMethod ?? "cash");
    setDraftPaymentMethodOther(order.paymentMethodOther);
    setEditing(false);
    setError("");
  }

  async function saveEdits() {
    if (!order) return;
    const changes: {
      status?: OrderStatus;
      paid?: boolean;
      paymentMethod?: PaymentMethod | null;
      paymentMethodOther?: string | null;
    } = {};
    if (draftPaid && draftPaymentMethod === "other" && !draftPaymentMethodOther.trim()) {
      setError("Enter the custom payment method before saving.");
      return;
    }
    if (draftStatus !== order.status) changes.status = draftStatus;
    if (draftPaid !== order.paid) changes.paid = draftPaid;
    const nextPaymentMethod = draftPaid ? draftPaymentMethod : null;
    if (nextPaymentMethod !== order.paymentMethod) changes.paymentMethod = nextPaymentMethod;
    const nextPaymentMethodOther =
      draftPaid && draftPaymentMethod === "other" ? draftPaymentMethodOther.trim() : null;
    if (nextPaymentMethodOther !== (order.paymentMethodOther || null)) {
      changes.paymentMethodOther = nextPaymentMethodOther;
    }
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      return;
    }
    if (await persist(changes)) setEditing(false);
  }

  function advanceStatus() {
    if (!order) return;
    const nextIndex = orderStatuses.indexOf(order.status) + 1;
    const nextStatus = orderStatuses[nextIndex];
    if (nextStatus) void persist({ status: nextStatus });
  }

  function markPaid() {
    if (paymentMethodChoice === "other" && !paymentMethodOtherChoice.trim()) {
      setError("Enter the custom payment method before marking this order paid.");
      return;
    }
    void persist({
      paid: true,
      paymentMethod: paymentMethodChoice,
      paymentMethodOther:
        paymentMethodChoice === "other" ? paymentMethodOtherChoice.trim() : null,
    });
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
  const selectedPaymentMethod = editing ? draftPaymentMethod : paymentMethodChoice;
  const selectedPaymentMethodOther = editing ? draftPaymentMethodOther : paymentMethodOtherChoice;

  return (
    <AppScreen>
      <SheetHeader title={`Order ${order.number}`} subtitle="Order details and progress." />

      {error ? <MessageCard title="Update failed" message={error} tone="error" /> : null}

      <View style={styles.editActions}>
        {editing ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={cancelEdit}
              style={[styles.secondaryAction, saving && styles.disabled]}
            >
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={() => void saveEdits()}
              style={[styles.primaryAction, saving && styles.disabled]}
            >
              <Text style={styles.primaryActionText}>{saving ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={beginEdit}
            style={styles.secondaryAction}
          >
            <Text style={styles.secondaryActionText}>Edit order</Text>
          </Pressable>
        )}
      </View>

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
                  {orderStatusLabels[status]}
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
        <Text style={styles.sectionTitle}>{editing ? "Edit status" : "Order status"}</Text>
        {editing ? (
          <View style={styles.statusGrid}>
            {orderStatuses.map((status) => {
              const active = draftStatus === status;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: saving }}
                  disabled={saving}
                  key={status}
                  onPress={() => setDraftStatus(status)}
                  style={[styles.statusOption, active && styles.statusOptionActive, saving && styles.disabled]}
                >
                  <Text style={[styles.statusText, active && styles.statusTextActive]}>
                    {orderStatusLabels[status]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.statusAdvanceRow}>
            <View style={styles.currentStatusCopy}>
              <Text style={styles.currentStatusLabel}>Current</Text>
              <Text style={styles.currentStatus}>{orderStatusLabels[order.status]}</Text>
            </View>
            {order.status !== orderStatuses[orderStatuses.length - 1] ? (
              <View style={styles.nextStatusGroup}>
                <Text style={styles.statusArrow}>→</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={advanceStatus}
                  style={[styles.primaryAction, saving && styles.disabled]}
                >
                  <Text style={styles.primaryActionText}>
                    {saving ? "Saving…" : orderStatusLabels[orderStatuses[progressIndex + 1]]}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        <View style={styles.paymentRow}>
          <View style={styles.paymentCopy}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <Text style={order.paymentTrackingAvailable ? (order.paid ? styles.paidText : styles.unpaidText) : styles.muted}>
              {order.paymentTrackingAvailable ? (order.paid ? "Paid" : "Unpaid") : "Not set up yet"}
            </Text>
          </View>
          {order.paymentTrackingAvailable ? (
            <Switch
              accessibilityLabel={editing ? "Edit payment status" : "Payment status"}
              disabled={!editing || saving}
              onValueChange={setDraftPaid}
              thumbColor={colors.card}
              trackColor={{ false: colors.border, true: colors.sage }}
              value={editing ? draftPaid : order.paid}
            />
          ) : null}
        </View>
        {order.paymentTrackingAvailable && order.paid && !editing ? (
          <InfoRow
            label="Payment method"
            value={
              order.paymentMethod === "other"
                ? order.paymentMethodOther || "Other"
                : order.paymentMethod
                  ? paymentMethodLabels[order.paymentMethod]
                  : "Not recorded"
            }
          />
        ) : null}
        {order.paymentTrackingAvailable && (editing || !order.paid) ? (
          <View style={styles.paymentMethodSection}>
            <Text style={styles.infoLabel}>Payment method</Text>
            <View style={styles.methodGrid}>
              {paymentMethods.map((method) => {
                const selected = selectedPaymentMethod === method;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: saving }}
                    disabled={saving}
                    key={method}
                    onPress={() => {
                      if (editing) setDraftPaymentMethod(method);
                      else setPaymentMethodChoice(method);
                    }}
                    style={[styles.methodOption, selected && styles.methodOptionSelected, saving && styles.disabled]}
                  >
                    <Text style={[styles.methodText, selected && styles.methodTextSelected]}>
                      {paymentMethodLabels[method]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedPaymentMethod === "other" ? (
              <FormField
                autoCapitalize="words"
                editable={!saving}
                label="Other payment method"
                onChangeText={editing ? setDraftPaymentMethodOther : setPaymentMethodOtherChoice}
                placeholder="Enter payment method"
                value={selectedPaymentMethodOther}
              />
            ) : null}
            {!editing && !order.paid ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving || (paymentMethodChoice === "other" && !paymentMethodOtherChoice.trim())}
                onPress={markPaid}
                style={[
                  styles.primaryAction,
                  styles.markPaidAction,
                  (saving || (paymentMethodChoice === "other" && !paymentMethodOtherChoice.trim())) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.primaryActionText}>{saving ? "Saving…" : "Mark as paid"}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
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
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  primaryAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: colors.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    color: colors.card,
    fontSize: 12,
    fontWeight: "700",
  },
  markPaidAction: {
    marginTop: spacing.sm,
  },
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    color: colors.teal,
    fontSize: 12,
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
  statusAdvanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  currentStatusCopy: {
    gap: 2,
  },
  currentStatusLabel: {
    color: colors.mutedText,
    fontSize: 10,
  },
  currentStatus: {
    color: colors.espresso,
    fontSize: 15,
    fontWeight: "700",
  },
  nextStatusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusArrow: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: "700",
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
  paymentMethodSection: {
    gap: spacing.xs,
  },
  methodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  methodOption: {
    minHeight: 36,
    justifyContent: "center",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: colors.parchment,
    paddingHorizontal: spacing.md,
  },
  methodOptionSelected: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  methodText: {
    color: colors.espresso,
    fontSize: 11,
    fontWeight: "600",
  },
  methodTextSelected: {
    color: colors.card,
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
