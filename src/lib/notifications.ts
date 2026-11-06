import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

import { savePushToken } from "@/lib/workspace";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Registers this device so the owner is notified when a customer approves an order. */
export async function registerForApprovalNotifications(ownerId: string): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Order updates",
      importance: AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await savePushToken(ownerId, data);
}

export function orderIdFromNotification(response: Notifications.NotificationResponse): string | null {
  const orderId = response.notification.request.content.data?.orderId;
  return typeof orderId === "string" ? orderId : null;
}

export function requestIdFromNotification(response: Notifications.NotificationResponse): string | null {
  const requestId = response.notification.request.content.data?.requestId;
  return typeof requestId === "string" ? requestId : null;
}

export { Notifications };
