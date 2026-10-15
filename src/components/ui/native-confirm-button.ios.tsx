import { useState } from "react";
import { Alert, Button, Host, Text } from "@expo/ui/swift-ui";
import { buttonBorderShape, buttonStyle, tint } from "@expo/ui/swift-ui/modifiers";

import type { NativeConfirmButtonProps } from "@/components/ui/native-confirm-button.types";
import { colors } from "@/theme/tokens";

export function NativeConfirmButton({
  label,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "delete",
  onConfirm,
}: NativeConfirmButtonProps) {
  const [visible, setVisible] = useState(false);
  const actionColor = tone === "cancel" ? colors.orange : colors.brick;

  return (
    <Host matchContents>
      <Alert title={title} isPresented={visible} onIsPresentedChange={setVisible}>
        <Alert.Trigger>
          <Button label={label} role="destructive" onPress={() => setVisible(true)} modifiers={[buttonStyle("borderedProminent"), buttonBorderShape("roundedRectangle", 12), tint(actionColor)]} />
        </Alert.Trigger>
        <Alert.Actions>
          <Button
            label={confirmLabel}
            role="destructive"
            onPress={() => {
              setVisible(false);
              void onConfirm();
            }}
          />
          <Button label={cancelLabel} role="cancel" onPress={() => setVisible(false)} />
        </Alert.Actions>
        <Alert.Message><Text>{message}</Text></Alert.Message>
      </Alert>
    </Host>
  );
}
