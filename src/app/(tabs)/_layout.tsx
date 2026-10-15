import { NativeTabs } from "expo-router/unstable-native-tabs";

import { resetCalendarToToday } from "@/lib/calendar-navigation";
import { colors } from "@/theme/tokens";

export default function WorkspaceTabs() {
  return (
    <NativeTabs
      backgroundColor={colors.card}
      disableIndicator
      iconColor={{ default: colors.mutedText, selected: colors.teal }}
      labelStyle={{
        default: { color: colors.mutedText, fontSize: 10, fontWeight: "500" },
        selected: { color: colors.teal, fontSize: 10, fontWeight: "700" },
      }}
      labelVisibilityMode="labeled"
      rippleColor={colors.cream}
    >
      <NativeTabs.Trigger
        name="calendar"
        listeners={({ navigation, route }) => ({
          tabPress: () => {
            const state = navigation.getState();
            if (state.routes[state.index]?.key === route.key) resetCalendarToToday();
          },
        })}
      >
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <NativeTabs.Trigger.Label>Catalog</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="inventory_2" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="customers">
        <NativeTabs.Trigger.Label>Customers</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="groups" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
