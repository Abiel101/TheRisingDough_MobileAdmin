import { Text } from "react-native";

import { fallbackGlyphs, type NativeIconProps } from "@/components/ui/native-icon.types";
import { colors } from "@/theme/tokens";

export function NativeIcon({ name, size = 18, color = colors.teal }: NativeIconProps) {
  return <Text style={{ color, fontSize: size, fontWeight: "700" }}>{fallbackGlyphs[name]}</Text>;
}
