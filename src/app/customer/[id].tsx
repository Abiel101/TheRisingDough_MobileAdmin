import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { Avatar } from "@/components/ui/design";
import { NativeButton } from "@/components/ui/native-button";
import { NativeConfirmButton } from "@/components/ui/native-confirm-button";
import { NativeFormField } from "@/components/ui/native-form-field";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { deleteCustomer, getCustomer, updateCustomer, type CustomerRecord } from "@/lib/workspace";
import { colors, serifFamily, spacing } from "@/theme/tokens";

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
    <View style={styles.root}>
    <AppScreen
      header={
        <SheetHeader
          title="Customer"
          subtitle="Saved customer information."
          showSettings={false}
          rightAction={customer ? <NativeButton label={editing ? "Cancel" : "Edit"} onPress={toggleEditing} variant="text" /> : undefined}
        />
      }
    >
      {error ? <MessageCard title="Customer profile" message={error} tone="error" /> : null}
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading customer…</Text></View>
      ) : customer ? (
        <>
        <View style={styles.hero}>
          <Avatar name={customer.name || customer.phone} size={84} />
          <Text style={styles.heroName}>{customer.name || customer.phone}</Text>
          <Text style={styles.muted}>Customer since {new Date(customer.createdAt).toLocaleDateString()}</Text>
        </View>
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
              <DetailField label="Phone" value={customer.phone || "Not provided"} selectable />
              <DetailField label="Name" value={customer.name || "Not provided"} />
              <DetailField label="Email" value={customer.email || "Not provided"} selectable />
              <DetailField label="Address" value={customer.address || "Not provided"} />
            </>
          )}
        </ContentCard>
        </>
      ) : (
        <MessageCard title="Customer unavailable" message={error || "This customer could not be found."} tone="error" />
      )}
    </AppScreen>
    {customer && !editing ? (
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/order/new", params: { customerId: customer.id } })}
          style={({ pressed }) => [styles.newOrder, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.newOrderText}>New order</Text>
        </Pressable>
      </View>
    ) : null}
    </View>
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
  root: { flex: 1, backgroundColor: colors.parchment },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  heroName: { color: colors.espresso, fontFamily: serifFamily, fontSize: 28, fontWeight: "800", textAlign: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  newOrder: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: colors.orange },
  newOrderText: { color: colors.card, fontSize: 16, fontWeight: "700" },
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  field: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  label: { color: colors.mutedText, fontSize: 12 },
  value: { color: colors.espresso, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
});
