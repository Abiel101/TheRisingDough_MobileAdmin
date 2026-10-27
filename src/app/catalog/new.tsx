import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addProduct } from "@/lib/workspace";
import { spacing } from "@/theme/tokens";

export default function NewCatalogItemScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveItem() {
    const parsedPrice = Number(price);
    if (!session?.user.id) return;
    if (!name.trim() || !price.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter an item name and a price of zero or more.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const item = await addProduct(session.user.id, name, parsedPrice);
      router.replace({ pathname: "/catalog/[id]", params: { id: item.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this catalog item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title="New catalog item" subtitle="Add a product and its unit price." />}>
      {error ? <MessageCard title="Catalog item" message={error} tone="error" /> : null}
      <ContentCard style={styles.card}>
        <NativeFormField label="Item name" onChangeText={setName} placeholder="e.g. Sourdough loaf" value={name} />
        <NativeFormField keyboardType="decimal-pad" label="Unit price (USD)" onChangeText={setPrice} placeholder="0.00" value={price} />
        <NativeButton disabled={saving || !name.trim() || !price.trim()} label={saving ? "Saving…" : "Save item"} onPress={() => void saveItem()} />
      </ContentCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
});
