import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { countUnseenNotifications } from "@/lib/approval-inbox";
import { colors } from "@/theme/tokens";

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    countUnseenNotifications().then(setCount, () => undefined);
  }, []);

  useFocusEffect(refresh);
  useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <Pressable
      accessibilityLabel={count ? `Notifications, ${count} new` : "Notifications"}
      accessibilityRole="button"
      onPress={() => router.push("/notifications")}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.bell}
      >
        <View style={styles.bellBody} />
        <View style={styles.bellBase} />
        <View style={styles.bellClapper} />
      </View>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.72 },
  bell: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBody: {
    position: "absolute",
    top: 2,
    width: 13,
    height: 12,
    borderTopWidth: 1.6,
    borderLeftWidth: 1.6,
    borderRightWidth: 1.6,
    borderColor: colors.teal,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bellBase: {
    position: "absolute",
    top: 14,
    width: 17,
    borderTopWidth: 1.6,
    borderColor: colors.teal,
    borderRadius: 2,
  },
  bellClapper: {
    position: "absolute",
    top: 16,
    width: 3,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.teal,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.brick,
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.card, fontSize: 10, fontWeight: "800" },
});
