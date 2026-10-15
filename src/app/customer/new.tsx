import { useState } from "react";
import { router } from "expo-router";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { addCustomer } from "@/lib/workspace";
import { spacing } from "@/theme/tokens";
import { StyleSheet } from "react-native";

export default function NewCustomerScreen() {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!session?.user.id) return;
    if (!phone.trim()) {
      setError("A phone number is required to add a customer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addCustomer(session.user.id, { name, phone, email, address });
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen contentContainerStyle={styles.screen}>
      <SheetHeader showSettings={false} title="New customer" subtitle="Add contact information for a customer." />
      {error ? <MessageCard title="Customer form" message={error} tone="error" /> : null}
      <ContentCard style={styles.card}>
        <NativeFormField label="Name (optional)" onChangeText={setName} placeholder="Customer name" value={name} />
        <NativeFormField autoComplete="tel" keyboardType="phone-pad" label="Phone number (required)" onChangeText={setPhone} placeholder="Phone number" value={phone} />
        <NativeFormField autoCapitalize="none" keyboardType="email-address" label="Email (optional)" onChangeText={setEmail} placeholder="name@example.com" value={email} />
        <NativeFormField label="Address (optional)" onChangeText={setAddress} placeholder="Street address" value={address} />
        <NativeButton disabled={saving || !phone.trim()} label={saving ? "Saving customer…" : "Save customer"} onPress={() => void save()} />
      </ContentCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  card: { gap: spacing.md },
});
