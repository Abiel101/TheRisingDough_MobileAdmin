import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { hasOptionLabel } from "@/domain/orders";
import type { ProductOptionInput } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

/** Entry form for one catalog option; the price is optional and falls back to the item's price. */
export function OptionAddForm({
  existingNames,
  onAdd,
  disabled,
}: {
  existingNames: readonly string[];
  onAdd: (option: ProductOptionInput) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    const parsedPrice = price.trim() ? Number(price) : null;
    if (!trimmed) return;
    if (!hasOptionLabel(trimmed)) {
      setError("“Default” is reserved. Choose a different option name.");
      return;
    }
    if (existingNames.some((existing) => existing.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError(`“${trimmed}” is already listed.`);
      return;
    }
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError("Enter a price of zero or more, or leave it blank to use the item price.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({ name: trimmed, price: parsedPrice });
      setName("");
      setPrice("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this option.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <NativeFormField label="Option name" onChangeText={setName} placeholder="e.g. Veggie" value={name} />
      <NativeFormField keyboardType="decimal-pad" label="Option price (optional)" onChangeText={setPrice} placeholder="Same as item price" value={price} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <NativeButton disabled={disabled || busy || !name.trim()} label={busy ? "Adding…" : "Add option"} onPress={() => void submit()} variant="outlined" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  error: { color: colors.brick, fontSize: 12, lineHeight: 17 },
});
