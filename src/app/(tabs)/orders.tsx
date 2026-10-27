import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { OrderCard } from "@/components/order-card";
import { AddFab, SearchField } from "@/components/ui/design";
import { NativeSegmentedControl } from "@/components/ui/native-segmented-control";
import { MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { listOrders, type OrderRecord } from "@/lib/workspace";
import type { OrderStatus } from "@/domain/orders";
import { colors, spacing } from "@/theme/tokens";

type OrderView = "Active" | "Completed" | "Cancelled";

function isCompleted(order: OrderRecord) {
  return order.status === "Fulfilled" && order.paid;
}

function belongsInView(order: OrderRecord, view: OrderView) {
  if (view === "Cancelled") return order.status === "Cancelled";
  if (view === "Completed") return isCompleted(order);
  return order.status !== "Cancelled" && !isCompleted(order);
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [orderView, setOrderView] = useState<OrderView>("Active");
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
      const matchesView = belongsInView(order, orderView);
      const matchesSearch =
        !query ||
        order.number.toLocaleLowerCase().includes(query) ||
        order.customer.toLocaleLowerCase().includes(query);
      return matchesView && matchesSearch;
    });
  }, [orderView, orders, search]);

  const hasOrdersInView = orders.some((order) => belongsInView(order, orderView));

  const header = (
    <View style={styles.listHeader}>
      <ScreenHeader title="Orders" subtitle="A clear view of every order in the queue." />
      <NativeSegmentedControl
        onChange={setOrderView}
        options={(["Active", "Completed", "Cancelled"] as const).map((view) => ({
          value: view,
          label: `${view} (${orders.filter((order) => belongsInView(order, view)).length})`,
        }))}
        value={orderView}
      />
      <SearchField
        accessibilityLabel="Search orders or customers"
        onChangeText={setSearch}
        placeholder="Order number or customer"
        value={search}
      />
      {error ? <MessageCard title="Orders unavailable" message={error} tone="error" /> : null}
      {!loading && !error && visibleOrders.length === 0 ? (
        <MessageCard
          title={hasOrdersInView ? "No matching orders" : `No ${orderView.toLowerCase()} orders yet`}
          message={hasOrdersInView ? "Try another search." : orderView === "Completed" ? "Orders move here when they are fulfilled and paid." : orderView === "Cancelled" ? "Cancelled orders will be kept here." : "Add an order to get started. Fulfilled but unpaid orders remain active."}
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
      <AddFab label="Add order" onPress={() => router.push("/order/new")} />
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
    paddingBottom: 110,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  viewSwitch: { flexDirection: "row", padding: 3, borderRadius: 13, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  viewButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  viewButtonActive: { backgroundColor: colors.teal },
  viewButtonText: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  viewButtonTextActive: { color: colors.card },
});
