import { useCallback, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { groupLinesByItem, summarizeLineGroup } from "@/domain/orders";
import { SearchField } from "@/components/ui/design";
import { NativeSegmentedControl } from "@/components/ui/native-segmented-control";
import { MessageCard, ScreenHeader } from "@/components/ui/screen-primitives";
import { loadInbox } from "@/lib/approval-inbox";
import { MANAGER_PASSWORD } from "@/lib/manager";
import { deleteHolidayRequest, type HolidayRequestActivity } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

type RequestView = "New" | "Processed";

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default function RequestsScreen() {
  const [requests, setRequests] = useState<HolidayRequestActivity[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<HolidayRequestActivity | null>(null);
  const [managerCode, setManagerCode] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [view, setView] = useState<RequestView>("New");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const inbox = await loadInbox();
      setRequests(inbox.requests);
      setUnreadIds(inbox.unreadRequestIds);
      setError("");
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

  function closeDelete() {
    setPendingDelete(null);
    setManagerCode("");
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (managerCode !== MANAGER_PASSWORD) {
      setDeleteError("Incorrect manager code.");
      return;
    }
    setDeleting(true);
    try {
      await deleteHolidayRequest(pendingDelete.id);
      setRequests((current) => current.filter((request) => request.id !== pendingDelete.id));
      closeDelete();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Could not delete this request.");
    } finally {
      setDeleting(false);
    }
  }

  const renderRequest = ({ item }: { item: HolidayRequestActivity }) => (
    <Pressable
      accessibilityHint="Press and hold to delete this request"
      accessibilityRole="button"
      delayLongPress={450}
      onLongPress={() => setPendingDelete(item)}
      onPress={() => router.push({ pathname: "/request/[id]", params: { id: item.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardCopy}>
          <Text style={styles.reference}>REQUEST · {item.number}</Text>
          <Text style={styles.customer}>{item.customer || item.phone}</Text>
          <Text selectable style={styles.contact}>{item.phone}{item.email ? ` · ${item.email}` : ""}</Text>
        </View>
        {item.status === "converted" || unreadIds.has(item.id) ? (
          <View style={[styles.status, item.status === "converted" && styles.statusConverted]}>
            <Text style={[styles.statusText, item.status === "converted" && styles.statusTextConverted]}>
              {item.status === "converted" ? "Processed" : "New"}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.meta}>Requested pickup {formatDate(item.dueDate)}</Text>
      {item.requestedItems.length ? (
        <Text numberOfLines={2} style={styles.itemsPreview}>
          {groupLinesByItem(item.requestedItems.map((requested) => ({ ...requested, name: requested.productName }))).map(summarizeLineGroup).join("   ·   ")}
        </Text>
      ) : null}
      {item.notes ? <Text numberOfLines={3} style={styles.notes}>{item.notes}</Text> : null}
      <Text style={styles.openHint}>View request →  <Text style={styles.holdHint}>Hold to delete</Text></Text>
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <ScreenHeader title="Requests" subtitle="Website requests waiting for you to shape them into orders." />
      <NativeSegmentedControl
        onChange={setView}
        options={[
          { value: "New", label: "New" },
          { value: "Processed", label: "Done" },
        ]}
        value={view}
      />
      <SearchField accessibilityLabel="Search requests" onChangeText={setSearch} placeholder="Customer, phone, or request" value={search} />
      {error ? <MessageCard title="Requests unavailable" message={error} tone="error" /> : null}
      {!loading && !error && visibleRequests.length === 0 ? (
        <MessageCard
          title={view === "New" ? "No new requests" : "No processed requests"}
          message={view === "New" ? "New Thanksgiving requests from your website will show up here." : "Requests move here once they become an order. Find the order in the Orders tab."}
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
      <Modal animationType="fade" onRequestClose={closeDelete} transparent visible={Boolean(pendingDelete)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete this request?</Text>
            <Text style={styles.modalBody}>
              {pendingDelete ? `${pendingDelete.customer || pendingDelete.phone} · ${pendingDelete.number}. ` : ""}
              This permanently removes the request. Enter the manager code to continue.
            </Text>
            <TextInput
              accessibilityLabel="Manager code"
              autoFocus
              keyboardType="number-pad"
              onChangeText={(text) => { setManagerCode(text); setDeleteError(""); }}
              placeholder="Manager code"
              placeholderTextColor={colors.mutedText}
              secureTextEntry
              style={styles.modalInput}
              value={managerCode}
            />
            {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={closeDelete} style={[styles.modalButton, styles.modalCancel]}>
                <Text style={styles.modalCancelText}>Keep request</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting || !managerCode}
                onPress={() => void confirmDelete()}
                style={[styles.modalButton, styles.modalDelete, (deleting || !managerCode) && styles.modalDisabled]}
              >
                <Text style={styles.modalDeleteText}>{deleting ? "Deleting…" : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  header: { gap: spacing.lg, marginBottom: spacing.sm },
  card: { gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: 10 },
  pressed: { opacity: 0.75 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cardCopy: { flex: 1, gap: 2 },
  customer: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  reference: { color: colors.mutedText, fontSize: 9, fontWeight: "700", letterSpacing: 0.6 },
  contact: { color: colors.mutedText, fontSize: 11, lineHeight: 15 },
  meta: { color: colors.mutedText, fontSize: 11, lineHeight: 15 },
  itemsPreview: { color: colors.espresso, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  status: { borderRadius: 999, backgroundColor: colors.cream, paddingHorizontal: 7, paddingVertical: 2 },
  statusConverted: { backgroundColor: "#E5EEE5" },
  statusText: { color: colors.brick, fontSize: 10, fontWeight: "700" },
  statusTextConverted: { color: colors.sage, fontSize: 10, fontWeight: "700" },
  notes: { color: colors.espresso, fontSize: 12, lineHeight: 17 },
  openHint: { color: colors.teal, fontSize: 12, fontWeight: "700" },
  holdHint: { color: colors.mutedText, fontSize: 10, fontWeight: "500" },
  modalRoot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(48,32,23,0.5)", padding: spacing.lg },
  modalCard: { width: "100%", maxWidth: 420, gap: spacing.md, borderRadius: 20, backgroundColor: colors.card, padding: spacing.lg },
  modalTitle: { color: colors.espresso, fontSize: 18, fontWeight: "700" },
  modalBody: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  modalInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.parchment, color: colors.espresso, fontSize: 18, paddingHorizontal: spacing.md },
  modalError: { color: colors.brick, fontSize: 13 },
  modalActions: { flexDirection: "row", gap: spacing.sm },
  modalButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  modalCancel: { borderWidth: 1.5, borderColor: colors.teal },
  modalCancelText: { color: colors.teal, fontSize: 15, fontWeight: "700" },
  modalDelete: { backgroundColor: colors.brick },
  modalDeleteText: { color: colors.card, fontSize: 15, fontWeight: "700" },
  modalDisabled: { opacity: 0.5 },
});
