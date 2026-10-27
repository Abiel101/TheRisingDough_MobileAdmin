import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar, AddFab, SearchField } from "@/components/ui/design";
import { MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { listCustomers, type CustomerRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
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

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Customers" subtitle="Browse customer records and open one for contact details." />
      <SearchField
        accessibilityLabel="Search saved customers"
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
        renderItem={({ item, index }) => (
          <Pressable
            accessibilityLabel={`View details for ${item.name || item.phone}`}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/customer/[id]", params: { id: item.id } })}
            style={({ pressed }) => [styles.customerCard, pressed && styles.pressed]}
          >
            <Avatar index={index} name={item.name || item.phone} />
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
      <AddFab label="Add customer" onPress={() => { setError(""); router.push("/customer/new"); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 110, gap: spacing.sm },
  listHeader: { gap: spacing.md, marginBottom: spacing.xs },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.76 },
  customerCopy: { flex: 1, minWidth: 0, gap: 3 },
  customerName: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  customerDetail: { color: colors.mutedText, fontSize: 12 },
  chevron: { color: colors.teal, fontSize: 25, lineHeight: 26 },
});
