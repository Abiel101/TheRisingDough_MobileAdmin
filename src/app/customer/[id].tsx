import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useLocalSearchParams } from "expo-router";

import { Avatar } from "@/components/ui/design";
import { NativeButton } from "@/components/ui/native-button";
import { NativeConfirmButton } from "@/components/ui/native-confirm-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { NativeSegmentedControl } from "@/components/ui/native-segmented-control";
import { AppScreen, ContentCard, MessageCard } from "@/components/ui/screen-primitives";
import { NativeIcon } from "@/components/ui/native-icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { calculateOrderTotals, orderStatusLabels } from "@/domain/orders";
import { deleteCustomer, getCustomer, listOrders, updateCustomer, type CustomerRecord, type OrderRecord } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

type CustomerTab = "overview" | "history" | "settings";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function orderTotal(order: OrderRecord) {
  return calculateOrderTotals(
    order.items.map((item) => ({
      productId: item.productId,
      productName: item.name,
      optionName: item.optionName,
      unitPrice: item.price,
      quantity: item.quantity,
    })),
    order.discount,
  ).total;
}

export default function CustomerDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<CustomerTab>("overview");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("This customer link is missing its customer ID.");
      setLoading(false);
      return;
    }
    try {
      const result = await getCustomer(id);
      setCustomer(result);
      if (result) {
        setName(result.name);
        setPhone(result.phone);
        setEmail(result.email);
        setAddress(result.address);
        try {
          const purchases = await listOrders({ customerId: result.id, limit: 500 });
          setOrders(purchases.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
          setHistoryError("");
        } catch (cause) {
          setHistoryError(cause instanceof Error ? cause.message : "Could not load purchase history.");
        }
      }
      setError(result ? "" : "This customer could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this customer.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function resetForm() {
    if (!customer) return;
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email);
    setAddress(customer.address);
    setError("");
  }

  async function saveChanges() {
    if (!customer) return;
    setSaving(true);
    setError("");
    try {
      await updateCustomer(customer.id, { name, phone, email, address });
      setCustomer({ ...customer, name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this customer.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer() {
    if (!customer) return;
    setSaving(true);
    setError("");
    try {
      await deleteCustomer(customer.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this customer.");
    } finally {
      setSaving(false);
    }
  }

  const mostRecentOrder = orders[0];
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <AppScreen
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 88 }]}
        safeAreaEdges={["top", "left", "right"]}
      >
        {error ? <MessageCard title="Customer profile" message={error} tone="error" /> : null}
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading customer…</Text></View>
        ) : customer ? (
          <>
            <View style={styles.hero}>
              <Avatar name={customer.name || customer.phone} size={84} />
              <Text style={styles.heroName}>{customer.name || customer.phone}</Text>
              <Text style={styles.muted}>Customer since {formatDate(customer.createdAt)}</Text>
            </View>
            <NativeSegmentedControl
              onChange={setTab}
              options={[
                { value: "overview", label: "Overview" },
                { value: "history", label: "History" },
                { value: "settings", label: "Settings" },
              ]}
              value={tab}
            />
            {tab === "overview" ? (
              <>
                <ContentCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Customer information</Text>
                  <DetailField label="Phone" value={customer.phone || "Not provided"} selectable />
                  <DetailField label="Name" value={customer.name || "Not provided"} />
                  <DetailField label="Email" value={customer.email || "Not provided"} selectable />
                  <DetailField label="Address" value={customer.address || "Not provided"} />
                </ContentCard>
                <ContentCard style={styles.card}>
                  <Text style={styles.sectionTitle}>Most recent purchase</Text>
                  {historyError ? (
                    <Text style={styles.errorText}>{historyError}</Text>
                  ) : mostRecentOrder ? (
                    <PurchaseCard order={mostRecentOrder} />
                  ) : (
                    <Text style={styles.muted}>No purchases have been recorded for this customer.</Text>
                  )}
                  {orders.length > 1 ? (
                    <NativeButton label="View purchase history" onPress={() => setTab("history")} variant="text" />
                  ) : null}
                </ContentCard>
              </>
            ) : null}
            {tab === "history" ? (
              <ContentCard style={styles.card}>
                <Text style={styles.sectionTitle}>Purchase history</Text>
                {historyError ? <Text style={styles.errorText}>{historyError}</Text> : orders.length ? (
                  orders.map((order) => <PurchaseCard key={order.id} order={order} />)
                ) : (
                  <Text style={styles.muted}>No purchases have been recorded for this customer.</Text>
                )}
              </ContentCard>
            ) : null}
            {tab === "settings" ? (
              <ContentCard style={styles.card}>
                <Text style={styles.sectionTitle}>Update customer information</Text>
                <NativeFormField label="Name (optional)" onChangeText={setName} placeholder="Customer name" value={name} />
                <NativeFormField autoComplete="tel" keyboardType="phone-pad" label="Phone number" onChangeText={setPhone} placeholder="Phone number" value={phone} />
                <NativeFormField autoCapitalize="none" keyboardType="email-address" label="Email (optional)" onChangeText={setEmail} placeholder="name@example.com" value={email} />
                <NativeFormField label="Address (optional)" onChangeText={setAddress} placeholder="Street address" value={address} />
                <View style={styles.actions}>
                  <NativeConfirmButton
                    label="Delete customer"
                    title={`Delete ${customer.name || "this customer"}?`}
                    message="Existing orders will stay saved with this customer name."
                    confirmLabel="Delete customer"
                    onConfirm={removeCustomer}
                  />
                  <NativeButton disabled={saving || !phone.trim()} label={saving ? "Saving…" : "Save changes"} onPress={() => void saveChanges()} />
                  <NativeButton label="Discard changes" onPress={resetForm} variant="text" />
                </View>
              </ContentCard>
            ) : null}
          </>
        ) : (
          <MessageCard title="Customer unavailable" message={error || "This customer could not be found."} tone="error" />
        )}
      </AppScreen>
      <Pressable
        accessibilityLabel="Close"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => router.back()}
        style={[styles.close, { top: insets.top + spacing.sm }]}
      >
        <NativeIcon color={colors.teal} name="close" size={16} />
      </Pressable>
      {customer ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/order/new", params: { customerId: customer.id } })}
          style={({ pressed }) => [styles.newOrder, { bottom: insets.bottom + spacing.md }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.newOrderText}>New order</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PurchaseCard({ order }: { order: OrderRecord }) {
  const total = orderTotal(order);
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.number}, ${formatCurrency(total)}, ${orderStatusLabels[order.status]}. View order details.`}
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: order.id } })}
      style={({ pressed }) => [styles.purchase, pressed && styles.purchasePressed]}
    >
      <View style={styles.purchaseTop}>
        <Text style={styles.orderNumber}>Order {order.number}</Text>
        <Text style={styles.orderTotal}>{formatCurrency(total)}</Text>
      </View>
      <Text style={styles.purchaseMeta}>{formatDate(order.createdAt)} · {orderStatusLabels[order.status]} · {itemCount} item{itemCount === 1 ? "" : "s"}</Text>
      {order.items.slice(0, 3).map((item) => (
        <Text key={item.id} numberOfLines={1} style={styles.purchaseItem}>
          {item.quantity} × {item.name}{item.optionName.toLocaleLowerCase() === "default" ? "" : ` (${item.optionName})`}
        </Text>
      ))}
      {order.items.length > 3 ? <Text style={styles.muted}>+ {order.items.length - 3} more item types</Text> : null}
    </Pressable>
  );
}

function DetailField({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable={selectable} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parchment },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  close: { position: "absolute", right: spacing.lg, zIndex: 2, width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: colors.card },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  heroName: { color: colors.espresso, fontFamily: serifFamily, fontSize: 28, fontWeight: "800", textAlign: "center" },
  newOrder: { position: "absolute", right: spacing.lg, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.orange, paddingHorizontal: spacing.md, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  newOrderText: { color: colors.card, fontSize: 13, fontWeight: "700" },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  field: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  label: { color: colors.mutedText, fontSize: 12 },
  value: { color: colors.espresso, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
  errorText: { color: colors.brick, fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.sm },
  purchase: { gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.md },
  purchasePressed: { opacity: 0.72 },
  purchaseTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  orderNumber: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  orderTotal: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  purchaseMeta: { color: colors.mutedText, fontSize: 12 },
  purchaseItem: { color: colors.espresso, fontSize: 12, lineHeight: 17 },
});
