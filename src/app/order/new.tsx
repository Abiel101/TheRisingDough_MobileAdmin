import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { ItemPicker, lineQuantityKey, selectedItemsFromQuantities, type QuantityMap } from "@/components/item-picker";
import { NativeButton } from "@/components/ui/native-button";
import { SearchField } from "@/components/ui/design";
import { NativeDatePickerField } from "@/components/ui/native-date-picker-field";
import { NativeFormField, NativeMultilineFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { allocateLineTotals, calculateOrderTotals, hasOptionLabel, matchRequestedItem, type DiscountType } from "@/domain/orders";
import { addCustomer, createOrder, listCustomers, listProducts, markHolidayRequestConverted, optionUnitPrice, type CustomerRecord, type ProductRecord } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function localTodayKey() {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

type RequestedItem = { productName: string; optionName?: string; sourceName?: string; quantity: number };

function parseRequestedItems(value?: string): RequestedItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const requested = item as { productName?: unknown; optionName?: unknown; sourceName?: unknown; quantity?: unknown };
      if (typeof requested.productName !== "string" || !Number.isInteger(Number(requested.quantity))) return [];
      return [{
        productName: requested.productName,
        optionName: typeof requested.optionName === "string" ? requested.optionName : undefined,
        sourceName: typeof requested.sourceName === "string" ? requested.sourceName : undefined,
        quantity: Math.max(0, Number(requested.quantity)),
      }];
    });
  } catch {
    return [];
  }
}

export default function NewOrderScreen() {
  const { session } = useAuth();
  const {
    customerId: presetCustomerId,
    requestId,
    customerName: requestCustomerName,
    customerPhone: requestCustomerPhone,
    customerEmail: requestCustomerEmail,
    dueDate: requestDueDate,
    requestNotes,
    requestItems,
  } = useLocalSearchParams<{
    customerId?: string;
    requestId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    dueDate?: string;
    requestNotes?: string;
    requestItems?: string;
  }>();
  const requestPrefilled = useRef(false);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(presetCustomerId ?? "");
  const [showNewCustomer, setShowNewCustomer] = useState(Boolean(requestId));
  const [newCustomerName, setNewCustomerName] = useState(requestCustomerName ?? "");
  const [newCustomerPhone, setNewCustomerPhone] = useState(requestCustomerPhone ?? "");
  const [newCustomerEmail, setNewCustomerEmail] = useState(requestCustomerEmail ?? "");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [dueDate, setDueDate] = useState(requestDueDate || localTodayKey());
  const [notes, setNotes] = useState(requestNotes ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [unmatchedItems, setUnmatchedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextCustomers, nextProducts] = await Promise.all([listCustomers(), listProducts()]);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      if (!requestPrefilled.current) {
        if (presetCustomerId) {
          setSelectedCustomerId(presetCustomerId);
        } else if (requestId) {
          const phoneDigits = (requestCustomerPhone ?? "").replace(/\D/g, "");
          const emailKey = (requestCustomerEmail ?? "").trim().toLocaleLowerCase();
          const existing = nextCustomers.find((customer) =>
            (phoneDigits && customer.phone.replace(/\D/g, "") === phoneDigits)
            || (emailKey && customer.email.trim().toLocaleLowerCase() === emailKey),
          );
          if (existing) {
            setSelectedCustomerId(existing.id);
            setShowNewCustomer(false);
          } else {
            setNewCustomerName(requestCustomerName ?? "");
            setNewCustomerPhone(requestCustomerPhone ?? "");
            setNewCustomerEmail(requestCustomerEmail ?? "");
            setShowNewCustomer(true);
          }
          if (requestDueDate) setDueDate(requestDueDate);
          setNotes(requestNotes ?? "");
          const requestedItems = parseRequestedItems(requestItems);
          if (requestedItems.length) {
            const matchedQuantities: QuantityMap = {};
            const unmatched: string[] = [];
            for (const requested of requestedItems) {
              if (requested.quantity < 1) continue;
              const match = matchRequestedItem(nextProducts, requested);
              if (!match) {
                const option = hasOptionLabel(requested.optionName) ? ` (${requested.optionName})` : "";
                unmatched.push(`${requested.quantity} × ${requested.productName}${option}`);
                continue;
              }
              const key = lineQuantityKey(match.product.id, match.option?.id);
              matchedQuantities[key] = (matchedQuantities[key] ?? 0) + requested.quantity;
            }
            setQuantities(matchedQuantities);
            setUnmatchedItems(unmatched);
          }
        }
        requestPrefilled.current = true;
      }
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customers and catalog items.");
    } finally {
      setLoading(false);
    }
  }, [presetCustomerId, requestCustomerEmail, requestCustomerName, requestCustomerPhone, requestDueDate, requestId, requestItems, requestNotes]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const activeCustomerId = selectedCustomerId;
  const selectedCustomer = customers.find((customer) => customer.id === activeCustomerId);
  const query = customerQuery.trim().toLocaleLowerCase();
  const matches = useMemo(() => query.length < 1 ? [] : customers.filter((customer) =>
    [customer.name, customer.phone, customer.email].some((value) => value.toLocaleLowerCase().includes(query)),
  ).slice(0, 6), [customers, query]);
  const selectedItems = selectedItemsFromQuantities(products, quantities);

  const discountValue = Math.round((Number(discountInput.replace(/[^0-9.]/g, "")) || 0) * 100) / 100;
  const lineItems = selectedItems.map(({ product, option, quantity }) => ({
    productId: product.id,
    productName: product.name,
    optionName: option?.name,
    unitPrice: optionUnitPrice(product, option),
    quantity,
  }));
  const discount = discountValue > 0 ? { type: discountType, value: discountValue } : null;
  const { subtotal, discountAmount, total } = calculateOrderTotals(lineItems, discount);
  const discountedLineTotals = allocateLineTotals(lineItems, discountAmount);
  const discountedTotalByLine = new Map(selectedItems.map(({ product, option }, index) => [lineQuantityKey(product.id, option?.id), discountedLineTotals[index]]));
  const discountError =
    discountType === "percent" && discountValue > 100
      ? "A percentage discount can’t be more than 100%."
      : discountType === "amount" && discountValue > subtotal
        ? "A discount can’t be more than the order subtotal."
        : "";
  const canCreate = !saving && !!selectedCustomer && selectedItems.length > 0 && !discountError;

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
      const id = await createOrder({ ownerId: session.user.id, customer: selectedCustomer, dueDate, notes, items: selectedItems, discount });
      if (requestId) {
        try {
          await markHolidayRequestConverted(requestId, id);
        } catch {
          Alert.alert(
            "Order created",
            "The order is ready, but the original request could not be marked as started. You can still review the order and send its approval link.",
            [{ text: "Open order", onPress: () => router.replace({ pathname: "/order/[id]", params: { id } }) }],
          );
          return;
        }
      }
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
        {unmatchedItems.length ? (
          <View style={styles.unmatched}>
            <Text style={styles.unmatchedTitle}>Not matched to your catalog</Text>
            {unmatchedItems.map((label) => <Text key={label} style={styles.hint}>{label}</Text>)}
            <Text style={styles.hint}>Add the item or option in Catalog, or choose a similar one below.</Text>
          </View>
        ) : null}
        <ItemPicker
          discountedTotals={discountedTotalByLine}
          disabled={saving}
          onChange={(key, quantity) => setQuantities((current) => ({ ...current, [key]: quantity }))}
          products={products}
          quantities={quantities}
        />
        <NativeMultilineFormField label="Notes (optional)" onChangeText={setNotes} placeholder="Order details" value={notes} />
      </ContentCard>
      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Discount (optional)</Text>
        <View style={styles.chipRow}>
          {(["percent", "amount"] as const).map((type) => {
            const selected = discountType === type;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={type}
                onPress={() => setDiscountType(type)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {type === "percent" ? "Percent (%)" : "Amount ($)"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <NativeFormField
          keyboardType="decimal-pad"
          label={discountType === "percent" ? "Discount percent" : "Discount amount"}
          onChangeText={setDiscountInput}
          placeholder={discountType === "percent" ? "10" : "5.00"}
          value={discountInput}
        />
        {discountError ? <Text style={styles.errorText}>{discountError}</Text> : null}
      </ContentCard>
    </AppScreen>
    <View style={styles.footer}>
      <View>
        <Text style={styles.totalLabel}>{discountAmount > 0 ? `Total · ${formatCurrency(discountAmount)} off` : "Total"}</Text>
        <View style={styles.priceRow}>
          {discountAmount > 0 ? <Text style={styles.struckBig}>{formatCurrency(subtotal)}</Text> : null}
          <Text style={[styles.totalValue, discountAmount > 0 && { color: colors.sale }]}>{formatCurrency(total)}</Text>
        </View>
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
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  struckBig: { color: colors.mutedText, fontSize: 15, textDecorationLine: "line-through" },
  unmatched: { gap: 3, borderRadius: 12, backgroundColor: "#F3E3B3", padding: spacing.md },
  unmatchedTitle: { color: "#6B4E0A", fontSize: 13, fontWeight: "700" },
  errorText: { color: colors.brick, fontSize: 12 },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card },
  chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.teal, fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: colors.card },
});
