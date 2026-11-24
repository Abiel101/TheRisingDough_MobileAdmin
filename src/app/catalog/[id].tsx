import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { OptionAddForm } from "@/components/option-add-form";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addProductOption, getProduct, listRecipes, saveRecipe, removeProduct, removeProductOption, updateProductName, updateProductOption, updateProductPricing, type ProductOption, type ProductOptionInput, type ProductRecord } from "@/lib/workspace";
import type { CatalogPriceOption } from "@/domain/catalog-pricing";
import { colors, spacing } from "@/theme/tokens";

type RecipeDraft = { key: string; ingredient: string; quantity: string; unit: string };

type PricingOptionDraft = CatalogPriceOption & { packSizeInput: string; priceInput: string };
type ProductOptionDraft = { id: string; name: string; priceInput: string };
type CatalogTab = "options" | "pricing" | "settings";

export default function CatalogItemDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useAuth();
  const [product, setProduct] = useState<ProductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [pricingOptions, setPricingOptions] = useState<PricingOptionDraft[]>([]);
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<RecipeDraft[]>([]);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [tab, setTab] = useState<CatalogTab>("options");
  const [productName, setProductName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<ProductOptionDraft[]>([]);
  const [savingOptionId, setSavingOptionId] = useState("");
  const [editingOptionId, setEditingOptionId] = useState("");
  const [addingOption, setAddingOption] = useState(false);
  const [editingPackId, setEditingPackId] = useState("");
  const [editingIngredientId, setEditingIngredientId] = useState("");

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
        setProductName(result.name);
        setOptionDrafts(result.options.map((option) => ({
          id: option.id,
          name: option.name,
          priceInput: (option.price ?? result.price).toFixed(2),
        })));
        setPricingOptions(result.pricingOptions.map((option) => ({
          ...option,
          packSizeInput: String(option.packSize),
          priceInput: (option.priceCents / 100).toFixed(2),
        })));
      }
      if (result) {
        const saved = await listRecipes(result.id);
        setRecipe(saved.map((entry) => ({ key: entry.id, ingredient: entry.ingredient, quantity: String(entry.quantity), unit: entry.unit })));
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
    if (!product || !session?.user.id) throw new Error("Sign in to add an option.");
    const option = await addProductOption(session.user.id, product.id, input, product.options.length);
    setProduct((current) => (current ? { ...current, options: [...current.options, option] } : current));
    setOptionDrafts((current) => [...current, {
      id: option.id,
      name: option.name,
      priceInput: (option.price ?? product.price).toFixed(2),
    }]);
  }

  async function handleSaveOption(option: ProductOptionDraft) {
    if (!product) return;
    const price = Number(option.priceInput);
    if (!option.name.trim() || !option.priceInput.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter an option name and a valid price of zero or more.");
      return;
    }
    setSavingOptionId(option.id);
    setError("");
    try {
      const saved = await updateProductOption(option.id, { name: option.name, price });
      setProduct((current) => current ? {
        ...current,
        options: current.options.map((item) => item.id === saved.id ? saved : item),
      } : current);
      setOptionDrafts((current) => current.map((item) => item.id === saved.id ? {
        ...item,
        name: saved.name,
        priceInput: (saved.price ?? product.price).toFixed(2),
      } : item));
      setEditingOptionId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this option.");
    } finally {
      setSavingOptionId("");
    }
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
      setOptionDrafts((current) => current.filter((item) => item.id !== option.id));
      setEditingOptionId("");
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
    const id = `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPricingOptions((current) => [...current, {
      id,
      label: "Half dozen",
      packSize: 6,
      priceCents: 0,
      packSizeInput: "6",
      priceInput: "0.00",
    }]);
    setEditingPackId(id);
  }

  function finishPack(option: PricingOptionDraft) {
    const pieces = Number(option.packSizeInput);
    const price = Number(option.priceInput);
    if (!option.label.trim() || !option.packSizeInput.trim() || !Number.isInteger(pieces) || pieces < 1 || !option.priceInput.trim() || !Number.isFinite(price) || price < 0) {
      setError("Each pack option needs a label, a whole piece count, and a valid price.");
      return;
    }
    setError("");
    setEditingPackId("");
  }

  function finishIngredient(entry: RecipeDraft) {
    if (!entry.ingredient.trim() || !entry.quantity.trim() || !Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0) {
      setError("Enter an ingredient name and an amount above zero.");
      return;
    }
    setError("");
    setEditingIngredientId("");
  }

  function updateRecipe(key: string, patch: Partial<RecipeDraft>) {
    setRecipe((current) => current.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry)));
  }

  async function handleSaveRecipe() {
    if (!product || !session?.user.id) return;
    setSavingRecipe(true);
    setError("");
    try {
      await saveRecipe(session.user.id, product.id, recipe.map((entry) => ({ ingredient: entry.ingredient, quantity: Number(entry.quantity), unit: entry.unit })));
      setEditingIngredientId("");
      Alert.alert("Recipe saved", "Inventory totals will use this recipe.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the recipe.");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleSaveName() {
    if (!product) return;
    setSavingName(true);
    setError("");
    try {
      await updateProductName(product.id, productName);
      const name = productName.trim().replace(/\s+/g, " ");
      setProduct((current) => current ? { ...current, name } : current);
      setProductName(name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this item.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePricing() {
    if (!product) return;
    const normalizedOptions = pricingOptions.map((option) => ({
      id: option.id,
      label: option.label.trim(),
      packSize: option.packSizeInput.trim() ? Number(option.packSizeInput) : NaN,
      priceCents: option.priceInput.trim() ? Math.round(Number(option.priceInput) * 100) : NaN,
    }));
    if (normalizedOptions.some((option) => !option.label || !Number.isInteger(option.packSize) || option.packSize < 1 || !Number.isInteger(option.priceCents) || !Number.isFinite(option.priceCents) || option.priceCents < 0)) {
      setError("Each pack option needs a label, a piece count, and a valid price.");
      return;
    }
    setSavingPricing(true);
    setError("");
    try {
      await updateProductPricing(product.id, {
        discount: product.discount,
        pricingOptions: normalizedOptions,
      });
      setProduct({ ...product, pricingOptions: normalizedOptions });
      setPricingOptions(normalizedOptions.map((option) => ({
        ...option,
        packSizeInput: String(option.packSize),
        priceInput: (option.priceCents / 100).toFixed(2),
      })));
      setEditingPackId("");
      Alert.alert("Pricing saved", "The item's pack prices have been updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save item pricing.");
    } finally {
      setSavingPricing(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title={product?.name || "Item details"} subtitle="Manage your catalog item." />}>
      {error ? <MessageCard title="Catalog item" message={error} tone="error" /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading item…</Text></View>
      ) : product ? (
        <>
          <View style={styles.tabs}>
            {([
              { value: "options", label: "Options" },
              { value: "pricing", label: "Pricing" },
              { value: "settings", label: "Details" },
            ] as const).map((item) => (
              <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: tab === item.value }} onPress={() => setTab(item.value)} style={[styles.tab, tab === item.value && styles.activeTab]}>
                <Text style={[styles.tabLabel, tab === item.value && styles.activeTabLabel]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          {tab === "options" ? (
            <ContentCard style={styles.card}>
              <Text style={styles.sectionTitle}>Item types and regular options</Text>
              <Text style={styles.description}>Select an option to edit its name or price. Save each option to apply changes.</Text>
              {optionDrafts.length ? optionDrafts.map((option) => (
                <View key={option.id}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${option.name}, $${option.priceInput}`} accessibilityState={{ expanded: editingOptionId === option.id }} onPress={() => setEditingOptionId(editingOptionId === option.id ? "" : option.id)} style={styles.listRow}>
                    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{option.name}</Text><Text style={styles.rowMeta}>{product.options.some((saved) => saved.id === option.id && (saved.name !== option.name || (saved.price ?? product.price).toFixed(2) !== option.priceInput)) ? "Unsaved changes" : "Price per item"}</Text></View>
                    <Text style={styles.rowValue}>${option.priceInput}</Text><Text style={styles.chevron}>›</Text>
                  </Pressable>
                  {editingOptionId === option.id ? <View style={styles.editor}>
                  <NativeFormField
                    label="Option name"
                    onChangeText={(name) => setOptionDrafts((current) => current.map((item) => item.id === option.id ? { ...item, name } : item))}
                    placeholder="Regular"
                    value={option.name}
                  />
                  <NativeFormField
                    keyboardType="decimal-pad"
                    label="Price per item ($)"
                    onChangeText={(priceInput) => setOptionDrafts((current) => current.map((item) => item.id === option.id ? { ...item, priceInput } : item))}
                    placeholder="0.00"
                    value={option.priceInput}
                  />
                  <View style={styles.optionActions}>
                    <Pressable
                      accessibilityLabel={`Remove option ${option.name}`}
                      accessibilityRole="button"
                      disabled={product.options.length < 2}
                      hitSlop={8}
                      onPress={() => {
                        const existingOption = product.options.find((item) => item.id === option.id);
                        if (existingOption) confirmRemoveOption(existingOption);
                      }}
                      style={product.options.length < 2 && styles.disabledAction}
                    >
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                    <NativeButton
                      disabled={savingOptionId === option.id}
                      label={savingOptionId === option.id ? "Saving…" : "Save option"}
                      onPress={() => void handleSaveOption(option)}
                      variant="outlined"
                    />
                  </View>
                  </View> : null}
                </View>
              )) : (
                <Text style={styles.description}>No saved options yet. Add a priced option to keep this item available on new orders.</Text>
              )}
              {addingOption ? (
                <>
                  <OptionAddForm existingNames={product.options.map((option) => option.name)} onAdd={async (option) => { await handleAddOption(option); setAddingOption(false); }} />
                  <NativeButton label="Cancel" onPress={() => setAddingOption(false)} variant="text" />
                </>
              ) : <NativeButton label="Add option" onPress={() => setAddingOption(true)} variant="outlined" />}
            </ContentCard>
          ) : null}
          {tab === "pricing" ? (
            <>
              <ContentCard style={styles.card}>
                <Text style={styles.sectionTitle}>Pack and size prices</Text>
                <Text style={styles.description}>Set separate prices for half dozen, dozen, or other pack sizes.</Text>
                {pricingOptions.map((option) => (
                  <View key={option.id}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${option.label}, ${option.packSizeInput} pieces, $${option.priceInput}`} accessibilityState={{ expanded: editingPackId === option.id }} onPress={() => setEditingPackId(editingPackId === option.id ? "" : option.id)} style={styles.listRow}>
                      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{option.label || "New pack"}</Text><Text style={styles.rowMeta}>{option.packSizeInput || "0"} pieces</Text></View>
                      <Text style={styles.rowValue}>${option.priceInput || "0.00"}</Text><Text style={styles.chevron}>›</Text>
                    </Pressable>
                    {editingPackId === option.id ? <View style={styles.editor}>
                    <NativeFormField label="Option label" onChangeText={(label) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, label } : entry))} placeholder="Half dozen" value={option.label} />
                    <View style={styles.optionNumbers}>
                      <View style={styles.optionField}><NativeFormField keyboardType="number-pad" label="Pieces" onChangeText={(value) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, packSizeInput: value } : entry))} placeholder="6" value={option.packSizeInput} /></View>
                      <View style={styles.optionField}><NativeFormField keyboardType="decimal-pad" label="Pack price ($)" onChangeText={(value) => setPricingOptions((current) => current.map((entry) => entry.id === option.id ? { ...entry, priceInput: value } : entry))} placeholder="11.00" value={option.priceInput} /></View>
                    </View>
                    <View style={styles.optionActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${option.label} pack`} onPress={() => { setPricingOptions((current) => current.filter((entry) => entry.id !== option.id)); setEditingPackId(""); }}><Text style={styles.removeOption}>Remove</Text></Pressable>
                      <NativeButton label="Done" onPress={() => finishPack(option)} variant="outlined" />
                    </View>
                    </View> : null}
                  </View>
                ))}
                {!pricingOptions.length ? <Text style={styles.empty}>No pack prices yet.</Text> : null}
                <NativeButton label="Add pack option" onPress={addPricingOption} variant="outlined" />
                <Text style={styles.hint}>Save pack prices below to apply changes.</Text>
              </ContentCard>
              <NativeButton disabled={savingPricing} label={savingPricing ? "Saving…" : "Save pack prices"} onPress={() => void savePricing()} />
            </>
          ) : null}
          {tab === "settings" ? (
            <>
              <ContentCard style={styles.card}>
                <Text style={styles.sectionTitle}>Item details</Text>
                <NativeFormField label="Catalog item name" onChangeText={setProductName} placeholder="Item name" value={productName} />
                <NativeButton disabled={savingName || !productName.trim()} label={savingName ? "Saving…" : "Save item name"} onPress={() => void handleSaveName()} />
              </ContentCard>
              <ContentCard style={styles.card}>
                <Text style={styles.sectionTitle}>Recipe</Text>
                <Text style={styles.description}>Ingredients needed to make one {product.name}. Used to total inventory for orders that have not started.</Text>
                {recipe.map((entry) => (
                  <View key={entry.key}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ingredient ${entry.ingredient || "new ingredient"}`} accessibilityState={{ expanded: editingIngredientId === entry.key }} onPress={() => setEditingIngredientId(editingIngredientId === entry.key ? "" : entry.key)} style={styles.listRow}>
                      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{entry.ingredient || "New ingredient"}</Text></View>
                      <Text style={styles.rowValue}>{entry.quantity} {entry.unit}</Text><Text style={styles.chevron}>›</Text>
                    </Pressable>
                    {editingIngredientId === entry.key ? <View style={styles.editor}>
                    <NativeFormField label="Ingredient" onChangeText={(ingredient) => updateRecipe(entry.key, { ingredient })} placeholder="Bread flour" value={entry.ingredient} />
                    <View style={styles.optionNumbers}>
                      <View style={styles.optionField}><NativeFormField keyboardType="decimal-pad" label="Amount" onChangeText={(quantity) => updateRecipe(entry.key, { quantity })} placeholder="120" value={entry.quantity} /></View>
                      <View style={styles.optionField}><NativeFormField label="Unit" onChangeText={(unit) => updateRecipe(entry.key, { unit })} placeholder="g" value={entry.unit} /></View>
                    </View>
                    <View style={styles.optionActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ingredient ${entry.ingredient}`} onPress={() => { setRecipe((current) => current.filter((item) => item.key !== entry.key)); setEditingIngredientId(""); }}><Text style={styles.removeOption}>Remove</Text></Pressable>
                      <NativeButton label="Done" onPress={() => finishIngredient(entry)} variant="outlined" />
                    </View>
                    </View> : null}
                  </View>
                ))}
                {!recipe.length ? <Text style={styles.empty}>No ingredients yet.</Text> : null}
                <NativeButton label="Add ingredient" onPress={() => { const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; setRecipe((current) => [...current, { key, ingredient: "", quantity: "", unit: "" }]); setEditingIngredientId(key); }} variant="outlined" />
                <Text style={styles.hint}>Save the recipe to apply ingredient changes.</Text>
                <NativeButton disabled={savingRecipe} label={savingRecipe ? "Saving…" : "Save recipe"} onPress={() => void handleSaveRecipe()} />
              </ContentCard>
              <NativeButton disabled={removing} label={removing ? "Removing…" : "Delete catalog item"} onPress={confirmRemove} variant="outlined" />
            </>
          ) : null}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.md },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  tabs: { flexDirection: "row", backgroundColor: colors.border, padding: 4, borderRadius: 16, gap: spacing.xs },
  tab: { flex: 1, minHeight: 42, justifyContent: "center", alignItems: "center", borderRadius: 12 },
  activeTab: { backgroundColor: colors.card },
  tabLabel: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  activeTabLabel: { color: colors.teal },
  card: { gap: spacing.md, padding: spacing.lg },
  description: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.md, minHeight: 56 },
  rowCopy: { flex: 1, minWidth: 0, gap: 3 },
  rowTitle: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  rowMeta: { color: colors.mutedText, fontSize: 12 },
  rowValue: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  chevron: { color: colors.mutedText, fontSize: 22 },
  editor: { gap: spacing.md, paddingVertical: spacing.md },
  empty: { color: colors.mutedText, fontSize: 13, paddingVertical: spacing.sm },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  optionNumbers: { flexDirection: "row", gap: spacing.sm },
  optionField: { flex: 1 },
  removeOption: { alignSelf: "flex-start", color: colors.brick, fontSize: 13, fontWeight: "700", paddingVertical: spacing.xs },
  optionActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  removeText: { color: colors.brick, fontSize: 13, fontWeight: "700" },
  disabledAction: { opacity: 0.4 },
  muted: { color: colors.mutedText, fontSize: 12 },
});
