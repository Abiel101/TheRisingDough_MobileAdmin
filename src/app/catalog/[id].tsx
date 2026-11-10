import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { OptionAddForm } from "@/components/option-add-form";
import { NativeButton } from "@/components/ui/native-button";
import { NativeDatePickerField } from "@/components/ui/native-date-picker-field";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addProductOption, getProduct, removeProduct, removeProductOption, updateProductPricing, type ProductOption, type ProductOptionInput, type ProductRecord } from "@/lib/workspace";
import type { CatalogPriceOption, ProductDiscountType } from "@/domain/catalog-pricing";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function dateKeyAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKeyAfter(0);
}

type PricingOptionDraft = CatalogPriceOption & { packSizeInput: string; priceInput: string };

export default function CatalogItemDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useAuth();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [discountType, setDiscountType] = useState<ProductDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountEndDate, setDiscountEndDate] = useState("");
  const [pricingOptions, setPricingOptions] = useState<PricingOptionDraft[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("This item link is missing its item ID.");
      setLoading(false);
      return;
    }
    try {
      const result = await getProduct(id);
      setProduct(result);
      if (result) {
        setDiscountType(result.discount?.type ?? "percent");
        setDiscountValue(result.discount?.value ? String(result.discount.value) : "");
        setDiscountEnabled(Boolean(result.discount));
        setDiscountEndDate(result.discount ? result.discount.endsOn ?? dateKeyAfter(7) : "");
        setPricingOptions(result.pricingOptions.map((option) => ({
          ...option,
          packSizeInput: String(option.packSize),
          priceInput: (option.priceCents / 100).toFixed(2),
        })));
      }
      setError(result ? "" : "This catalog item could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this catalog item.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function confirmRemove() {
    if (!product) return;
    Alert.alert(
      "Remove catalog item?",
      `“${product.name}” will be removed from the current catalog. Saved order item details remain intact.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void handleRemove() },
      ],
    );
  }

  async function handleAddOption(input: ProductOptionInput) {
    if (!product || !session?.user.id) return;
    const option = await addProductOption(session.user.id, product.id, input, product.options.length);
    setProduct((current) => (current ? { ...current, options: [...current.options, option] } : current));
  }

  function confirmRemoveOption(option: ProductOption) {
    Alert.alert(
      "Remove option?",
      `“${option.name}” will no longer be offered on new orders. Existing orders keep it.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => void handleRemoveOption(option) },
      ],
    );
  }

  async function handleRemoveOption(option: ProductOption) {
    setError("");
    try {
      await removeProductOption(option.id);
      setProduct((current) => (current ? { ...current, options: current.options.filter((item) => item.id !== option.id) } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this option.");
    }
  }

  async function handleRemove() {
    if (!product) return;
    setRemoving(true);
    setError("");
    try {
      await removeProduct(product.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this item.");
      setRemoving(false);
    }
  }

  function addPricingOption() {
    setPricingOptions((current) => [...current, {
      id: `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: "Half dozen",
      packSize: 6,
      priceCents: 0,
      packSizeInput: "6",
      priceInput: "0.00",
    }]);
  }

  async function savePricing() {
    if (!product) return;
    const amount = Number(discountValue);
    if (discountEnabled && (!discountValue.trim() || !Number.isFinite(amount) || amount <= 0 || (discountType === "percent" && amount > 100))) {
      setError(discountType === "percent" ? "Enter a discount above 0 and at most 100%." : "Enter a discount amount above $0.");
      return;
    }
    if (discountEnabled && (!discountEndDate || discountEndDate < todayKey())) {
      setError("Choose an end date that is today or later.");
      return;
    }
    const normalizedOptions = pricingOptions.map((option) => ({
      id: option.id,
      label: option.label.trim(),
      packSize: Number.parseInt(option.packSizeInput, 10),
      priceCents: Math.round(Number(option.priceInput) * 100),
    }));
    if (normalizedOptions.some((option) => !option.label || !Number.isInteger(option.packSize) || option.packSize < 1 || !Number.isInteger(option.priceCents) || !Number.isFinite(option.priceCents) || option.priceCents < 0)) {
      setError("Each pack option needs a label, a piece count, and a valid price.");
      return;
    }
    setSavingPricing(true);
    setError("");
    try {
      const discount = discountEnabled ? { type: discountType, value: amount, endsOn: discountEndDate } : null;
      await updateProductPricing(product.id, {
        discount,
        pricingOptions: normalizedOptions,
      });
      setProduct({ ...product, discount, pricingOptions: normalizedOptions });
      setDiscountEnabled(Boolean(discount));
      setPricingOptions(normalizedOptions.map((option) => ({
        ...option,
        packSizeInput: String(option.packSize),
        priceInput: (option.priceCents / 100).toFixed(2),
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save item pricing.");
    } finally {
      setSavingPricing(false);
    }
  }

  return (
    <AppScreen header={<SheetHeader title={product?.name || "Item details"} subtitle="Catalog item information." />}>
      {error ? <MessageCard title="Catalog item" message={error} tone="error" /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading item…</Text></View>
      ) : product ? (
        <>
          <ContentCard style={[styles.card, styles.optionsCard]}>
            <Text style={styles.sectionTitle}>Options and prices</Text>
            <Text style={styles.description}>Each option has its own single-item price. Keep at least one option for every item.</Text>
            {product.options.length ? product.options.map((option) => (
              <View key={option.id} style={styles.optionRow}>
                <Text numberOfLines={2} style={styles.optionName}>{option.name}</Text>
                <Text style={styles.muted}>{formatCurrency(option.price ?? product.price)}</Text>
                <Pressable accessibilityLabel={`Remove option ${option.name}`} accessibilityRole="button" disabled={product.options.length < 2} hitSlop={8} onPress={() => confirmRemoveOption(option)} style={product.options.length < 2 && styles.disabledAction}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            )) : <Text style={styles.description}>No saved options yet. Add a priced option to keep this item available on new orders.</Text>}
            <OptionAddForm existingNames={product.options.map((option) => option.name)} onAdd={handleAddOption} />
          </ContentCard>
          <ContentCard style={[styles.card, styles.discountCard]}>
            <Text style={styles.sectionTitle}>Temporary discount</Text>
            <Text style={styles.description}>Discounts apply to new orders through the selected end date. Existing orders keep their saved prices.</Text>
            {!discountEnabled ? (
              <NativeButton
                label="Add temporary discount"
                onPress={() => {
                  setDiscountEnabled(true);
                  setDiscountEndDate(dateKeyAfter(7));
                }}
                variant="outlined"
              />
            ) : (
              <>
                <View style={styles.typeRow}>
                  {(["percent", "amount"] as const).map((type) => {
                    const selected = discountType === type;
                    return (
                      <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDiscountType(type)} style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type === "percent" ? "Percent (%)" : "Amount ($)"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <NativeFormField keyboardType="decimal-pad" label={discountType === "percent" ? "Discount percent" : "Discount amount (USD)"} onChangeText={setDiscountValue} placeholder={discountType === "percent" ? "10" : "1.00"} value={discountValue} />
                <NativeDatePickerField label="Discount ends on" value={discountEndDate || dateKeyAfter(7)} onChange={setDiscountEndDate} />
                <NativeButton label="Remove temporary discount" onPress={() => { setDiscountEnabled(false); setDiscountValue(""); setDiscountEndDate(""); }} variant="text" />
              </>
            )}
          </ContentCard>
          <ContentCard style={[styles.card, styles.packCard]}>
            <Text style={styles.sectionTitle}>Pack and size prices</Text>
            <Text style={styles.description}>Set separate prices for half dozen, dozen, or other pack sizes. These are separate from single-item options and discounts.</Text>
            {pricingOptions.map((option) => (
              <View key={option.id} style={styles.optionCard}>
                <NativeFormField label="Option label" onChangeText={(label) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, label } : entry))} placeholder="Half dozen" value={option.label} />
                <View style={styles.optionNumbers}>
                  <View style={styles.optionField}><NativeFormField keyboardType="number-pad" label="Pieces" onChangeText={(value) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, packSizeInput: value } : entry))} placeholder="6" value={option.packSizeInput} /></View>
                  <View style={styles.optionField}><NativeFormField keyboardType="decimal-pad" label="Pack price ($)" onChangeText={(value) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, priceInput: value } : entry))} placeholder="11.00" value={option.priceInput} /></View>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setPricingOptions((current) => current.filter((entry) => entry.id !== option.id))}><Text style={styles.removeOption}>Remove pack option</Text></Pressable>
              </View>
            ))}
            <NativeButton label="Add pack option" onPress={addPricingOption} variant="outlined" />
          </ContentCard>
          <NativeButton disabled={savingPricing} label={savingPricing ? "Saving…" : "Save discounts and pack prices"} onPress={() => void savePricing()} />
          <NativeButton disabled={removing} label={removing ? "Removing…" : "Remove from catalog"} onPress={confirmRemove} variant="outlined" />
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md },
  optionsCard: { backgroundColor: "#EEF7F5", borderColor: "#C9DFDA" },
  discountCard: { backgroundColor: "#FFF1EE", borderColor: "#F0C9C1" },
  packCard: { backgroundColor: "#FFF8E9", borderColor: "#EAD9B5" },
  description: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card },
  chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.teal, fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: colors.card },
  optionCard: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  optionNumbers: { flexDirection: "row", gap: spacing.sm },
  optionField: { flex: 1 },
  removeOption: { alignSelf: "flex-start", color: colors.brick, fontSize: 13, fontWeight: "700", paddingVertical: spacing.xs },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  optionName: { flex: 1, color: colors.espresso, fontSize: 14, fontWeight: "600" },
  removeText: { color: colors.brick, fontSize: 13, fontWeight: "700" },
  disabledAction: { opacity: 0.4 },
  muted: { color: colors.mutedText, fontSize: 12 },
});
