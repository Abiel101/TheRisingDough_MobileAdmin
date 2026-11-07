import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { OptionAddForm } from "@/components/option-add-form";
import { NativeButton } from "@/components/ui/native-button";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addProductOption, getProduct, removeProduct, removeProductOption, type ProductOption, type ProductOptionInput, type ProductRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export default function CatalogItemDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useAuth();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
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
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  optionName: { flex: 1, color: colors.espresso, fontSize: 14, fontWeight: "600" },
  removeText: { color: colors.brick, fontSize: 13, fontWeight: "700" },
  muted: { color: colors.mutedText, fontSize: 12 },
});
