import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { groupLinesByItem, summarizeLineGroup } from "@/domain/orders";
import { SearchField } from "@/components/ui/design";
import { NativeSegmentedControl } from "@/components/ui/native-segmented-control";
import { MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { getHolidayRequestsSeenAt, markHolidayRequestsSeen } from "@/lib/approval-inbox";
import { listHolidayRequestActivity, type HolidayRequestActivity } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

type RequestView = "New" | "Converted";

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function RequestsScreen() {
  const [requests, setRequests] = useState<HolidayRequestActivity[]>([]);
  const [view, setView] = useState<RequestView>("New");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await listHolidayRequestActivity();
      setRequests(next);
      setError("");
      const previousSeenAt = await getHolidayRequestsSeenAt();
      if (next.some((request) => new Date(request.createdAt).getTime() > previousSeenAt)) {
        await markHolidayRequestsSeen();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load website requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void Promise.resolve().then(load); }, [load]));

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return requests.filter((request) => {
      const matchesView = view === "New" ? request.status === "pending" : request.status === "converted";
      const itemNames = request.requestedItems.map((item) => item.productName);
      const matchesSearch = !query || [request.id, request.sourceOrderId, request.customer, request.number, request.phone, request.email, request.notes, ...itemNames]
        .some((value) => value.toLocaleLowerCase().includes(query));
      return matchesView && matchesSearch;
    });
  }, [requests, search, view]);

  const renderRequest = ({ item }: { item: HolidayRequestActivity }) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/request/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.reference}>REQUEST · {item.number}</Text>
          <Text style={styles.customer}>{item.customer || item.phone}</Text>
          <Text selectable style={styles.contact}>{item.phone}{item.email ? ` · ${item.email}` : ""}</Text>
        </View>
        <View style={[styles.status, item.status === "converted" && styles.statusConverted]}>
          <Text style={[styles.statusText, item.status === "converted" && styles.statusTextConverted]}>
            {item.status === "converted" ? "Order started" : "New"}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>Requested pickup {formatDate(item.dueDate)}</Text>
      {item.requestedItems.length ? (
        <Text numberOfLines={2} style={styles.itemsPreview}>
          {groupLinesByItem(item.requestedItems.map((requested) => ({ ...requested, name: requested.productName }))).map(summarizeLineGroup).join("   ·   ")}
        </Text>
      ) : null}
      {item.notes ? <Text numberOfLines={3} style={styles.notes}>{item.notes}</Text> : null}
      <Text style={styles.openHint}>View request →</Text>
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <ScreenHeader title="Requests" subtitle="Website requests waiting for you to shape them into orders." />
      <NativeSegmentedControl
        onChange={setView}
        options={[
          { value: "New", label: `New (${requests.filter((request) => request.status === "pending").length})` },
          { value: "Converted", label: `Order started (${requests.filter((request) => request.status === "converted").length})` },
        ]}
        value={view}
      />
      <SearchField accessibilityLabel="Search requests" onChangeText={setSearch} placeholder="Customer, phone, or request" value={search} />
      {error ? <MessageCard title="Requests unavailable" message={error} tone="error" /> : null}
      {!loading && !error && visibleRequests.length === 0 ? (
        <MessageCard
          title={view === "New" ? "No new requests" : "No orders started from requests"}
          message={view === "New" ? "New Thanksgiving requests from your website will show up here." : "Requests stay here after you start a customer order."}
        />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <FlatList
        contentContainerStyle={styles.content}
        data={error ? [] : visibleRequests}
        keyExtractor={(request) => request.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={colors.teal} />}
        renderItem={renderRequest}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  card: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.card, padding: spacing.md },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cardCopy: { flex: 1, gap: 4 },
  customer: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  reference: { color: colors.mutedText, fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  contact: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  meta: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  itemsPreview: { color: colors.espresso, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  status: { borderRadius: 999, backgroundColor: colors.cream, paddingHorizontal: 10, paddingVertical: 5 },
  statusConverted: { backgroundColor: "#E5EEE5" },
  statusText: { color: colors.brick, fontSize: 11, fontWeight: "700" },
  statusTextConverted: { color: colors.sage, fontSize: 11, fontWeight: "700" },
  notes: { color: colors.espresso, fontSize: 13, lineHeight: 19 },
  openHint: { color: colors.teal, fontSize: 13, fontWeight: "700" },
});
