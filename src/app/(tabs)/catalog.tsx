import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeButton } from "@/components/ui/native-button";
import { FormField, MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { listProducts, type ProductRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export default function CatalogScreen() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const nextProducts = await listProducts();
      setProducts(nextProducts);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(load);
    }, [load]),
  );

  const query = search.trim().toLocaleLowerCase();
  const visibleProducts = query
    ? products.filter((product) => product.name.toLocaleLowerCase().includes(query))
    : products;

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Item catalog" subtitle="Browse current products and open an item to see its details." />

      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>Available items</Text>
        <NativeButton
          label="Add item"
          onPress={() => router.push("/catalog/new")}
        />
      </View>

      <FormField
        accessibilityLabel="Search catalog items"
        label="Search items"
        onChangeText={setSearch}
        placeholder="Search catalog"
        value={search}
      />
      {error ? <MessageCard title="Catalog" message={error} tone="error" /> : null}
      {!loading && !error && visibleProducts.length === 0 ? (
        <MessageCard
          title={products.length ? "No matching items" : "Your catalog is empty"}
          message={products.length ? "Try another search." : "Add the products you currently offer."}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={error && products.length === 0 ? [] : visibleProducts}
        keyExtractor={(product) => product.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={colors.teal} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`View ${item.name} catalog details, ${formatCurrency(item.price)}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/catalog/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
          >
            <View style={styles.productCopy}>
              <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
              <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  listHeader: { gap: spacing.md, marginBottom: spacing.xs },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.76 },
  productCopy: { flex: 1, minWidth: 0, gap: 3 },
  productName: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  productPrice: { color: colors.mutedText, fontSize: 13 },
  chevron: { color: colors.teal, fontSize: 25, lineHeight: 26 },
});
