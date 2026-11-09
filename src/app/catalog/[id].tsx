import { useCallback, useEffect, useState } from "react";
<<<<<<< HEAD
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
=======
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
>>>>>>> 385fd99c4f68ff36c8e733b0b7c2ade06c23a794
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { OptionAddForm } from "@/components/option-add-form";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
<<<<<<< HEAD
import { getProduct, removeProduct, updateProductPricing, type ProductRecord } from "@/lib/workspace";
import type { CatalogPriceOption, ProductDiscountType } from "@/domain/catalog-pricing";
=======
import { addProductOption, getProduct, removeProduct, removeProductOption, type ProductOption, type ProductOptionInput, type ProductRecord } from "@/lib/workspace";
>>>>>>> 385fd99c4f68ff36c8e733b0b7c2ade06c23a794
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
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
    if (discountValue.trim() && (!Number.isFinite(amount) || amount <= 0 || (discountType === "percent" && amount > 100))) {
      setError(discountType === "percent" ? "Enter a discount above 0 and at most 100%." : "Enter a discount amount above $0.");
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
      const discount = discountValue.trim() && amount > 0 ? { type: discountType, value: amount } : null;
      await updateProductPricing(product.id, {
        discount,
        pricingOptions: normalizedOptions,
      });
      setProduct({ ...product, discount, pricingOptions: normalizedOptions });
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
          <ContentCard style={styles.card}>
            <Text style={styles.label}>Current price</Text>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            <Text style={styles.description}>This is the price used for new order items, including options without their own price. Existing orders keep their saved price.</Text>
          </ContentCard>
          <ContentCard style={styles.card}>
            <Text style={styles.label}>Options</Text>
            {product.options.length ? product.options.map((option) => (
              <View key={option.id} style={styles.optionRow}>
                <Text numberOfLines={2} style={styles.optionName}>{option.name}</Text>
                <Text style={styles.muted}>{formatCurrency(option.price ?? product.price)}</Text>
                <Pressable accessibilityLabel={`Remove option ${option.name}`} accessibilityRole="button" hitSlop={8} onPress={() => confirmRemoveOption(option)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            )) : <Text style={styles.description}>No options. Orders list this item by its name only.</Text>}
            <OptionAddForm existingNames={product.options.map((option) => option.name)} onAdd={handleAddOption} />
          </ContentCard>
          <ContentCard style={styles.card}>
            <Text style={styles.sectionTitle}>Item discount</Text>
            <Text style={styles.description}>Applies to this item and its pack prices on new orders.</Text>
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
            <NativeFormField keyboardType="decimal-pad" label={discountType === "percent" ? "Item discount percent" : "Item discount amount"} onChangeText={setDiscountValue} placeholder={discountType === "percent" ? "10" : "1.00"} value={discountValue} />
            {discountValue ? <NativeButton label="Remove item discount" onPress={() => setDiscountValue("")} variant="text" /> : null}
          </ContentCard>
          <ContentCard style={styles.card}>
            <Text style={styles.sectionTitle}>Pack and size prices</Text>
            <Text style={styles.description}>Optional fixed price choices such as half dozen or dozen. Orders count each choice as one pack.</Text>
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
            <NativeButton disabled={savingPricing} label={savingPricing ? "Saving pricing…" : "Save pricing"} onPress={() => void savePricing()} />
          </ContentCard>
          <NativeButton disabled={removing} label={removing ? "Removing…" : "Remove from catalog"} onPress={confirmRemove} variant="outlined" />
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md },
  label: { color: colors.mutedText, fontSize: 12 },
  price: { color: colors.espresso, fontSize: 28, fontWeight: "700" },
  description: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
<<<<<<< HEAD
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
=======
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  optionName: { flex: 1, color: colors.espresso, fontSize: 14, fontWeight: "600" },
  removeText: { color: colors.brick, fontSize: 13, fontWeight: "700" },
>>>>>>> 385fd99c4f68ff36c8e733b0b7c2ade06c23a794
  muted: { color: colors.mutedText, fontSize: 12 },
});
