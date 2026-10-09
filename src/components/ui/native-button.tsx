import { Button, Host, type ButtonProps } from "@expo/ui";

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
