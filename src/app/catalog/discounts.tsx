import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getCatalogPromotion, saveCatalogPromotion } from "@/lib/workspace";
import type { CatalogPromotion } from "@/domain/catalog-pricing";
import { colors, spacing } from "@/theme/tokens";

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

  const load = useCallback(async () => {
    try {
      const next = await getCatalogPromotion();
      setPromotion(next);
      setPercentInput(next.discountPercent ? String(next.discountPercent) : "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load catalog discounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

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
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title="Catalog discounts" subtitle="Set an optional promotion for new orders." />}>
      {error ? <MessageCard title="Catalog discounts" message={error} tone="error" /> : null}
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
});
