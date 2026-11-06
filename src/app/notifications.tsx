import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import {
  getHolidayRequestsSeenAt,
  getSeenAt,
  isUnseen,
  isUnseenHolidayRequest,
  markHolidayRequestsSeen,
  markSeen,
} from "@/lib/approval-inbox";
import {
  listApprovalActivity,
  listHolidayRequestActivity,
  type ApprovalActivity,
  type HolidayRequestActivity,
} from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

const money = (value: number) => `$${value.toFixed(2)}`;

export default function NotificationsScreen() {
  const [items, setItems] = useState<ApprovalActivity[]>([]);
  const [requests, setRequests] = useState<HolidayRequestActivity[]>([]);
  const [seenAt, setSeenAt] = useState(0);
  const [requestsSeenAt, setRequestsSeenAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getSeenAt(), listApprovalActivity(), getHolidayRequestsSeenAt(), listHolidayRequestActivity()])
        .then(async ([previousSeenAt, next, previousRequestsSeenAt, nextRequests]) => {
          if (!active) return;
          setItems(next);
          setRequests(nextRequests);
          setSeenAt(previousSeenAt);
          setRequestsSeenAt(previousRequestsSeenAt);
          setError("");
          await Promise.all([markSeen(), markHolidayRequestsSeen()]);
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "Could not load notifications.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }, []),
  );

  const approved = items.filter((item) => item.status === "approved");
  const declined = items.filter((item) => item.status === "declined");
  const pending = items.filter((item) => item.status === "pending");

  const renderRequest = (item: HolidayRequestActivity) => (
    <Pressable
      key={item.id}
      onPress={() => router.push({ pathname: "/request/[id]", params: { id: item.id } })}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.customer} · {item.number}</Text>
        <Text style={styles.hint}>Thanksgiving request · Delivery {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString()}</Text>
        {item.notes ? <Text selectable style={styles.requestNotes}>{item.notes}</Text> : null}
      </View>
      {isUnseenHolidayRequest(item, requestsSeenAt) ? <View style={styles.dot} /> : null}
    </Pressable>
  );

  const renderItem = (item: ApprovalActivity) => (
    <Pressable
      key={item.id}
      onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>
          {item.status === "approved"
            ? `${item.approvedByName || item.customer} approved ${item.number}`
            : item.status === "declined"
              ? `${item.customer} declined ${item.number}`
              : `${item.customer} · ${item.number}`}
        </Text>
        <Text style={styles.hint}>
          {item.status === "approved"
            ? `${item.approvedTotal != null ? `${money(item.approvedTotal)} · ` : ""}${new Date(item.approvedAt).toLocaleString()}`
            : item.status === "declined"
              ? `Declined · ${new Date(item.declinedAt).toLocaleString()}`
              : "Waiting for the customer to approve"}
        </Text>
      </View>
      {isUnseen(item, seenAt) ? <View style={styles.dot} /> : null}
    </Pressable>
  );

  return (
    <AppScreen header={<SheetHeader showSettings={false} title="Notifications" subtitle="New requests and customer approvals." />}>
      {error ? <MessageCard title="Notifications unavailable" message={error} tone="error" /> : null}
      <ContentCard>
        <Text style={styles.sectionTitle}>New Thanksgiving requests</Text>
        {requests.length ? requests.map(renderRequest) : <Text style={styles.hint}>{loading ? "Loading…" : "No new order requests."}</Text>}
      </ContentCard>
      <ContentCard>
        <Text style={styles.sectionTitle}>Approved by customer</Text>
        {approved.length ? approved.map(renderItem) : <Text style={styles.hint}>{loading ? "Loading…" : "No approvals yet."}</Text>}
      </ContentCard>
      <ContentCard>
        <Text style={styles.sectionTitle}>Pending approval</Text>
        {pending.length ? pending.map(renderItem) : <Text style={styles.hint}>{loading ? "Loading…" : "Nothing waiting on a customer."}</Text>}
      </ContentCard>
      <ContentCard>
        <Text style={styles.sectionTitle}>Declined by customer</Text>
        {declined.length ? declined.map(renderItem) : <Text style={styles.hint}>{loading ? "Loading…" : "No declined orders."}</Text>}
      </ContentCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.espresso, fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.espresso, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  requestNotes: { color: colors.espresso, fontSize: 12, lineHeight: 17 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brick },
});
