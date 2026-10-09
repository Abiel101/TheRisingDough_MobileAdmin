import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { NativeButton } from "@/components/ui/native-button";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getProduct, removeProduct, type ProductRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export default function CatalogItemDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
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
    <AppScreen>
      <SheetHeader title={product?.name || "Item details"} subtitle="Catalog item information." />
      {error ? <MessageCard title="Catalog item" message={error} tone="error" /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading item…</Text></View>
      ) : product ? (
        <>
          <ContentCard style={styles.card}>
            <Text style={styles.label}>Current price</Text>
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
            <Text style={styles.description}>This is the price used for new order items. Existing orders keep their saved price.</Text>
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
  muted: { color: colors.mutedText, fontSize: 12 },
});
