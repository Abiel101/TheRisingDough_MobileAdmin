import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { OrderCard } from "@/components/order-card";
import type { OrderStatus } from "@/domain/orders";
import {
  AppScreen,
  ContentCard,
  LoadingState,
  MessageCard,
  ScreenHeader,
} from "@/components/ui/screen-primitives";
import { listOrders, type OrderRecord } from "@/lib/workspace";
import { registerCalendarResetHandler } from "@/lib/calendar-navigation";
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
  const [calendarView, setCalendarView] = useState<"Month" | "Week">("Week");
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const todayKey = dateKey(new Date());
  const todayIsSelected = selectedDate === todayKey;
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const resetToToday = useCallback(() => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentDay = dateKey(today);
    if (calendarView !== "Week" || selectedDate !== currentDay || dateKey(month) !== dateKey(currentMonth)) {
      setLoading(true);
    }
    setError("");
    setCalendarView("Week");
    setMonth(currentMonth);
    setSelectedDate(currentDay);
  }, [calendarView, month, selectedDate]);

  useEffect(() => registerCalendarResetHandler(resetToToday), [resetToToday]);

  const monthStart = useMemo(() => dateKey(month), [month]);
  const monthEnd = useMemo(
    () => dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)),
    [month],
  );
  const weekEnd = useMemo(() => {
    const end = new Date(`${selectedDate}T12:00:00`);
    end.setDate(end.getDate() + (6 - end.getDay()));
    return dateKey(end);
  }, [selectedDate]);
  const weekStart = useMemo(() => {
    const start = new Date(`${selectedDate}T12:00:00`);
    start.setDate(start.getDate() - start.getDay());
    return dateKey(start);
  }, [selectedDate]);
  const weekEndExclusive = useMemo(() => {
    const end = new Date(`${weekEnd}T12:00:00`);
    end.setDate(end.getDate() + 1);
    return dateKey(end);
  }, [weekEnd]);
  const ordersStart = calendarView === "Week" ? weekStart : monthStart;
  const ordersEndExclusive = todayIsSelected ? undefined : calendarView === "Week" ? weekEndExclusive : monthEnd;
  const grid = useMemo(() => makeMonthGrid(month), [month]);
  const weeks = useMemo(
    () => Array.from({ length: grid.length / 7 }, (_, index) => grid.slice(index * 7, index * 7 + 7)),
    [grid],
  );
  const selectedWeek = useMemo(() => {
    const start = new Date(`${selectedDate}T12:00:00`);
    start.setDate(start.getDate() - start.getDay());
    return [Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    })];
  }, [selectedDate]);
  const displayedWeeks = calendarView === "Month" ? weeks : selectedWeek;

  const loadMonth = useCallback(async () => {
    try {
      const nextOrders = await listOrders({ startDate: ordersStart, endDateExclusive: ordersEndExclusive, limit: todayIsSelected ? 1000 : 500 });
      setOrders(nextOrders);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load calendar orders.");
    } finally {
      setLoading(false);
    }
  }, [ordersEndExclusive, ordersStart, todayIsSelected]);

  const handleStatusUpdated = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.resolve().then(loadMonth);
    }, [loadMonth]),
  );

  const ordersByDate = useMemo(() => {
    const map = new Map<string, OrderRecord[]>();
    for (const order of orders) {
      if (order.status === "Cancelled") continue;
      const dayOrders = map.get(order.dueDate) ?? [];
      dayOrders.push(order);
      map.set(order.dueDate, dayOrders);
    }
    return map;
  }, [orders]);
  const agendaOrders = useMemo(
    () => orders
      .filter((order) => order.status !== "Cancelled" && (todayIsSelected
        ? order.dueDate >= selectedDate
        : order.dueDate === selectedDate))
      .sort((first, second) => first.dueDate.localeCompare(second.dueDate) || first.number.localeCompare(second.number)),
    [orders, selectedDate, todayIsSelected],
  );
  const agendaGroups = useMemo(() => {
    const groups = new Map<string, OrderRecord[]>();
    for (const order of agendaOrders) groups.set(order.dueDate, [...(groups.get(order.dueDate) ?? []), order]);
    return [...groups.entries()];
  }, [agendaOrders]);
  const hasOrdersToday = orders.some((order) => order.status !== "Cancelled" && order.dueDate === todayKey);
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const changeMonth = useCallback((offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setLoading(true);
    setError("");
    setMonth(next);
    setSelectedDate(dateKey(next));
  }, [month]);

  const changeWeek = useCallback((offset: number) => {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + offset * 7);
    const nextDateKey = dateKey(nextDate);
    const nextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
    if (dateKey(nextMonth) !== dateKey(month)) {
      setLoading(true);
      setError("");
      setMonth(nextMonth);
    }
    setSelectedDate(nextDateKey);
  }, [month, selectedDate]);

  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) < 60) return;
      const offset = gesture.dx < 0 ? 1 : -1;
      if (calendarView === "Week") changeWeek(offset);
      else changeMonth(offset);
    },
  }), [calendarView, changeMonth, changeWeek]);

  return (
    <AppScreen safeAreaEdges={["top"]} contentContainerStyle={styles.screenContent}>
      <ScreenHeader title="Calendar" subtitle="Orders by their pickup date." />

      <View style={styles.calendarToolbar}>
        <View style={styles.viewSwitch}>
          {(["Week", "Month"] as const).map((view) => (
            <Pressable key={view} accessibilityRole="button" accessibilityState={{ selected: calendarView === view }} onPress={() => setCalendarView(view)} style={[styles.viewButton, calendarView === view && styles.viewButtonActive]}>
              <Text style={[styles.viewButtonText, calendarView === view && styles.viewButtonTextActive]}>{view}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ContentCard {...swipeResponder.panHandlers} style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel={calendarView === "Week" ? "Previous week" : "Previous month"} onPress={() => calendarView === "Week" ? changeWeek(-1) : changeMonth(-1)} style={styles.monthArrow}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <Pressable accessibilityLabel={calendarView === "Week" ? "Next week" : "Next month"} onPress={() => calendarView === "Week" ? changeWeek(1) : changeMonth(1)} style={styles.monthArrow}>
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
          {displayedWeeks.map((week, weekIndex) => {
            const highlightedWeek = week.some((day) => day && dateKey(day) === todayKey);
            return (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={`blank-${weekIndex}-${dayIndex}`} style={[styles.dateCell, highlightedWeek && styles.weekHighlightCell]} />;
                const key = dateKey(day);
                const dayOrders = ordersByDate.get(key) ?? [];
                const count = dayOrders.length;
                const isToday = key === todayKey;
                const visibleDots = [...dayOrders]
                  .sort((first, second) => Number(second.status === "Fulfilled" && second.paid) - Number(first.status === "Fulfilled" && first.paid))
                  .slice(0, 3);
                const selected = key === selectedDate;
                return (
                  <Pressable
                    accessibilityLabel={`${day.toLocaleDateString(undefined, { month: "long", day: "numeric" })}${count ? `, ${count} orders` : ""}`}
                    accessibilityRole="button"
                    key={key}
                    onPress={() => {
                      const startOfSelectedWeek = new Date(`${key}T12:00:00`);
                      startOfSelectedWeek.setDate(startOfSelectedWeek.getDate() - startOfSelectedWeek.getDay());
                      const weekChanged = calendarView === "Week" && dateKey(startOfSelectedWeek) !== weekStart;
                      const todaySelectionChanged = (key === todayKey) !== todayIsSelected;
                      if (weekChanged || todaySelectionChanged) {
                        setLoading(true);
                        setError("");
                      }
                      setSelectedDate(key);
                    }}
                    style={[
                      styles.dateCell,
                      highlightedWeek && styles.weekHighlightCell,
                      selected && styles.selectedCell,
                      isToday && selected && styles.todayCell,
                      isToday && !selected && styles.todayContextCell,
                    ]}
                  >
                    <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>
                      {day.getDate()}
                    </Text>
                    <View style={styles.dots}>
                      {visibleDots.map((order) => {
                        const complete = order.status === "Fulfilled" && order.paid;
                        return <View key={order.id} style={[styles.dot, complete && (isToday && selected ? styles.todayDot : styles.completedDot), selected && !complete && styles.selectedDot, isToday && selected && !complete && styles.todayDot]} />;
                      })}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
          })}
        </View>
      </ContentCard>

      {loading ? <LoadingState label={calendarView === "Week" ? "Loading this week’s orders…" : "Loading this month’s orders…"} /> : null}
      {!loading && error ? (
        <MessageCard title="Calendar unavailable" message={error} tone="error" />
      ) : null}
      {!loading && !error && todayIsSelected && !hasOrdersToday ? (
        <View style={styles.agendaGroup}>
          <Text style={styles.agendaDate}>Today</Text>
          <MessageCard title="No orders today" message="No orders are scheduled for today." />
        </View>
      ) : null}
      {!loading && !error && !todayIsSelected && agendaGroups.length === 0 ? (
        <MessageCard title="No orders on this day" message={`There are no orders scheduled for ${formatAgendaDate(selectedDate)}.`} />
      ) : null}
      {!loading && !error ? agendaGroups.map(([dueDate, dayOrders]) => (
        <View key={dueDate} style={styles.agendaGroup}>
          <Text style={styles.agendaDate}>{formatAgendaDate(dueDate)}</Text>
          {dayOrders.map((order) => <OrderCard key={order.id} order={order} onStatusUpdated={handleStatusUpdated} />)}
        </View>
      )) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  calendarToolbar: { alignItems: "flex-end" },
  calendarCard: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthArrow: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.parchment,
  },
  arrowText: {
    color: colors.teal,
    fontSize: 24,
    lineHeight: 28,
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
  viewSwitch: { flexDirection: "row", width: 132, padding: 2, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  viewButton: { flex: 1, minHeight: 28, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  viewButtonActive: { backgroundColor: colors.teal },
  viewButtonText: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },
  viewButtonTextActive: { color: colors.card },
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
    paddingVertical: 2,
  },
  dateCell: {
    flex: 1,
    minWidth: 0,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  selectedCell: {
    backgroundColor: colors.teal,
  },
  weekHighlightCell: { backgroundColor: "#E1ECEA" },
  todayCell: { backgroundColor: colors.teal, borderWidth: 2, borderColor: colors.card },
  todayContextCell: { borderWidth: 2, borderColor: colors.deepTeal },
  dateNumber: {
    color: colors.espresso,
    fontSize: 12,
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
  completedDot: { backgroundColor: colors.sage },
  todayDot: { backgroundColor: colors.card },
  agendaGroup: { gap: spacing.xs },
  agendaDate: { color: colors.mutedText, fontSize: 12, fontWeight: "700", paddingTop: spacing.xs },
});

function formatAgendaDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const today = dateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateKey(tomorrowDate);
  if (value === today) return "Today";
  if (value === tomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
