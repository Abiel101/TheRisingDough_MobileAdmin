import { NativeTabs } from "expo-router/native-tabs";

import { haptic } from "@/lib/haptics";
import { resetCalendarToToday } from "@/lib/calendar-navigation";
import { colors } from "@/theme/tokens";

const tabHaptics = { tabPress: () => haptic("selection") };

export default function WorkspaceTabs() {
	return (
		<NativeTabs
			backgroundColor={colors.card}
			blurEffect="systemMaterialLight"
			disableTransparentOnScrollEdge
			iconColor={{ default: colors.espresso, selected: colors.teal }}
			indicatorColor={colors.cream}
			labelStyle={{
				default: { color: colors.espresso, fontSize: 11, fontWeight: "700" },
				selected: { color: colors.teal, fontSize: 11, fontWeight: "800" },
			}}
			labelVisibilityMode="labeled"
			rippleColor={colors.cream}
			tintColor={colors.teal}
		>
			<NativeTabs.Trigger
				name="calendar"
				listeners={({ navigation, route }) => ({
					tabPress: () => {
						haptic("selection");
						const state = navigation.getState();
						if (state.routes[state.index]?.key === route.key)
							resetCalendarToToday();
					},
				})}
			>
				<NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="orders" listeners={tabHaptics}>
				<NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="list.bullet.rectangle" md="receipt_long" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="requests" listeners={tabHaptics}>
				<NativeTabs.Trigger.Label>Requests</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="tray.and.arrow.down" md="move_to_inbox" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="catalog" listeners={tabHaptics}>
				<NativeTabs.Trigger.Label>Catalog</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="square.grid.2x2" md="inventory_2" />
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="customers" listeners={tabHaptics}>
				<NativeTabs.Trigger.Label>Customers</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="person.2" md="groups" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
