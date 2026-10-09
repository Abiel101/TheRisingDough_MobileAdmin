import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeText } from "@/components/ui/native-text";
import { ContentCard, FormField, MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { addCustomer, listCustomers, type CustomerRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export default function CustomersScreen() {
  const { session } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const nextCustomers = await listCustomers();
      setCustomers(nextCustomers);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(load);
    }, [load]),
  );

  const query = search.trim().toLocaleLowerCase();
  const visibleCustomers = query
    ? customers.filter((customer) =>
        [customer.name, customer.phone, customer.email].some((value) => value.toLocaleLowerCase().includes(query)),
      )
    : customers;

  async function handleAddCustomer() {
    if (!session?.user.id) return;
    if (!phone.trim()) {
      setError("A phone number is required to add a customer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customer = await addCustomer(session.user.id, { name, phone, email, address });
      setCustomers((current) => [...current, customer].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setShowForm(false);
      router.push({ pathname: "/customer/[id]", params: { id: customer.id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this customer.");
    } finally {
      setSaving(false);
    }
  }

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Customers" subtitle="Browse customer records and open one for contact details." />
      <ContentCard style={styles.summaryCard}>
        <Text style={styles.summaryCount}>{customers.length}</Text>
        <Text style={styles.summaryLabel}>saved customers</Text>
      </ContentCard>

      <View style={styles.actionRow}>
        <Text style={styles.sectionTitle}>Customer list</Text>
        <NativeButton
          label={showForm ? "Cancel" : "Add customer"}
          onPress={() => {
            setError("");
            setShowForm((visible) => !visible);
          }}
          variant={showForm ? "text" : "filled"}
        />
      </View>

      {showForm ? (
        <ContentCard style={styles.form}>
          <NativeText textStyle={styles.formTitle}>New customer</NativeText>
          <FormField label="Name (optional)" onChangeText={setName} placeholder="Customer name" value={name} />
          <FormField
            autoComplete="tel"
            keyboardType="phone-pad"
            label="Phone number (required)"
            onChangeText={setPhone}
            placeholder="Phone number"
            value={phone}
          />
          <FormField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email (optional)"
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />
          <FormField label="Address (optional)" onChangeText={setAddress} placeholder="Street address" value={address} />
          <NativeButton disabled={saving || !phone.trim()} label={saving ? "Saving…" : "Save customer"} onPress={handleAddCustomer} />
        </ContentCard>
      ) : null}

      <FormField
        accessibilityLabel="Search saved customers"
        label="Search customers"
        onChangeText={setSearch}
        placeholder="Name, phone, or email"
        value={search}
      />
      {error ? <MessageCard title="Customer list" message={error} tone="error" /> : null}
      {!loading && !error && visibleCustomers.length === 0 ? (
        <MessageCard
          title={customers.length ? "No matching customers" : "No customers yet"}
          message={customers.length ? "Try another search." : "Add a customer to make repeat orders faster."}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={error && customers.length === 0 ? [] : visibleCustomers}
        keyExtractor={(customer) => customer.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={colors.teal} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`View details for ${item.name || item.phone}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/customer/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.customerCard, pressed && styles.pressed]}
          >
            <View style={styles.customerCopy}>
              <Text numberOfLines={2} style={styles.customerName}>{item.name || "Customer"}</Text>
              <Text numberOfLines={1} style={styles.customerDetail}>{item.phone}</Text>
              {item.email ? <Text numberOfLines={1} style={styles.customerDetail}>{item.email}</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  listHeader: { gap: spacing.md, marginBottom: spacing.xs },
  summaryCard: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, padding: spacing.md },
  summaryCount: { color: colors.teal, fontSize: 22, fontWeight: "700" },
  summaryLabel: { color: colors.mutedText, fontSize: 13 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  form: { gap: spacing.md },
  formTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.76 },
  customerCopy: { flex: 1, minWidth: 0, gap: 3 },
  customerName: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  customerDetail: { color: colors.mutedText, fontSize: 12 },
  chevron: { color: colors.teal, fontSize: 25, lineHeight: 26 },
});
