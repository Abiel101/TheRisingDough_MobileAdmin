import { Pressable, StyleSheet, Text, View } from "react-native";

import { optionUnitPrice, type OrderItemInput, type ProductOption, type ProductRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export type QuantityMap = Record<string, number>;

/** Quantity key for one orderable line: an item, or one option of an item. */
export function lineQuantityKey(productId: string, optionId?: string | null) {
  return `${productId}:${optionId ?? ""}`;
}

/** Orderable lines for an item: each option when it has any, otherwise the item itself. */
export function orderableOptions(product: ProductRecord): (ProductOption | null)[] {
  return product.options.length ? product.options : [null];
}

export function selectedItemsFromQuantities(products: readonly ProductRecord[], quantities: QuantityMap): OrderItemInput[] {
  return products.flatMap((product) =>
    orderableOptions(product).flatMap((option) => {
      const quantity = quantities[lineQuantityKey(product.id, option?.id)] ?? 0;
      return quantity > 0 ? [{ product, option, quantity }] : [];
    }),
  );
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

type ItemPickerProps = {
  products: readonly ProductRecord[];
  quantities: QuantityMap;
  onChange: (key: string, quantity: number) => void;
  disabled?: boolean;
  /** Discounted line totals keyed by lineQuantityKey, shown next to a struck-through original. */
  discountedTotals?: ReadonlyMap<string, number>;
};

export function ItemPicker({ products, quantities, onChange, disabled, discountedTotals }: ItemPickerProps) {
  return (
    <>
      {products.map((product) => {
        const hasOptions = product.options.length > 0;
        return (
          <View key={product.id} style={styles.group}>
            {hasOptions ? (
              <View style={styles.groupHeader}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.hint}>{product.options.length} option{product.options.length === 1 ? "" : "s"}</Text>
              </View>
            ) : null}
            {orderableOptions(product).map((option) => {
              const key = lineQuantityKey(product.id, option?.id);
              const quantity = quantities[key] ?? 0;
              const price = optionUnitPrice(product, option);
              const label = option?.name ?? product.name;
              const discounted = discountedTotals?.get(key);
              return (
                <View key={key} style={[styles.row, hasOptions && styles.optionRow]}>
                  <View style={styles.copy}>
                    <Text numberOfLines={2} style={hasOptions ? styles.optionName : styles.name}>{label}</Text>
                    {quantity > 0 && discounted !== undefined && discounted < price * quantity ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.struck}>{formatCurrency(price * quantity)}</Text>
                        <Text style={styles.sale}>{formatCurrency(discounted)}</Text>
                      </View>
                    ) : (
                      <Text style={styles.hint}>{formatCurrency(price)}</Text>
                    )}
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove one ${hasOptions ? `${product.name}, ${label}` : label}`}
                    disabled={!quantity || disabled}
                    onPress={() => onChange(key, Math.max(quantity - 1, 0))}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantitySymbol}>−</Text>
                  </Pressable>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <Pressable
                    accessibilityLabel={`Add one ${hasOptions ? `${product.name}, ${label}` : label}`}
                    disabled={disabled}
                    onPress={() => onChange(key, quantity + 1)}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantitySymbol}>+</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  group: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  groupHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm, paddingTop: spacing.sm },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  optionRow: { paddingLeft: spacing.md },
  copy: { flex: 1, gap: 3 },
  name: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  optionName: { color: colors.espresso, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  quantityButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.parchment },
  quantitySymbol: { color: colors.teal, fontSize: 19, fontWeight: "700" },
  quantityText: { minWidth: 20, color: colors.espresso, textAlign: "center", fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  struck: { color: colors.mutedText, fontSize: 12, textDecorationLine: "line-through" },
  sale: { color: colors.sale, fontSize: 13, fontWeight: "700" },
});
