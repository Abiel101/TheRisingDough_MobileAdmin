import { Button, Host, type ButtonProps } from "@expo/ui";
import { Platform, Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/tokens";

type NativeButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
};

/** A themed button rendered with the platform's native UI toolkit. */
export function NativeButton({
  label,
  onPress,
  variant = "filled",
  disabled,
}: NativeButtonProps) {
  if (Platform.OS === "android") {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.androidButton,
          variant === "outlined" && styles.androidOutlined,
          variant === "text" && styles.androidText,
          disabled && styles.androidDisabled,
          pressed && !disabled && styles.androidPressed,
        ]}
      >
        <Text
          style={[
            styles.androidButtonLabel,
            variant !== "filled" && styles.androidSecondaryLabel,
            disabled && styles.androidDisabledLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Host colorScheme="light" matchContents seedColor={colors.teal}>
      <Button
        disabled={disabled}
        label={label}
        onPress={onPress}
        variant={variant}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  androidButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.teal,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  androidOutlined: {
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: "transparent",
  },
  androidText: {
    backgroundColor: "transparent",
  },
  androidButtonLabel: {
    color: colors.card,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  androidSecondaryLabel: {
    color: colors.teal,
  },
  androidDisabled: {
    opacity: 0.5,
  },
  androidDisabledLabel: {
    color: colors.mutedText,
  },
  androidPressed: {
    opacity: 0.78,
  },
});
