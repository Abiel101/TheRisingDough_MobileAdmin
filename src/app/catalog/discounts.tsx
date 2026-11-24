import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeDatePickerField } from "@/components/ui/native-date-picker-field";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getCatalogPromotion, listProducts, saveCatalogPromotion, updateProductsDiscount, type ProductRecord } from "@/lib/workspace";
import type { CatalogPromotion, ProductDiscountType } from "@/domain/catalog-pricing";
import { colors, spacing } from "@/theme/tokens";

function dateKeyAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function discountLabel(product: ProductRecord) {
  const discount = product.discount;
  if (!discount || discount.value <= 0) return "No discount";
  if (discount.endsOn && discount.endsOn < dateKeyAfter(0)) return "No discount";
  const amount = discount.type === "percent" ? `${discount.value}% off` : `$${discount.value.toFixed(2)} off`;
  return discount.endsOn ? `${amount} until ${discount.endsOn}` : amount;
}

const initialPromotion: CatalogPromotion = {
  name: "Holiday promotion",
  isActive: false,
  discountPercent: 0,
  stackOnProductDiscount: false,
};

export default function CatalogDiscountsScreen() {
  const { session } = useAuth();
  const [promotion, setPromotion] = useState(initialPromotion);
  const [percentInput, setPercentInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<ProductDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountEndDate, setDiscountEndDate] = useState(dateKeyAfter(7));
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [next, nextProducts] = await Promise.all([getCatalogPromotion(), listProducts()]);
      setPromotion(next);
      setProducts(nextProducts);
      setPercentInput(next.discountPercent ? String(next.discountPercent) : "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load catalog discounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const allSelected = products.length > 0 && selectedIds.length === products.length;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleProduct(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function applyItemDiscount(clear: boolean) {
    if (!selectedIds.length) {
      setError("Select at least one item.");
      return;
    }
    const amount = Number(discountValue);
    if (!clear) {
      if (!discountValue.trim() || !Number.isFinite(amount) || amount <= 0 || (discountType === "percent" && amount > 100)) {
        setError(discountType === "percent" ? "Enter a discount above 0 and at most 100%." : "Enter a discount amount above $0.");
        return;
      }
      if (!discountEndDate || discountEndDate < dateKeyAfter(0)) {
        setError("Choose an end date that is today or later.");
        return;
      }
    }
    setApplying(true);
    setError("");
    try {
      const discount = clear ? null : { type: discountType, value: amount, endsOn: discountEndDate };
      await updateProductsDiscount(selectedIds, discount);
      setProducts((current) => current.map((product) => selectedSet.has(product.id) ? { ...product, discount } : product));
      Alert.alert(clear ? "Discounts removed" : "Discount applied", `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} updated.`);
      setSelectedIds([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update item discounts.");
    } finally {
      setApplying(false);
    }
  }

  async function save() {
    if (!session?.user.id) return;
    const percent = Number(percentInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError("Enter a discount between 0 and 100%.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const next = { ...promotion, discountPercent: percent, name: promotion.name.trim() || "Holiday promotion" };
      await saveCatalogPromotion(session.user.id, next);
      setPromotion(next);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this promotion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title="Catalog settings" subtitle="Temporary item discounts and promotions." />}>
      {error ? <MessageCard title="Catalog settings" message={error} tone="error" /> : null}
      <ContentCard style={styles.card}>
        <Text style={styles.heading}>Temporary item discounts</Text>
        <Text style={styles.description}>Select the items to discount, then choose an amount and end date. Existing orders keep their saved prices.</Text>
        <Pressable accessibilityRole="button" onPress={() => setSelectedIds(allSelected ? [] : products.map((product) => product.id))} style={styles.selectAll}>
          <Text style={styles.selectAllText}>{allSelected ? "Clear selection" : "Select all items"}</Text>
          <Text style={styles.description}>{selectedIds.length} selected</Text>
        </Pressable>
        {products.map((product) => {
          const selected = selectedSet.has(product.id);
          return (
            <Pressable key={product.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleProduct(product.id)} style={styles.itemRow}>
              <View style={[styles.checkbox, selected && styles.checkboxOn]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.choiceTitle}>{product.name}</Text>
                <Text style={styles.description}>{discountLabel(product)}</Text>
              </View>
            </Pressable>
          );
        })}
        {!loading && !products.length ? <Text style={styles.description}>Add catalog items to discount them.</Text> : null}
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
        <NativeDatePickerField label="Discount ends on" value={discountEndDate} onChange={setDiscountEndDate} />
        <NativeButton disabled={applying || !selectedIds.length} label={applying ? "Applying…" : "Apply discount to selected"} onPress={() => void applyItemDiscount(false)} />
        <NativeButton disabled={applying || !selectedIds.length} label="Remove discount from selected" onPress={() => void applyItemDiscount(true)} variant="text" />
      </ContentCard>
      <ContentCard style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={styles.copy}>
            <Text style={styles.heading}>{promotion.isActive ? "Promotion is on" : "Promotion is off"}</Text>
            <Text style={styles.description}>Turn the catalog wide discount on or off without removing its settings.</Text>
          </View>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: promotion.isActive }} onPress={() => setPromotion((value) => ({ ...value, isActive: !value.isActive }))} style={[styles.switch, promotion.isActive && styles.switchOn]}>
            <View style={[styles.switchKnob, promotion.isActive && styles.switchKnobOn]} />
          </Pressable>
        </View>
        <NativeFormField label="Promotion name" onChangeText={(name) => setPromotion((value) => ({ ...value, name }))} placeholder="Thanksgiving special" value={promotion.name} />
        <NativeFormField keyboardType="decimal-pad" label="Catalog wide percent" onChangeText={setPercentInput} placeholder="10" value={percentInput} />
        <Text style={styles.description}>A 0% promotion is saved as off for pricing purposes. Fixed half dozen/dozen prices remain their own price choices.</Text>
      </ContentCard>
      <ContentCard style={styles.card}>
        <Text style={styles.heading}>When an item already has a discount</Text>
        <Text style={styles.description}>Choose how the catalog wide promotion interacts with per item discounts.</Text>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: !promotion.stackOnProductDiscount }} onPress={() => setPromotion((value) => ({ ...value, stackOnProductDiscount: false }))} style={styles.choiceRow}>
          <View style={[styles.radio, !promotion.stackOnProductDiscount && styles.radioSelected]} />
          <View style={styles.copy}><Text style={styles.choiceTitle}>Apply once</Text><Text style={styles.description}>Items with their own discount keep that discount. Other items receive this promotion.</Text></View>
        </Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: promotion.stackOnProductDiscount }} onPress={() => setPromotion((value) => ({ ...value, stackOnProductDiscount: true }))} style={styles.choiceRow}>
          <View style={[styles.radio, promotion.stackOnProductDiscount && styles.radioSelected]} />
          <View style={styles.copy}><Text style={styles.choiceTitle}>Stack both</Text><Text style={styles.description}>Apply the item discount first, then apply this promotion on its reduced price.</Text></View>
        </Pressable>
      </ContentCard>
      <Text style={styles.footnote}>Discounts are saved into new order item prices. Existing orders keep their original prices.</Text>
      <NativeButton disabled={loading || saving} label={saving ? "Saving…" : loading ? "Loading…" : "Save promotion"} onPress={() => void save()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  copy: { flex: 1, gap: spacing.xs },
  heading: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  choiceTitle: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  description: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  switch: { width: 48, height: 28, justifyContent: "center", borderRadius: 999, backgroundColor: colors.border, padding: 3 },
  switchOn: { backgroundColor: colors.teal },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.card },
  switchKnobOn: { alignSelf: "flex-end" },
  choiceRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.xs },
  radio: { width: 20, height: 20, borderWidth: 2, borderColor: colors.border, borderRadius: 10, marginTop: 1 },
  radioSelected: { borderColor: colors.teal, backgroundColor: colors.teal },
  footnote: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  selectAll: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  selectAllText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm, minHeight: 52 },
  checkbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border, borderRadius: 6 },
  checkboxOn: { borderColor: colors.teal, backgroundColor: colors.teal },
  check: { color: colors.card, fontSize: 13, fontWeight: "800" },
  typeRow: { flexDirection: "row", gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.card },
  chipSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { color: colors.teal, fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: colors.card },
});
