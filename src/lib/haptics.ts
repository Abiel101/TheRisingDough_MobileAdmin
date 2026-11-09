import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticKind = "light" | "medium" | "selection" | "success" | "error" | "none";

/** Fires the device's native haptic. Silently does nothing where unsupported (web, simulators). */
export function haptic(kind: HapticKind = "light"): void {
  if (Platform.OS === "web" || kind === "none") return;
  const run = () => {
    switch (kind) {
      case "selection": return Haptics.selectionAsync();
      case "medium": return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case "success": return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "error": return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      default: return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  run().catch(() => undefined);
}
