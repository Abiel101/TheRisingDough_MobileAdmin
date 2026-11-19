import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, type ScrollViewProps } from "react-native";

/**
 * Props for scrollable screens so focused inputs stay visible above the keyboard.
 * iOS scroll views inset themselves; Android relies on <KeyboardAvoider /> because edge-to-edge disables adjustResize.
 */
export const keyboardScrollProps: Pick<
  ScrollViewProps,
  "automaticallyAdjustKeyboardInsets" | "keyboardDismissMode" | "keyboardShouldPersistTaps"
> = {
  automaticallyAdjustKeyboardInsets: Platform.OS === "ios",
  keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
  keyboardShouldPersistTaps: "handled",
};

export function KeyboardAvoider({ children }: { children: ReactNode }) {
  if (Platform.OS !== "android") return <View style={styles.fill}>{children}</View>;
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
