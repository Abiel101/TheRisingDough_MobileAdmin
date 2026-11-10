import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { SearchField } from "@/components/ui/design";
import { NativeDatePickerField } from "@/components/ui/native-date-picker-field";
import { NativeFormField, NativeMultilineFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { calculateOrderTotals, type DiscountType } from "@/domain/orders";
import { catalogChoicePrice, catalogChoices, resolveCatalogRequest } from "@/domain/catalog-choices";
import { findCustomerByPhone } from "@/domain/customers";
import type { RequestedItem } from "@/domain/request-items";
import { addCustomer, createOrder, getCatalogPromotion, listCustomers, listProducts, markHolidayRequestConverted, type CustomerRecord, type ProductRecord } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function localTodayKey() {
  const today = new Date();
  const local = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

type RequestLine = RequestedItem & { optionName?: string; sourceName?: string };
function parseRequestedItems(value?: string): RequestLine[] {
  if (!value) return [] as RequestedItem[];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const requested = item as { productName?: unknown; optionName?: unknown; sourceName?: unknown; quantity?: unknown; unitPrice?: unknown };
      if (typeof requested.productName !== "string" || !Number.isInteger(Number(requested.quantity))) return [];
      return [{
        productName: requested.productName,
        optionName: typeof requested.optionName === "string" ? requested.optionName : undefined,
        sourceName: typeof requested.sourceName === "string" ? requested.sourceName : undefined,
        quantity: Math.max(0, Number(requested.quantity)),
        unitPrice: Number(requested.unitPrice) || undefined,
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
  const [promotion, setPromotion] = useState({ name: "Holiday promotion", isActive: false, discountPercent: 0, stackOnProductDiscount: false });
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState(presetCustomerId ?? "");
  const [createdCustomerId, setCreatedCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(Boolean(requestId));
  const [newCustomerName, setNewCustomerName] = useState(requestCustomerName ?? "");
  const [newCustomerPhone, setNewCustomerPhone] = useState(requestCustomerPhone ?? "");
  const [newCustomerEmail, setNewCustomerEmail] = useState(requestCustomerEmail ?? "");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [dueDate, setDueDate] = useState(requestDueDate || localTodayKey());
  const [notes, setNotes] = useState(requestNotes ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unmatchedRequestItems, setUnmatchedRequestItems] = useState<string[]>([]);
  const [itemQuery, setItemQuery] = useState("");
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedChoiceKey, setPickedChoiceKey] = useState("");
  const [pickedQuantity, setPickedQuantity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextCustomers, nextProducts, nextPromotion] = await Promise.all([listCustomers(), listProducts(), getCatalogPromotion()]);
      setCustomers(nextCustomers);
      setProducts(nextProducts);
      setPromotion(nextPromotion);
      if (!requestPrefilled.current) {
        if (presetCustomerId) {
          setSelectedCustomerId(presetCustomerId);
        } else if (requestId) {
          const existing = findCustomerByPhone(nextCustomers, requestCustomerPhone ?? "");
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
            const matchedQuantities: Record<string, number> = {};
            const unmatched: string[] = [];
            for (const requested of requestedItems) {
              if (requested.quantity < 1) continue;
              const resolved = resolveCatalogRequest(nextProducts, requested);
              if (!resolved) {
                unmatched.push(`${requested.quantity} × ${requested.productName}${requested.optionName && requested.optionName !== "Default" ? ` (${requested.optionName})` : ""}`);
                continue;
              }
              matchedQuantities[resolved.key] = (matchedQuantities[resolved.key] ?? 0) + resolved.quantity;
            }
            setQuantities(matchedQuantities);
            setUnmatchedRequestItems(unmatched);
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
  const choices = products.flatMap(catalogChoices);
  const phoneMatch = findCustomerByPhone(customers, newCustomerPhone);
  const selectedItems = choices.flatMap((choice) => {
    const quantity = quantities[choice.key] ?? 0;
    if (quantity < 1) return [];
    const unitPrice = catalogChoicePrice(choice, promotion);
    return [{ product: choice.product, option: choice.option, quantity, itemName: choice.itemName, unitPrice, key: choice.key, originalUnitPrice: choice.originalCents / 100, label: choice.label }];
  });

  const itemQueryText = itemQuery.trim().toLocaleLowerCase();
  const itemMatches = useMemo(
    () => (itemQueryText ? products.filter((product) => product.name.toLocaleLowerCase().includes(itemQueryText)).slice(0, 8) : []),
    [itemQueryText, products],
  );
  const pickedProduct = products.find((product) => product.id === pickedProductId);
  const pickedChoices = pickedProduct ? choices.filter((choice) => choice.product.id === pickedProduct.id) : [];
  const pickedChoice = pickedChoices.find((choice) => choice.key === pickedChoiceKey) ?? pickedChoices[0];
  const pickedCount = Math.floor(Number(pickedQuantity.replace(/\D/g, "")) || 0);
  const unitPriceOf = (choice: (typeof choices)[number]) =>
    catalogChoicePrice(choice, promotion);

  function pickProduct(product: ProductRecord) {
    setPickedProductId(product.id);
    setPickedChoiceKey("");
    setPickedQuantity("1");
  }

  function addPickedItem() {
    if (!pickedChoice || pickedCount < 1) return;
    setQuantities((current) => ({ ...current, [pickedChoice.key]: (current[pickedChoice.key] ?? 0) + pickedCount }));
    setPickedProductId("");
    setPickedChoiceKey("");
    setPickedQuantity("1");
    setItemQuery("");
  }

  const discountValue = Math.round((Number(discountInput.replace(/[^0-9.]/g, "")) || 0) * 100) / 100;
  const lineItems = selectedItems.map(({ product, quantity, unitPrice, key, itemName }) => ({
    productId: key,
    productName: itemName,
    unitPrice,
    quantity,
  }));
  const discount = discountValue > 0 ? { type: discountType, value: discountValue } : null;
  const { subtotal, discountAmount, total } = calculateOrderTotals(lineItems, discount);
  const discountError =
    discountType === "percent" && discountValue > 100
      ? "A percentage discount can’t be more than 100%."
      : discountType === "amount" && discountValue > subtotal
        ? "A discount can’t be more than the order subtotal."
        : "";
  const canCreate = !saving && (!!selectedCustomer || (showNewCustomer && !!newCustomerPhone.trim())) && selectedItems.length > 0 && !discountError;

  // A saved customer with the same phone number is a returning customer, so reuse their profile.
  async function resolveCustomer(): Promise<{ customer: CustomerRecord; isNew: boolean } | null> {
    if (selectedCustomer) return { customer: selectedCustomer, isNew: selectedCustomer.id === createdCustomerId };
    if (!session?.user.id || !newCustomerPhone.trim()) return null;
    const returning = findCustomerByPhone(customers, newCustomerPhone);
    if (returning) return { customer: returning, isNew: false };
    const customer = await addCustomer(session.user.id, {
      name: newCustomerName,
      phone: newCustomerPhone,
      email: newCustomerEmail,
      address: newCustomerAddress,
    });
    setCustomers((current) => [...current, customer].sort((first, second) => first.name.localeCompare(second.name)));
    return { customer, isNew: true };
  }

  function selectReturningCustomer(customer: CustomerRecord) {
    setSelectedCustomerId(customer.id);
    setCustomerQuery("");
    setShowNewCustomer(false);
    setError("");
  }

  async function saveCustomer() {
    if (!session?.user.id) return;
    if (!newCustomerPhone.trim()) {
      setError("A phone number is required to add a customer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const resolved = await resolveCustomer();
      if (!resolved) return;
      setSelectedCustomerId(resolved.customer.id);
      setCreatedCustomerId(resolved.isNew ? resolved.customer.id : "");
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
    if (!session?.user.id || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !selectedItems.length) return;
    setSaving(true);
    setError("");
    try {
      const resolved = await resolveCustomer();
      if (!resolved) return;
      setSelectedCustomerId(resolved.customer.id);
      const id = await createOrder({ ownerId: session.user.id, customer: resolved.customer, dueDate, notes, items: selectedItems, discount });
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
              <Text style={[styles.customerBadge, selectedCustomer.id === createdCustomerId && styles.customerBadgeNew]}>
                {selectedCustomer.id === createdCustomerId ? "New customer" : "Returning customer"}
              </Text>
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
            {phoneMatch ? (
              <View style={[styles.matchBox, styles.matchBoxReturning]}>
                <Text style={styles.matchTitle}>Returning customer</Text>
                <Text style={styles.hint}>{phoneMatch.name || phoneMatch.phone} is already saved with this number. Their profile will be used.</Text>
                <NativeButton label="Use their profile" onPress={() => selectReturningCustomer(phoneMatch)} />
              </View>
            ) : newCustomerPhone.trim() ? (
              <View style={styles.matchBox}>
                <Text style={styles.matchTitle}>New customer</Text>
                <Text style={styles.hint}>This number isn’t saved yet. A profile is created when you create the order.</Text>
              </View>
            ) : null}
            <NativeFormField autoCapitalize="none" keyboardType="email-address" label="Email (optional)" onChangeText={setNewCustomerEmail} placeholder="name@example.com" value={newCustomerEmail} />
            <NativeFormField label="Address (optional)" onChangeText={setNewCustomerAddress} placeholder="Street address" value={newCustomerAddress} />
            <NativeButton disabled={saving || !newCustomerPhone.trim()} label={saving ? "Saving customer…" : phoneMatch ? "Use returning customer" : "Save as new customer"} onPress={() => void saveCustomer()} />
          </View>
        ) : null}
      </ContentCard>

      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Due date</Text>
        <NativeDatePickerField label="Pickup date" value={dueDate} onChange={setDueDate} />
      </ContentCard>

      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Add items</Text>
        {loading && !products.length ? <Text style={styles.hint}>Loading catalog…</Text> : null}
        {!loading && !products.length ? <Text style={styles.hint}>Add products in Catalog before creating an order.</Text> : null}
        {promotion.isActive && promotion.discountPercent > 0 ? (
          <Text style={styles.promoHint}>{promotion.name} · {promotion.discountPercent}% applied to eligible items</Text>
        ) : null}
        {unmatchedRequestItems.length ? (
          <MessageCard
            title="Add these requested items manually"
            message={`No matching catalog item or option was found for: ${unmatchedRequestItems.join(", ")}.`}
            tone="error"
          />
        ) : null}
        {pickedProduct && pickedChoice ? (
          <View style={styles.pickPanel}>
            <View style={styles.pickHeader}>
              <Text style={styles.pickTitle}>{pickedProduct.name}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setPickedProductId(""); setPickedChoiceKey(""); }}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            </View>
            {pickedChoices.length > 1 ? (
              <View style={styles.chipRow}>
                {pickedChoices.map((choice) => {
                  const selected = choice.key === pickedChoice.key;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={choice.key}
                      onPress={() => setPickedChoiceKey(choice.key)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{choice.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.priceRow}>
              {unitPriceOf(pickedChoice) < pickedChoice.originalCents / 100 ? <Text style={styles.struck}>{formatCurrency(pickedChoice.originalCents / 100)}</Text> : null}
              <Text style={[styles.pickPrice, unitPriceOf(pickedChoice) < pickedChoice.originalCents / 100 && styles.sale]}>
                {formatCurrency(unitPriceOf(pickedChoice))} each
              </Text>
            </View>
            <View style={styles.pickControls}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <View style={styles.stepper}>
                <Pressable accessibilityLabel="One fewer" disabled={pickedCount <= 1} onPress={() => setPickedQuantity(String(Math.max(pickedCount - 1, 1)))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>−</Text></Pressable>
                <TextInput
                  accessibilityLabel="Quantity"
                  keyboardType="number-pad"
                  onChangeText={(text) => setPickedQuantity(text.replace(/\D/g, "").slice(0, 3))}
                  selectTextOnFocus
                  style={styles.quantityInput}
                  value={pickedQuantity}
                />
                <Pressable accessibilityLabel="One more" onPress={() => setPickedQuantity(String(pickedCount + 1))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>+</Text></Pressable>
              </View>
            </View>
            <NativeButton disabled={pickedCount < 1} label={`Add to order · ${formatCurrency(unitPriceOf(pickedChoice) * pickedCount)}`} onPress={addPickedItem} />
          </View>
        ) : (
          <>
            <SearchField accessibilityLabel="Search catalog items" onChangeText={setItemQuery} placeholder="Search items to add" value={itemQuery} />
            {itemMatches.map((product) => (
              <Pressable key={product.id} onPress={() => pickProduct(product)} style={styles.customerResult}>
                <Text style={styles.customerName}>{product.name}</Text>
                <Text style={styles.hint}>
                  {formatCurrency(product.price)}{product.pricingOptions.length ? ` · ${product.pricingOptions.map((option) => option.label).join(" / ")} available` : ""}
                </Text>
              </Pressable>
            ))}
            {itemQueryText && !itemMatches.length && products.length ? <Text style={styles.hint}>No catalog item matches “{itemQuery.trim()}”.</Text> : null}
            {!itemQueryText && products.length ? <Text style={styles.hint}>Type an item name, then choose a size and quantity.</Text> : null}
          </>
        )}
      </ContentCard>

      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Order items{selectedItems.length ? ` (${selectedItems.length})` : ""}</Text>
        {selectedItems.length ? selectedItems.map((line) => (
          <View key={line.key} style={styles.lineRow}>
            <View style={styles.customerCopy}>
              <Text style={styles.customerName}>{line.product.name}</Text>
              <Text style={styles.hint}>{line.label} · {formatCurrency(line.unitPrice)} each</Text>
              <Text style={styles.lineTotal}>{formatCurrency(line.unitPrice * line.quantity)}</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable accessibilityLabel={`Remove one ${line.itemName}`} disabled={saving} onPress={() => setQuantities((current) => ({ ...current, [line.key]: Math.max((current[line.key] ?? 0) - 1, 0) }))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>−</Text></Pressable>
              <Text style={styles.quantityText}>{line.quantity}</Text>
              <Pressable accessibilityLabel={`Add one ${line.itemName}`} disabled={saving} onPress={() => setQuantities((current) => ({ ...current, [line.key]: (current[line.key] ?? 0) + 1 }))} style={styles.quantityButton}><Text style={styles.quantitySymbol}>+</Text></Pressable>
              <Pressable accessibilityLabel={`Remove ${line.itemName} from order`} disabled={saving} onPress={() => setQuantities((current) => ({ ...current, [line.key]: 0 }))} style={styles.removeButton}><Text style={styles.removeText}>✕</Text></Pressable>
            </View>
          </View>
        )) : <Text style={styles.hint}>No items yet. Search above to add the first one.</Text>}
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
  customerBadge: { alignSelf: "flex-start", color: colors.sage, fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  customerBadgeNew: { color: colors.bronze },
  matchBox: { gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment, padding: spacing.md },
  matchBoxReturning: { borderColor: colors.sage, gap: spacing.sm },
  matchTitle: { color: colors.espresso, fontSize: 13, fontWeight: "800" },
  newCustomerForm: { gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  lineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  lineTotal: { color: colors.teal, fontSize: 14, fontWeight: "800" },
  pickPanel: { gap: spacing.md, borderWidth: 1.5, borderColor: colors.teal, borderRadius: 14, backgroundColor: colors.parchment, padding: spacing.md },
  pickHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  pickTitle: { flex: 1, color: colors.espresso, fontSize: 17, fontWeight: "700" },
  pickPrice: { color: colors.espresso, fontSize: 14, fontWeight: "600" },
  pickControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fieldLabel: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  quantityInput: { minWidth: 56, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, color: colors.espresso, fontSize: 18, fontWeight: "700", textAlign: "center" },
  removeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  removeText: { color: colors.brick, fontSize: 15, fontWeight: "800" },
  promoHint: { color: colors.sale, fontSize: 12, fontWeight: "700" },
  quantityButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  quantitySymbol: { color: colors.teal, fontSize: 19, fontWeight: "700" },
  quantityText: { minWidth: 20, color: colors.espresso, textAlign: "center", fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  struck: { color: colors.mutedText, fontSize: 12, textDecorationLine: "line-through" },
  sale: { color: colors.sale, fontWeight: "700" },
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
