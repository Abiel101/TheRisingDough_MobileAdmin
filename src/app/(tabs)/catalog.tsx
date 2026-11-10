import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, AddFab, SearchField } from "@/components/ui/design";
import { MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { getCatalogPromotion, listProducts, productPriceRange, type ProductRecord } from "@/lib/workspace";
import { DEFAULT_CATALOG_PROMOTION, getCatalogUnitPriceCents, type CatalogPromotion } from "@/domain/catalog-pricing";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

function formatPrice(product: ProductRecord, promotion: CatalogPromotion) {
  const { min, max } = productPriceRange(product);
  const discountedMin = getCatalogUnitPriceCents(min, product.discount, promotion) / 100;
  const discountedMax = getCatalogUnitPriceCents(max, product.discount, promotion) / 100;
  return discountedMin === discountedMax ? formatCurrency(discountedMin) : `${formatCurrency(discountedMin)} – ${formatCurrency(discountedMax)}`;
}

export default function CatalogScreen() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [promotion, setPromotion] = useState<CatalogPromotion | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [nextProducts, nextPromotion] = await Promise.all([listProducts(), getCatalogPromotion()]);
      setProducts(nextProducts);
      setPromotion(nextPromotion);
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
    ? products.filter((product) =>
        [product.name, ...product.options.map((option) => option.name)].some((value) => value.toLocaleLowerCase().includes(query)),
      )
    : products;

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Item catalog" subtitle="Browse products, packs, and discounts." />
      <Pressable accessibilityRole="button" onPress={() => router.push("/catalog/discounts")} style={styles.promotionButton}>
        <View style={styles.productCopy}>
          <Text style={styles.promotionTitle}>{promotion?.isActive ? promotion.name : "Catalog discounts"}</Text>
          <Text style={styles.promotionCopy}>{promotion?.isActive ? `${promotion.discountPercent}% promotion active · Tap to manage` : "Manage item offers and holiday promotions"}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <SearchField
        accessibilityLabel="Search catalog items"
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
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={error && products.length === 0 ? [] : visibleProducts}
        keyExtractor={(product) => product.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={colors.teal} />}
        renderItem={({ item, index }) => {
          const original = formatPrice(item, DEFAULT_CATALOG_PROMOTION);
          const current = formatPrice(item, promotion ?? DEFAULT_CATALOG_PROMOTION);
          const isDiscounted = current !== original;
          return (
            <Pressable
              accessibilityLabel={`View ${item.name} catalog details, ${current}${isDiscounted ? ", discounted" : ""}${item.options.length ? `, options: ${item.options.map((option) => option.name).join(", ")}` : ""}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/catalog/[id]", params: { id: item.id } })}
              style={({ pressed }) => [styles.productCard, pressed && styles.pressed]}
            >
              <Avatar index={index} name={item.name} />
              <View style={styles.productCopy}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                  {isDiscounted ? <View accessibilityLabel="Discounted" style={styles.discountDot} /> : null}
                </View>
                <View style={styles.priceRow}>
                  <Text style={[styles.productPrice, isDiscounted && styles.salePrice]}>{current}</Text>
                  {item.discount ? <Text style={styles.productMeta}>{item.discount.type === "percent" ? `${item.discount.value}% item discount` : `$${item.discount.value.toFixed(2)} item discount`}</Text> : null}
                </View>
                {item.options.length ? (
                  <Text numberOfLines={2} style={styles.optionSummary}>{item.options.map((option) => option.name).join(" · ")}</Text>
                ) : null}
                {item.pricingOptions.length ? <Text style={styles.productMeta}>{item.pricingOptions.length} pack {item.pricingOptions.length === 1 ? "option" : "options"}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <AddFab label="Add item" onPress={() => router.push("/catalog/new")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 110, gap: spacing.sm },
  listHeader: { gap: spacing.md, marginBottom: spacing.xs },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.76 },
  productCopy: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  productName: { flexShrink: 1, color: colors.espresso, fontSize: 14, fontWeight: "700" },
  discountDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sale },
  productPrice: { color: colors.mutedText, fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: spacing.xs },
  struckPrice: { color: colors.mutedText, fontSize: 12, textDecorationLine: "line-through" },
  salePrice: { color: colors.sale, fontWeight: "700" },
  productMeta: { color: colors.teal, fontSize: 11, fontWeight: "600" },
  promotionButton: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.teal, backgroundColor: colors.card, padding: spacing.md },
  promotionTitle: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  promotionCopy: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  optionSummary: { color: colors.mutedText, fontSize: 12, lineHeight: 16 },
  chevron: { color: colors.teal, fontSize: 25, lineHeight: 26 },
});
