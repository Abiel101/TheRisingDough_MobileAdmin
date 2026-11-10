import { Pressable, StyleSheet, Text, View } from "react-native";

import { catalogChoicePrice, catalogChoices } from "@/domain/catalog-choices";
import { DEFAULT_CATALOG_PROMOTION, type CatalogPromotion } from "@/domain/catalog-pricing";
import type { OrderItemInput, ProductRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export type QuantityMap = Record<string, number>;

export function selectedItemsFromQuantities(products: readonly ProductRecord[], quantities: QuantityMap, promotion: CatalogPromotion): OrderItemInput[] {
  return products.flatMap((product) =>
    catalogChoices(product).flatMap((choice) => {
      const quantity = quantities[choice.key] ?? 0;
      return quantity > 0 ? [{ product, option: choice.option, itemName: choice.itemName, unitPrice: catalogChoicePrice(choice, promotion), quantity }] : [];
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
  promotion?: CatalogPromotion;
};

export function ItemPicker({ products, quantities, onChange, disabled, promotion = DEFAULT_CATALOG_PROMOTION }: ItemPickerProps) {
  return (
    <>
      {products.map((product) => {
        const choices = catalogChoices(product);
        const hasOptions = choices.length > 1 || product.options.length > 0;
        return (
          <View key={product.id} style={styles.group}>
            {hasOptions ? (
              <View style={styles.groupHeader}>
                <Text style={styles.name}>{product.name}</Text>
                <Text style={styles.hint}>{choices.length} choice{choices.length === 1 ? "" : "s"}</Text>
              </View>
            ) : null}
            {choices.map((choice) => {
              const key = choice.key;
              const quantity = quantities[key] ?? 0;
              const price = catalogChoicePrice(choice, promotion);
              const original = choice.originalCents / 100;
              const label = hasOptions ? choice.label : product.name;
              return (
                <View key={key} style={[styles.row, hasOptions && styles.optionRow]}>
                  <View style={styles.copy}>
                    <Text numberOfLines={2} style={hasOptions ? styles.optionName : styles.name}>{label}</Text>
                    {price < original ? (
                      <View style={styles.priceRow}>
                        <Text style={styles.struck}>{formatCurrency(original)}</Text>
                        <Text style={styles.sale}>{formatCurrency(price)}</Text>
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
