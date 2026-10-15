import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { NativeButton } from "@/components/ui/native-button";
import { NativeConfirmButton } from "@/components/ui/native-confirm-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { deleteCustomer, getCustomer, updateCustomer, type CustomerRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export default function CustomerDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("This customer link is missing its customer ID.");
      setLoading(false);
      return;
    }
    try {
      const result = await getCustomer(id);
      setCustomer(result);
      if (result) {
        setName(result.name);
        setPhone(result.phone);
        setEmail(result.email);
        setAddress(result.address);
      }
      setError(result ? "" : "This customer could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this customer.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  function toggleEditing() {
    if (!customer) return;
    if (editing) {
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email);
      setAddress(customer.address);
      setError("");
      setEditing(false);
      return;
    }
    setEditing(true);
  }

  async function saveChanges() {
    if (!customer) return;
    setSaving(true);
    setError("");
    try {
      await updateCustomer(customer.id, { name, phone, email, address });
      setCustomer({ ...customer, name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this customer.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCustomer() {
    if (!customer) return;
    setSaving(true);
    setError("");
    try {
      await deleteCustomer(customer.id);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppScreen>
      <SheetHeader
        title={customer?.name || "Customer details"}
        subtitle="Saved customer information."
        showSettings={false}
        rightAction={customer ? <NativeButton label={editing ? "Cancel" : "Edit"} onPress={toggleEditing} variant="text" /> : undefined}
      />
      {error ? <MessageCard title="Customer profile" message={error} tone="error" /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading customer…</Text></View>
      ) : customer ? (
        <ContentCard style={styles.card}>
          <Text style={styles.sectionTitle}>{editing ? "Edit customer" : "Contact information"}</Text>
          {editing ? (
            <>
              <NativeFormField label="Name (optional)" onChangeText={setName} placeholder="Customer name" value={name} />
              <NativeFormField autoComplete="tel" keyboardType="phone-pad" label="Phone number" onChangeText={setPhone} placeholder="Phone number" value={phone} />
              <NativeFormField autoCapitalize="none" keyboardType="email-address" label="Email (optional)" onChangeText={setEmail} placeholder="name@example.com" value={email} />
              <NativeFormField label="Address (optional)" onChangeText={setAddress} placeholder="Street address" value={address} />
              <View style={styles.actions}>
                <NativeConfirmButton
                  label="Delete customer"
                  title={`Delete ${customer.name || "this customer"}?`}
                  message="Existing orders will stay saved with this customer name."
                  confirmLabel="Delete customer"
                  onConfirm={removeCustomer}
                />
                <NativeButton disabled={saving || !phone.trim()} label={saving ? "Saving…" : "Save changes"} onPress={() => void saveChanges()} />
              </View>
            </>
          ) : (
            <>
              <DetailField label="Name" value={customer.name || "Not provided"} />
              <DetailField label="Phone" value={customer.phone || "Not provided"} selectable />
              <DetailField label="Email" value={customer.email || "Not provided"} selectable />
              <DetailField label="Address" value={customer.address || "Not provided"} />
              <DetailField label="Customer since" value={new Date(customer.createdAt).toLocaleDateString()} />
            </>
          )}
        </ContentCard>
      ) : (
        <MessageCard title="Customer unavailable" message={error || "This customer could not be found."} tone="error" />
      )}
    </AppScreen>
  );
}

function DetailField({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable={selectable} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  field: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  label: { color: colors.mutedText, fontSize: 12 },
  value: { color: colors.espresso, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
});
