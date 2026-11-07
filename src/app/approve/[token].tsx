import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageCard } from "@/components/ui/screen-primitives";
import { allocateLineTotals, groupLinesByItem, hasOptionLabel } from "@/domain/orders";
import { approveOrder, declineOrder, getOrderForApproval, type ApprovalOrder } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function longDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Public customer page opened from the approval link; it works without signing in.
export default function ApproveOrderScreen() {
  const { token: rawToken } = useLocalSearchParams<{ token: string | string[] }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const [order, setOrder] = useState<ApprovalOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDecline, setConfirmDecline] = useState(false);
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
      const updated = await approveOrder(token, "");
      if (updated) setOrder(updated);
    } catch {
      setError("We couldn’t record your approval. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const updated = await declineOrder(token);
      if (updated) setOrder(updated);
      setConfirmDecline(false);
    } catch {
      setError("We couldn’t record your response. Please try again.");
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
  const declined = order.approvalStatus === "declined";
  const cancelled = order.status === "Cancelled";
  const canApprove = order.approvalStatus === "pending" && !cancelled;
  const discountedLineTotals = allocateLineTotals(
    order.items.map((item) => ({
      productId: item.name,
      productName: item.name,
      optionName: item.optionName,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    })),
    order.discountAmount,
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandBlock}>
          <Image source={require("../../../assets/images/icon.png")} resizeMode="contain" style={styles.appIcon} />
          <Text style={styles.brand}>THE RISING DOUGH</Text>
          <Text style={styles.brandCaption}>Made fresh for you</Text>
        </View>

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>ORDER REVIEW</Text>
          <Text style={styles.title}>Review your order</Text>
        </View>

        <View style={styles.invoiceCard}>
          <View style={styles.accentRule} />
          <View style={styles.invoiceHeader}>
            <View>
              <Text style={styles.invoiceLabel}>ORDER NUMBER</Text>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            </View>
            <View style={styles.dueBlock}>
              <Text style={styles.invoiceLabel}>NEEDED BY</Text>
              <Text style={styles.dueDate}>{longDate(order.dueDate)}</Text>
            </View>
          </View>

          <View style={styles.customerBlock}>
            <Text style={styles.invoiceLabel}>CUSTOMER</Text>
            <Text style={styles.customerName}>{order.customerName || "Customer"}</Text>
          </View>

          <View style={styles.tableHeader}>
            <Text style={[styles.columnLabel, styles.itemColumn]}>ITEM</Text>
            <Text style={[styles.columnLabel, styles.qtyColumn]}>QTY</Text>
            <Text style={[styles.columnLabel, styles.unitColumn]}>UNIT</Text>
            <Text style={[styles.columnLabel, styles.amountColumn]}>AMOUNT</Text>
          </View>

          {groupLinesByItem(order.items.map((item) => ({ ...item, productId: item.name }))).map((group) => (
            <View key={group.key}>
              {group.showOptions ? (
                <View style={styles.groupRow}>
                  <Text style={styles.itemName}>{group.name}</Text>
                </View>
              ) : null}
              {group.entries.map(({ line: item, index }) => {
                const original = item.unitPrice * item.quantity;
                const discounted = discountedLineTotals[index] ?? original;
                const hasDiscount = discounted < original;
                return (
                  <View key={`${item.name}-${item.optionName}-${item.unitPrice}-${index}`} style={[styles.itemRow, group.showOptions && styles.optionRow]}>
                    <View style={styles.itemColumn}>
                      <Text style={group.showOptions ? styles.optionName : styles.itemName}>
                        {group.showOptions ? (hasOptionLabel(item.optionName) ? item.optionName : "Default") : item.name}
                      </Text>
                    </View>
                    <Text style={[styles.quantity, styles.qtyColumn]}>{item.quantity}</Text>
                    <Text style={[styles.unitPrice, styles.unitColumn]}>{money(item.unitPrice)}</Text>
                    <View style={[styles.amountColumn, styles.amountCell]}>
                      {hasDiscount ? <Text style={styles.wasPrice}>{money(original)}</Text> : null}
                      <Text style={[styles.lineTotal, hasDiscount && styles.discountedPrice]}>{money(discounted)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{money(order.subtotal)}</Text>
            </View>
            {order.discountAmount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountLabel}>−{money(order.discountAmount)}</Text>
              </View>
            ) : null}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Order total</Text>
              <Text style={styles.grandTotal}>{money(order.total)}</Text>
            </View>
          </View>

          <Text style={styles.invoiceNote}>Payment will be handled separately when your order is complete.</Text>
        </View>

        {error ? <MessageCard title="Something went wrong" message={error} tone="error" /> : null}

        {approved ? (
          <View style={[styles.resultCard, styles.successCard]}>
            <Text style={styles.resultTitle}>Thank you for approving!</Text>
            <Text style={styles.resultText}>
              Your approval for {money(order.approvedTotal ?? order.total)} has been recorded. The bakery has been notified.
            </Text>
          </View>
        ) : declined ? (
          <View style={[styles.resultCard, styles.cancelledCard]}>
            <Text style={[styles.resultTitle, styles.cancelledText]}>Order declined</Text>
            <Text style={styles.resultText}>Your response has been sent to the bakery. Please contact us if you change your mind.</Text>
          </View>
        ) : cancelled ? (
          <View style={[styles.resultCard, styles.cancelledCard]}>
            <Text style={[styles.resultTitle, styles.cancelledText]}>This order was cancelled</Text>
            <Text style={styles.resultText}>Please contact the bakery if you have questions.</Text>
          </View>
        ) : canApprove ? (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>{confirmDecline ? "Are you sure?" : "Ready to respond?"}</Text>
            {confirmDecline ? (
              <>
                <Text style={styles.actionText}>Are you sure you want to decline this order?</Text>
                <View style={styles.actionButtons}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => setConfirmDecline(false)}
                    style={({ pressed }) => [styles.secondaryButton, styles.buttonFlex, pressed && styles.disabled]}
                  >
                    <Text style={styles.secondaryButtonText}>No, go back</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => void decline()}
                    style={({ pressed }) => [styles.declineButton, styles.buttonFlex, (submitting || pressed) && styles.disabled]}
                  >
                    <Text style={styles.declineText}>{submitting ? "Sending…" : "Yes, decline"}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.actionText}>Choose whether to approve or decline this order.</Text>
                <View style={styles.actionButtons}>
                  <Pressable
                    accessibilityLabel={`Approve order for ${money(order.total)}`}
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => void approve()}
                    style={({ pressed }) => [styles.approveButton, styles.buttonFlex, (submitting || pressed) && styles.disabled]}
                  >
                    <Text style={styles.approveText}>{submitting ? "Recording…" : `Approve · ${money(order.total)}`}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => setConfirmDecline(true)}
                    style={({ pressed }) => [styles.secondaryButton, styles.buttonFlex, pressed && styles.disabled]}
                  >
                    <Text style={styles.secondaryButtonText}>Decline</Text>
                  </Pressable>
                </View>
              </>
            )}
            <Text style={styles.actionFootnote}>No payment is collected on this page.</Text>
          </View>
        ) : (
          <MessageCard title="Not ready for approval" message="Please contact the bakery for help with this order." />
        )}

        <Text style={styles.footer}>Thank you for choosing The Rising Dough.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, width: "100%", maxWidth: 680, alignSelf: "center" },
  brandBlock: { alignItems: "center", gap: 3 },
  appIcon: { width: 68, height: 68, marginBottom: spacing.xs },
  brand: { color: colors.teal, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, textAlign: "center" },
  brandCaption: { color: colors.mutedText, fontSize: 11 },
  cancelledText: { color: colors.brick },
  heading: { alignItems: "center", gap: 3, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  eyebrow: { color: colors.orange, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.espresso, fontFamily: serifFamily, fontSize: 29, fontWeight: "800" },
  invoiceCard: { width: "100%", gap: 0, overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.card, padding: spacing.sm },
  accentRule: { height: 4, borderRadius: 2, backgroundColor: colors.teal, marginBottom: spacing.sm },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.md, marginBottom: spacing.sm },
  invoiceLabel: { color: colors.mutedText, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  orderNumber: { marginTop: 3, color: colors.teal, fontFamily: serifFamily, fontSize: 22, fontWeight: "800" },
  dueBlock: { alignItems: "flex-end", flexShrink: 1 },
  dueDate: { marginTop: 4, color: colors.espresso, fontSize: 13, fontWeight: "600", textAlign: "right" },
  customerBlock: { borderLeftWidth: 3, borderLeftColor: colors.orange, borderRadius: 10, backgroundColor: "#F8F1E4", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  customerName: { marginTop: 2, color: colors.espresso, fontFamily: serifFamily, fontSize: 18, fontWeight: "800" },
  tableHeader: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.parchment, paddingVertical: 9, paddingHorizontal: spacing.xs, gap: spacing.xs },
  columnLabel: { color: colors.mutedText, fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  itemColumn: { flex: 1, minWidth: 72 },
  qtyColumn: { width: 30, textAlign: "center" },
  unitColumn: { width: 61, textAlign: "right" },
  amountColumn: { width: 73, textAlign: "right" },
  itemRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.md },
  itemName: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  groupRow: { paddingHorizontal: spacing.xs, paddingTop: spacing.md, paddingBottom: 2 },
  optionRow: { paddingVertical: spacing.sm, paddingLeft: spacing.md },
  optionName: { color: colors.espresso, fontSize: 12, fontWeight: "600" },
  unitPrice: { color: colors.mutedText, fontSize: 11, textAlign: "right" },
  quantity: { color: colors.espresso, fontSize: 12, fontWeight: "700", textAlign: "center" },
  amountCell: { alignItems: "flex-end" },
  lineTotal: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  wasPrice: { color: colors.mutedText, fontSize: 10, textDecorationLine: "line-through" },
  discountedPrice: { color: colors.sale },
  totals: { gap: 8, paddingTop: spacing.md, paddingHorizontal: spacing.xs },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  totalLabel: { color: colors.mutedText, fontSize: 13 },
  totalValue: { color: colors.espresso, fontSize: 13 },
  discountLabel: { color: colors.sale, fontSize: 13, fontWeight: "700" },
  grandTotalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.espresso, marginTop: 2, paddingTop: spacing.md },
  grandTotalLabel: { color: colors.espresso, fontSize: 15, fontWeight: "800" },
  grandTotal: { color: colors.teal, fontFamily: serifFamily, fontSize: 22, fontWeight: "800" },
  invoiceNote: { color: colors.mutedText, fontSize: 11, lineHeight: 16, paddingTop: spacing.md, paddingHorizontal: spacing.xs },
  actionCard: { width: "100%", alignItems: "center", gap: spacing.sm, borderRadius: 16, backgroundColor: colors.card, padding: spacing.md },
  actionTitle: { color: colors.espresso, fontFamily: serifFamily, fontSize: 20, fontWeight: "800", textAlign: "center" },
  actionText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: "center" },
  actionButtons: { width: "100%", flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  buttonFlex: { flex: 1, minWidth: 0 },
  approveButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.teal, paddingHorizontal: spacing.sm },
  approveText: { color: colors.card, fontSize: 13, fontWeight: "800", textAlign: "center" },
  secondaryButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.parchment, paddingHorizontal: spacing.sm },
  secondaryButtonText: { color: colors.espresso, fontSize: 13, fontWeight: "800", textAlign: "center" },
  declineButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.brick, paddingHorizontal: spacing.sm },
  declineText: { color: colors.card, fontSize: 13, fontWeight: "800", textAlign: "center" },
  disabled: { opacity: 0.55 },
  actionFootnote: { color: colors.mutedText, fontSize: 11, textAlign: "center" },
  resultCard: { width: "100%", alignItems: "center", gap: spacing.xs, borderRadius: 16, padding: spacing.lg },
  successCard: { borderWidth: 1, borderColor: "#DCE8D2", backgroundColor: "#F3F7EF" },
  cancelledCard: { backgroundColor: "#FAF0ED" },
  resultTitle: { color: colors.teal, fontSize: 16, fontWeight: "800", textAlign: "center" },
  resultText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: "center" },
  footer: { color: colors.mutedText, fontSize: 11, textAlign: "center", paddingTop: spacing.xs },
});
