import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OrderCard } from "@/components/order-card";
import {
  AppScreen,
  ContentCard,
  LoadingState,
  MessageCard,
  ScreenHeader,
} from "@/components/ui/screen-primitives";
import { listOrders, type OrderRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeMonthGrid(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    () => null,
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells[firstWeekday + day - 1] = new Date(year, monthIndex, day);
  }
  return cells;
}

export default function CalendarScreen() {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const monthStart = useMemo(() => dateKey(month), [month]);
  const monthEnd = useMemo(
    () => dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
    [month],
  );
  const grid = useMemo(() => makeMonthGrid(month), [month]);
  const weeks = useMemo(
    () => Array.from({ length: grid.length / 7 }, (_, index) => grid.slice(index * 7, index * 7 + 7)),
    [grid],
  );

  const loadMonth = useCallback(async () => {
    try {
      const nextOrders = await listOrders({ startDate: monthStart, endDateExclusive: monthEnd, limit: 500 });
      setOrders(nextOrders);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load calendar orders.");
    } finally {
      setLoading(false);
    }
  }, [monthEnd, monthStart]);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(loadMonth);
    }, [loadMonth]),
  );

  const ordersByDate = useMemo(() => {
    const map = new Map<string, OrderRecord[]>();
    for (const order of orders) {
      const dayOrders = map.get(order.dueDate) ?? [];
      dayOrders.push(order);
      map.set(order.dueDate, dayOrders);
    }
    return map;
  }, [orders]);
  const selectedOrders = ordersByDate.get(selectedDate) ?? [];
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function changeMonth(offset: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setLoading(true);
    setError("");
    setMonth(next);
    setSelectedDate(dateKey(next));
  }

  return (
    <AppScreen>
      <ScreenHeader title="Calendar" subtitle="Orders by their pickup date." />

      <ContentCard style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.monthArrow}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <Pressable accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.monthArrow}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <View key={`${day}-${index}`} style={styles.dayCell}>
              <Text style={styles.weekday}>{day}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={`blank-${weekIndex}-${dayIndex}`} style={styles.dateCell} />;
                const key = dateKey(day);
                const count = ordersByDate.get(key)?.length ?? 0;
                const selected = key === selectedDate;
                return (
                  <Pressable
                    accessibilityLabel={`${day.toLocaleDateString(undefined, { month: "long", day: "numeric" })}${count ? `, ${count} orders` : ""}`}
                    accessibilityRole="button"
                    key={key}
                    onPress={() => setSelectedDate(key)}
                    style={[styles.dateCell, selected && styles.selectedCell]}
                  >
                    <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>
                      {day.getDate()}
                    </Text>
                    <View style={styles.dots}>
                      {Array.from({ length: Math.min(count, 3) }, (_, dotIndex) => (
                        <View key={dotIndex} style={[styles.dot, selected && styles.selectedDot]} />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ContentCard>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>
          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
        <Text style={styles.sectionCount}>
          {selectedOrders.length} order{selectedOrders.length === 1 ? "" : "s"}
        </Text>
      </View>

      {loading ? <LoadingState label="Loading this month’s orders…" /> : null}
      {!loading && error ? (
        <MessageCard title="Calendar unavailable" message={error} tone="error" />
      ) : null}
      {!loading && !error && selectedOrders.length === 0 ? (
        <MessageCard title="No orders on this day" message="Choose another date to see its due orders." />
      ) : null}
      {!loading && !error ? selectedOrders.map((order) => <OrderCard key={order.id} order={order} />) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthArrow: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.parchment,
  },
  arrowText: {
    color: colors.teal,
    fontSize: 28,
    lineHeight: 32,
    textAlign: "center",
  },
  monthTitle: {
    color: colors.espresso,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekday: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  grid: {
    gap: spacing.xs,
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  dateCell: {
    flex: 1,
    minWidth: 0,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  selectedCell: {
    backgroundColor: colors.teal,
  },
  dateNumber: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 16,
    textAlign: "center",
  },
  selectedDateNumber: {
    color: colors.card,
    fontWeight: "700",
  },
  dots: {
    height: 5,
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mustard,
  },
  selectedDot: {
    backgroundColor: colors.card,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
    color: colors.espresso,
    fontSize: 16,
    fontWeight: "700",
  },
  sectionCount: {
    color: colors.mutedText,
    fontSize: 12,
  },
});
