import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { SearchField } from "@/components/ui/design";
import { NativeDatePickerField } from "@/components/ui/native-date-picker-field";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addCustomer, createOrder, listCustomers, listProducts, type CustomerRecord, type ProductRecord } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function localTodayKey() {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default function NewOrderScreen() {
  const { session } = useAuth();
  const { customerId: presetCustomerId } = useLocalSearchParams<{ customerId?: string }>();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(presetCustomerId ?? "");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [dueDate, setDueDate] = useState(localTodayKey);
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextCustomers, nextProducts] = await Promise.all([listCustomers(), listProducts()]);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customers and catalog items.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const activeCustomerId = selectedCustomerId;
  const selectedCustomer = customers.find((customer) => customer.id === activeCustomerId);
  const query = customerQuery.trim().toLocaleLowerCase();
  const matches = useMemo(() => query.length < 1 ? [] : customers.filter((customer) =>
    [customer.name, customer.phone, customer.email].some((value) => value.toLocaleLowerCase().includes(query)),
  ).slice(0, 6), [customers, query]);
  const selectedItems = products.flatMap((product) => {
    const quantity = quantities[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  });

  const total = selectedItems.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const canCreate = !saving && !!selectedCustomer && selectedItems.length > 0;

  async function saveCustomer() {
    if (!session?.user.id) return;
    if (!newCustomerPhone.trim()) {
      setError("A phone number is required to add a customer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customer = await addCustomer(session.user.id, {
        name: newCustomerName,
        phone: newCustomerPhone,
        email: newCustomerEmail,
        address: newCustomerAddress,
      });
      setCustomers((current) => [...current, customer].sort((first, second) => first.name.localeCompare(second.name)));
      setSelectedCustomerId(customer.id);
      setCustomerQuery("");
      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this customer.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOrder() {
    if (!session?.user.id || !selectedCustomer || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !selectedItems.length) return;
    setSaving(true);
    setError("");
    try {
      const id = await createOrder({ ownerId: session.user.id, customer: selectedCustomer, dueDate, notes, items: selectedItems });
      router.replace({ pathname: "/order/[id]", params: { id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create this order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title="New order" subtitle="Choose a customer, due date, and items." />} keyboardShouldPersistTaps="handled">
      {error ? <MessageCard title="Order form" message={error} tone="error" /> : null}
      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        {selectedCustomer ? (
          <View style={styles.selectedCustomer}>
            <View style={styles.customerCopy}>
              <Text style={styles.customerName}>{selectedCustomer.name || selectedCustomer.phone}</Text>
              <Text style={styles.hint}>{selectedCustomer.phone}</Text>
            </View>
            <Pressable onPress={() => { setSelectedCustomerId(""); setCustomerQuery(""); }}><Text style={styles.changeText}>Change</Text></Pressable>
          </View>
        ) : (
          <>
            <SearchField accessibilityLabel="Search customers" onChangeText={setCustomerQuery} placeholder="Search customers" value={customerQuery} />
            {query.length >= 1 ? matches.map((customer) => (
              <Pressable key={customer.id} onPress={() => { setSelectedCustomerId(customer.id); setCustomerQuery(""); }} style={styles.customerResult}>
                <Text style={styles.customerName}>{customer.name || customer.phone}</Text>
                <Text style={styles.hint}>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</Text>
              </Pressable>
            )) : <Text style={styles.hint}>{loading ? "Loading saved customers…" : "Start typing to find a saved customer."}</Text>}
            {query.length >= 1 && matches.length === 0 ? <Text style={styles.hint}>No saved customer matches “{customerQuery.trim()}”.</Text> : null}
            <NativeButton label={showNewCustomer ? "Close new customer form" : "Add a new customer"} onPress={() => { setShowNewCustomer((shown) => !shown); setError(""); setNewCustomerName(customerQuery.trim()); }} variant="outlined" />
          </>
        )}
        {showNewCustomer ? (
          <View style={styles.newCustomerForm}>
            <Text style={styles.sectionTitle}>New customer</Text>
            <NativeFormField label="Name (optional)" onChangeText={setNewCustomerName} placeholder="Customer name" value={newCustomerName} />
            <NativeFormField autoComplete="tel" keyboardType="phone-pad" label="Phone number" onChangeText={setNewCustomerPhone} placeholder="Phone number" value={newCustomerPhone} />
            <NativeFormField autoCapitalize="none" keyboardType="email-address" label="Email (optional)" onChangeText={setNewCustomerEmail} placeholder="name@example.com" value={newCustomerEmail} />
            <NativeFormField label="Address (optional)" onChangeText={setNewCustomerAddress} placeholder="Street address" value={newCustomerAddress} />
            <NativeButton disabled={saving || !newCustomerPhone.trim()} label={saving ? "Saving customer…" : "Save and select customer"} onPress={() => void saveCustomer()} />
          </View>
        ) : null}
      </ContentCard>

      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Due date</Text>
        <NativeDatePickerField label="Pickup date" value={dueDate} onChange={setDueDate} />
      </ContentCard>

      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        {loading && !products.length ? <Text style={styles.hint}>Loading catalog…</Text> : null}
        {!loading && !products.length ? <Text style={styles.hint}>Add products in Catalog before creating an order.</Text> : null}
        {products.map((product) => {
          const quantity = quantities[product.id] ?? 0;
          return (
            <View key={product.id} style={styles.productRow}>
              <View style={styles.customerCopy}><Text style={styles.customerName}>{product.name}</Text><Text style={styles.hint}>${product.price.toFixed(2)}</Text></View>
              <Pressable accessibilityLabel={`Remove one ${product.name}`} disabled={!quantity || saving} onPress={() => setQuantities((current) => ({ ...current, [product.id]: Math.max((current[product.id] ?? 0) - 1, 0) }))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>−</Text></Pressable>
              <Text style={styles.quantityText}>{quantity}</Text>
              <Pressable accessibilityLabel={`Add one ${product.name}`} disabled={saving} onPress={() => setQuantities((current) => ({ ...current, [product.id]: (current[product.id] ?? 0) + 1 }))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>+</Text></Pressable>
            </View>
          );
        })}
        <NativeFormField label="Notes (optional)" onChangeText={setNotes} placeholder="Order details" value={notes} />
      </ContentCard>
    </AppScreen>
    <View style={styles.footer}>
      <View>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={!canCreate}
        onPress={() => void saveOrder()}
        style={({ pressed }) => [styles.createButton, !canCreate && styles.createDisabled, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.createText}>{saving ? "Creating…" : "Create order"}</Text>
      </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.parchment },
  screen: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: { gap: spacing.md },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  totalLabel: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },
  totalValue: { color: colors.espresso, fontFamily: serifFamily, fontSize: 26, fontWeight: "800" },
  createButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.orange, paddingHorizontal: spacing.xl },
  createDisabled: { opacity: 0.45 },
  createText: { color: colors.card, fontSize: 16, fontWeight: "700" },
  sectionTitle: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  selectedCustomer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderWidth: 1, borderColor: colors.teal, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.md },
  customerCopy: { flex: 1, gap: 3 },
  customerName: { color: colors.espresso, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  changeText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  customerResult: { gap: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.md },
  newCustomerForm: { gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  productRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.xs },
  quantityButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.parchment },
  quantitySymbol: { color: colors.teal, fontSize: 19, fontWeight: "700" },
  quantityText: { minWidth: 20, color: colors.espresso, textAlign: "center", fontWeight: "700" },
});
