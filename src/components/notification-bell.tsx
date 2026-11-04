import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { countUnseenApprovals } from "@/lib/approval-inbox";
import { colors } from "@/theme/tokens";

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    countUnseenApprovals().then(setCount, () => undefined);
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
      <Text style={styles.glyph}>🔔</Text>
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
  glyph: { fontSize: 16 },
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
