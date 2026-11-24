import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { OptionAddForm } from "@/components/option-add-form";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addProduct, type ProductOptionInput } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export default function NewCatalogItemScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [options, setOptions] = useState<ProductOptionInput[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addingOption, setAddingOption] = useState(false);

  async function saveItem() {
    if (!session?.user.id) return;
    if (!name.trim() || !options.length) {
      setError("Enter an item name and add at least one priced option. For a standard item, add an option named Regular.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const item = await addProduct(session.user.id, name, options[0].price, options);
      router.replace({ pathname: "/catalog/[id]", params: { id: item.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this catalog item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen} header={<SheetHeader showSettings={false} title="New catalog item" subtitle="Name the item, then add one or more priced options." />}>
      {error ? <MessageCard title="Catalog item" message={error} tone="error" /> : null}
      <ContentCard style={styles.card}>
        <NativeFormField label="Item name" onChangeText={setName} placeholder="e.g. Sourdough loaf" value={name} />
      </ContentCard>
      <ContentCard style={styles.card}>
        <Text style={styles.sectionTitle}>Options and prices</Text>
        <Text style={styles.hint}>Every item needs at least one option. Use “Regular” for the standard version.</Text>
        {options.map((option, index) => (
          <View key={index}>
            <Pressable accessibilityLabel={`Edit ${option.name}, $${option.price.toFixed(2)}`} accessibilityRole="button" accessibilityState={{ expanded: editingIndex === index }} onPress={() => { setEditingIndex(editingIndex === index ? null : index); setAddingOption(false); }} style={styles.optionRow}>
              <Text numberOfLines={2} style={styles.optionName}>{option.name}</Text>
              <Text style={styles.optionPrice}>${option.price.toFixed(2)}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            {editingIndex === index ? (
              <>
                <OptionAddForm key={`edit-${index}`} initialOption={option} existingNames={options.filter((_, itemIndex) => itemIndex !== index).map((item) => item.name)} onAdd={(updated) => { setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? updated : item)); setEditingIndex(null); }} />
                <View style={styles.optionActions}>
                  <Pressable accessibilityLabel={`Remove option ${option.name}`} accessibilityRole="button" hitSlop={8} onPress={() => { setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index)); setEditingIndex(null); }}>
                    <Text style={styles.remove}>Remove</Text>
                  </Pressable>
                  <NativeButton label="Cancel" onPress={() => setEditingIndex(null)} variant="text" />
                </View>
              </>
            ) : null}
          </View>
        ))}
        {!options.length && !addingOption ? <Text style={styles.hint}>No options added yet.</Text> : null}
        {addingOption ? (
          <>
            <OptionAddForm existingNames={options.map((option) => option.name)} onAdd={(option) => { setOptions((current) => [...current, option]); setAddingOption(false); }} />
            <NativeButton label="Cancel" onPress={() => setAddingOption(false)} variant="text" />
          </>
        ) : <NativeButton label="Add option" onPress={() => { setEditingIndex(null); setAddingOption(true); }} variant="outlined" />}
      </ContentCard>
      <NativeButton disabled={saving || !name.trim() || !options.length || addingOption || editingIndex !== null} label={saving ? "Saving…" : "Save item"} onPress={() => void saveItem()} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  optionName: { flex: 1, color: colors.espresso, fontSize: 14, fontWeight: "600" },
  optionPrice: { color: colors.teal, fontSize: 13, fontWeight: "700" },
  chevron: { color: colors.mutedText, fontSize: 22 },
  optionActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  remove: { color: colors.brick, fontSize: 13, fontWeight: "700" },
});
