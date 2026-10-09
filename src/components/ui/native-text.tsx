import { Host, Text as ExpoText, type TextProps } from "@expo/ui";
import type { ReactNode } from "react";

import { colors } from "@/theme/tokens";

type NativeTextProps = {
  children: ReactNode;
  textStyle?: TextProps["textStyle"];
  numberOfLines?: number;
};

function toPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join("");
  return "";
}

/** Renders the same text API with SwiftUI on Apple platforms and Compose on Android. */
export function NativeText({
  children,
  textStyle,
  numberOfLines,
}: NativeTextProps) {
  const text = toPlainText(children);
  return (
    <Host
      colorScheme="light"
      matchContents={{ vertical: true }}
      seedColor={colors.teal}
      style={{ width: "100%" }}
    >
      <ExpoText numberOfLines={numberOfLines} textStyle={textStyle}>
        {text}
      </ExpoText>
    </Host>
  );
}
