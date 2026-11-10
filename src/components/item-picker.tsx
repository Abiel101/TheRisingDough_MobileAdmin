import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { catalogChoicePrice, catalogChoices } from "@/domain/catalog-choices";
import { DEFAULT_CATALOG_PROMOTION, type CatalogPromotion } from "@/domain/catalog-pricing";
import { SearchField } from "@/components/ui/design";
import { productPriceRange, type OrderItemInput, type ProductRecord } from "@/lib/workspace";
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
  const [query, setQuery] = useState("");
  const [pickedProductId, setPickedProductId] = useState("");
  const [pickedOptionId, setPickedOptionId] = useState("");
  const [pickedChoiceKey, setPickedChoiceKey] = useState("");
  const [pickedQuantity, setPickedQuantity] = useState(1);

  const pickedProduct = products.find((product) => product.id === pickedProductId);
  const pickedOption = pickedProduct?.options.find((option) => option.id === pickedOptionId) ?? pickedProduct?.options[0];
  const pickedChoices = pickedProduct
    ? catalogChoices(pickedProduct).filter((choice) => (choice.option?.id ?? "") === (pickedOption?.id ?? ""))
    : [];
  const pickedChoice = pickedChoices.find((choice) => choice.key === pickedChoiceKey) ?? pickedChoices[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = useMemo(
    () => normalizedQuery
      ? products.filter((product) =>
          [product.name, ...product.options.map((option) => option.name)]
            .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
        ).slice(0, 8)
      : [],
    [normalizedQuery, products],
  );
  const selectedChoices = useMemo(
    () => products.flatMap((product) => catalogChoices(product).flatMap((choice) => {
      const quantity = quantities[choice.key] ?? 0;
      return quantity > 0 ? [{ ...choice, quantity, price: catalogChoicePrice(choice, promotion) }] : [];
    })),
    [products, quantities, promotion],
  );

  function chooseProduct(product: ProductRecord) {
    const option = product.options[0];
    const firstChoice = catalogChoices(product).find((choice) => (choice.option?.id ?? "") === (option?.id ?? ""));
    setPickedProductId(product.id);
    setPickedOptionId(option?.id ?? "");
    setPickedChoiceKey(firstChoice?.key ?? "");
    setPickedQuantity(1);
    setQuery("");
  }

  function chooseOption(optionId: string) {
    if (!pickedProduct) return;
    const firstChoice = catalogChoices(pickedProduct).find((choice) => (choice.option?.id ?? "") === optionId);
    setPickedOptionId(optionId);
    setPickedChoiceKey(firstChoice?.key ?? "");
    setPickedQuantity(1);
  }

  function addPickedChoice() {
    if (!pickedChoice || pickedQuantity < 1) return;
    onChange(pickedChoice.key, (quantities[pickedChoice.key] ?? 0) + pickedQuantity);
    setPickedQuantity(1);
  }

  function changeProduct() {
    setPickedProductId("");
    setPickedOptionId("");
    setPickedChoiceKey("");
    setQuery("");
  }

  return (
    <View style={styles.container}>
      {selectedChoices.length ? (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionTitle}>Selected to add</Text>
          {selectedChoices.map((choice) => (
            <View key={choice.key} style={styles.selectedRow}>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.productName}>{choice.product.name}</Text>
                <Text numberOfLines={1} style={styles.hint}>{choice.label} · {formatCurrency(choice.price)} each</Text>
              </View>
              <Pressable
                accessibilityLabel={`Remove one ${choice.product.name}, ${choice.label}`}
                disabled={disabled}
                onPress={() => onChange(choice.key, Math.max(choice.quantity - 1, 0))}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>−</Text>
              </Pressable>
              <Text style={styles.quantityText}>{choice.quantity}</Text>
              <Pressable
                accessibilityLabel={`Add one ${choice.product.name}, ${choice.label}`}
                disabled={disabled}
                onPress={() => onChange(choice.key, choice.quantity + 1)}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>+</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove ${choice.product.name}, ${choice.label}`}
                disabled={disabled}
                onPress={() => onChange(choice.key, 0)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {pickedProduct && pickedChoice ? (
        <View style={styles.pickPanel}>
          <View style={styles.panelHeader}>
            <Text style={styles.productName}>{pickedProduct.name}</Text>
            <Pressable accessibilityRole="button" disabled={disabled} onPress={changeProduct} style={styles.changeButton}>
              <Text style={styles.changeText}>Search another</Text>
            </Pressable>
          </View>

          {pickedProduct.options.length ? (
            <>
              <Text style={styles.label}>Option</Text>
              <View style={styles.choiceList}>
                {pickedProduct.options.map((option) => {
                  const selected = option.id === pickedOption?.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={disabled}
                      key={option.id}
                      onPress={() => chooseOption(option.id)}
                      style={[styles.optionChoice, selected && styles.optionChoiceSelected]}
                    >
                      <Text style={[styles.optionName, selected && styles.selectedText]}>{option.name}</Text>
                      <Text style={[styles.optionPrice, selected && styles.selectedText]}>
                        {formatCurrency(option.price ?? pickedProduct.price)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Size and price</Text>
          <View style={styles.choiceList}>
            {pickedChoices.map((choice) => {
              const selected = choice.key === pickedChoice.key;
              const price = catalogChoicePrice(choice, promotion);
              const discounted = price < choice.originalCents / 100;
              const prefix = pickedOption ? `${pickedOption.name} · ` : "";
              const label = prefix && choice.label.startsWith(prefix) ? choice.label.slice(prefix.length) : choice.label;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  disabled={disabled}
                  key={choice.key}
                  onPress={() => { setPickedChoiceKey(choice.key); setPickedQuantity(1); }}
                  style={[styles.sizeChoice, selected && styles.sizeChoiceSelected]}
                >
                  <Text style={[styles.sizeName, selected && styles.sizeNameSelected]}>{label}</Text>
                  <View style={styles.priceRow}>
                    {discounted ? <Text style={styles.struck}>{formatCurrency(choice.originalCents / 100)}</Text> : null}
                    <Text style={[styles.price, discounted && styles.sale]}>{formatCurrency(price)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.quantityRow}>
            <Text style={styles.label}>{pickedChoice.label.includes("pieces") ? "Packs" : "Quantity"}</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="One fewer"
                disabled={disabled || pickedQuantity <= 1}
                onPress={() => setPickedQuantity((quantity) => Math.max(quantity - 1, 1))}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>−</Text>
              </Pressable>
              <Text style={styles.quantityText}>{pickedQuantity}</Text>
              <Pressable
                accessibilityLabel="One more"
                disabled={disabled}
                onPress={() => setPickedQuantity((quantity) => quantity + 1)}
                style={styles.stepperButton}
              >
                <Text style={styles.stepperSymbol}>+</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={addPickedChoice}
            style={[styles.addButton, disabled && styles.disabled]}
          >
            <Text style={styles.addButtonText}>
              Add to order · {formatCurrency(catalogChoicePrice(pickedChoice, promotion) * pickedQuantity)}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.searchSection}>
          <SearchField
            accessibilityLabel="Search catalog items"
            onChangeText={setQuery}
            placeholder="Search items or options"
            value={query}
          />
          {matches.map((product) => {
            const range = productPriceRange(product);
            return (
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                key={product.id}
                onPress={() => chooseProduct(product)}
                style={styles.result}
              >
                <View style={styles.copy}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text numberOfLines={1} style={styles.hint}>
                    {product.options.map((option) => option.name).join(" · ") || "Regular"}
                    {" · "}
                    {range.min === range.max ? formatCurrency(range.min) : `${formatCurrency(range.min)}–${formatCurrency(range.max)}`}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
          {normalizedQuery && !matches.length ? <Text style={styles.hint}>No catalog items match “{query.trim()}”.</Text> : null}
          {!normalizedQuery ? <Text style={styles.hint}>Search for an item, then choose its option, size, and quantity.</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  selectedSection: { gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  selectedRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: 10, backgroundColor: colors.parchment, paddingHorizontal: spacing.xs },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  productName: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.card },
  stepperSymbol: { color: colors.teal, fontSize: 18, fontWeight: "700" },
  quantityText: { minWidth: 18, color: colors.espresso, textAlign: "center", fontSize: 13, fontWeight: "700" },
  removeButton: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
  removeText: { color: colors.brick, fontSize: 20, fontWeight: "700" },
  pickPanel: { gap: spacing.sm, borderWidth: 1, borderColor: colors.teal, borderRadius: 14, backgroundColor: colors.parchment, padding: spacing.md },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  changeButton: { minHeight: 32, justifyContent: "center", paddingHorizontal: spacing.xs },
  changeText: { color: colors.teal, fontSize: 12, fontWeight: "700" },
  label: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  choiceList: { gap: spacing.xs },
  optionChoice: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  optionChoiceSelected: { borderColor: colors.teal, backgroundColor: "#EAF4F2" },
  optionName: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  optionPrice: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },
  selectedText: { color: colors.teal, fontWeight: "700" },
  sizeChoice: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.card, paddingHorizontal: spacing.md },
  sizeChoiceSelected: { borderColor: colors.orange, backgroundColor: "#FFF4E8" },
  sizeName: { color: colors.espresso, fontSize: 13, fontWeight: "600" },
  sizeNameSelected: { fontWeight: "800" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  price: { color: colors.espresso, fontSize: 13, fontWeight: "700" },
  struck: { color: colors.mutedText, fontSize: 11, textDecorationLine: "line-through" },
  sale: { color: colors.sale },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.orange, paddingHorizontal: spacing.md },
  addButtonText: { color: colors.card, fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  searchSection: { gap: spacing.sm },
  result: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment, paddingHorizontal: spacing.md },
  chevron: { color: colors.teal, fontSize: 24 },
});
