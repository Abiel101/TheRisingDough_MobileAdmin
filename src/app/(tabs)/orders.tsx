import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { OrderCard } from "@/components/order-card";
import { ContentCard, FormField, MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { listOrders, type OrderRecord } from "@/lib/workspace";
import { orderStatuses, orderStatusLabels, type OrderStatus } from "@/domain/orders";
import { colors, spacing } from "@/theme/tokens";

const filters = ["All", ...orderStatuses] as const;
type Filter = (typeof filters)[number];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const nextOrders = await listOrders({ limit: 250 });
      setOrders(nextOrders);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStatusUpdated = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
  }, []);

  function refresh() {
    setLoading(true);
    void load();
  }

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(load);
    }, [load]),
  );

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesStatus = filter === "All" || order.status === filter;
      const matchesSearch =
        !query ||
        order.number.toLocaleLowerCase().includes(query) ||
        order.customer.toLocaleLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [filter, orders, search]);

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Orders" subtitle="A clear view of every order in the queue." />
      <ContentCard style={styles.summaryCard}>
        <Text style={styles.summaryCount}>{orders.length}</Text>
        <Text style={styles.summaryLabel}>recent orders loaded</Text>
      </ContentCard>
      <FormField
        accessibilityLabel="Search orders or customers"
        label="Search"
        onChangeText={setSearch}
        placeholder="Order number or customer"
        value={search}
      />
      <View style={styles.filterList}>
        {filters.map((option) => {
          const active = option === filter;
          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              style={[styles.filterChip, active && styles.activeFilter]}
              onPress={() => setFilter(option)}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {option === "All" ? option : orderStatusLabels[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <MessageCard title="Orders unavailable" message={error} tone="error" /> : null}
      {!loading && !error && visibleOrders.length === 0 ? (
        <MessageCard
          title={orders.length ? "No matching orders" : "No orders yet"}
          message={orders.length ? "Try another search or status filter." : "Orders from your workspace will appear here."}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={error ? [] : visibleOrders}
        keyExtractor={(order) => order.id}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.teal} />
        }
        renderItem={({ item }) => <OrderCard order={item} onStatusUpdated={handleStatusUpdated} />}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  summaryCount: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: "700",
  },
  summaryLabel: {
    color: colors.mutedText,
    fontSize: 13,
  },
  filterList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    gap: 0,
  },
  activeFilter: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  filterText: {
    color: colors.espresso,
    fontSize: 12,
    fontWeight: "600",
  },
  activeFilterText: {
    color: colors.card,
  },
  filterChipText: { color: colors.espresso, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: colors.card },
});
