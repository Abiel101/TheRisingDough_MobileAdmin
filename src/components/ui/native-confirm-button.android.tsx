import { useState } from "react";
import { AlertDialog, Button, Host, Text, TextButton } from "@expo/ui/jetpack-compose";

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
      <Button onClick={() => setVisible(true)} colors={{ containerColor: actionColor, contentColor: colors.card }}>
        <Text>{label}</Text>
      </Button>
      {visible ? (
        <AlertDialog
          colors={{
            containerColor: colors.card,
            titleContentColor: colors.espresso,
            textContentColor: colors.mutedText,
          }}
          onDismissRequest={() => setVisible(false)}
        >
          <AlertDialog.Title><Text>{title}</Text></AlertDialog.Title>
          <AlertDialog.Text><Text>{message}</Text></AlertDialog.Text>
          <AlertDialog.ConfirmButton>
            <TextButton
              colors={{ contentColor: actionColor }}
              onClick={() => {
                setVisible(false);
                void onConfirm();
              }}
            >
              <Text>{confirmLabel}</Text>
            </TextButton>
          </AlertDialog.ConfirmButton>
          <AlertDialog.DismissButton>
            <TextButton onClick={() => setVisible(false)}><Text>{cancelLabel}</Text></TextButton>
          </AlertDialog.DismissButton>
        </AlertDialog>
      ) : null}
    </Host>
  );
}
