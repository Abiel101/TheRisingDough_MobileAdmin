import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { router, useFocusEffect } from "expo-router";

import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { loadInbox, markAllRead, markApprovalRead, markRequestRead, type InboxSnapshot } from "@/lib/approval-inbox";
import type { ApprovalActivity, HolidayRequestActivity } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

const money = (value: number) => `$${value.toFixed(2)}`;

export default function NotificationsScreen() {
  const [inbox, setInbox] = useState<InboxSnapshot | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadInbox()
        .then((next) => {
          if (!active) return;
          setInbox(next);
          setError("");
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "Could not load notifications.");
        });
      return () => { active = false; };
    }, []),
  );

  const requests = inbox?.requests.filter((item) => inbox.unreadRequestIds.has(item.id)) ?? [];
  const approved = inbox?.approvals.filter((item) => item.status === "approved" && inbox.unreadApprovalIds.has(item.id)) ?? [];
  const declined = inbox?.approvals.filter((item) => item.status === "declined" && inbox.unreadApprovalIds.has(item.id)) ?? [];
  const unreadCount = requests.length + approved.length + declined.length;

  const dismiss = (kind: "request" | "approval", id: string) => {
    setInbox((current) => {
      if (!current) return current;
      const unreadRequestIds = new Set(current.unreadRequestIds);
      const unreadApprovalIds = new Set(current.unreadApprovalIds);
      (kind === "request" ? unreadRequestIds : unreadApprovalIds).delete(id);
      return { ...current, unreadRequestIds, unreadApprovalIds };
    });
    void (kind === "request" ? markRequestRead(id) : markApprovalRead(id));
  };

  const renderRequest = (item: HolidayRequestActivity) => (
    <Pressable
      key={item.id}
      onPress={() => {
        dismiss("request", item.id);
        router.push({ pathname: "/request/[id]", params: { id: item.id } });
      }}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.customer} · {item.number}</Text>
        <Text style={styles.hint}>Thanksgiving request · Delivery {new Date(`${item.dueDate}T12:00:00`).toLocaleDateString()}</Text>
        {item.notes ? <Text numberOfLines={3} style={styles.requestNotes}>{item.notes}</Text> : null}
      </View>
      <View style={styles.dot} />
    </Pressable>
  );

  const renderApproval = (item: ApprovalActivity) => (
    <Pressable
      key={item.id}
      onPress={() => {
        dismiss("approval", item.id);
        router.push({ pathname: "/order/[id]", params: { id: item.id } });
      }}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>
          {item.status === "approved"
            ? `${item.approvedByName || item.customer} approved ${item.number}`
            : `${item.customer} declined ${item.number}`}
        </Text>
        <Text style={styles.hint}>
          {item.status === "approved"
            ? `${item.approvedTotal != null ? `${money(item.approvedTotal)} · ` : ""}${new Date(item.approvedAt).toLocaleString()}`
            : `Declined · ${new Date(item.declinedAt).toLocaleString()}`}
        </Text>
      </View>
      <View style={styles.dot} />
    </Pressable>
  );

  const section = (title: string, rows: ReactNode[]) => (rows.length ? (
    <ContentCard>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows}
    </ContentCard>
  ) : null);

  return (
    <AppScreen header={<SheetHeader showSettings={false} title="Notifications" subtitle="New requests and customer approvals." />}>
      {error ? <MessageCard title="Notifications unavailable" message={error} tone="error" /> : null}
      {!error && inbox && unreadCount === 0 ? (
        <MessageCard title="You're all caught up" message="New requests and customer approvals appear here until you open them." />
      ) : null}
      {unreadCount > 1 && inbox ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void markAllRead(inbox);
            setInbox({ ...inbox, unreadRequestIds: new Set(), unreadApprovalIds: new Set() });
          }}
          style={styles.markAll}
        >
          <Text style={styles.markAllText}>Mark all as read</Text>
        </Pressable>
      ) : null}
      {section("New requests", requests.map(renderRequest))}
      {section("Approved by customer", approved.map(renderApproval))}
      {section("Declined by customer", declined.map(renderApproval))}
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
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brick },
  markAll: { alignSelf: "flex-end", paddingVertical: spacing.xs },
  markAllText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
});
