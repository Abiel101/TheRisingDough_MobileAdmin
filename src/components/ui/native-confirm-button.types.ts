export type NativeConfirmButtonProps = {
  label: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "cancel" | "delete";
  onConfirm: () => void | Promise<void>;
};
