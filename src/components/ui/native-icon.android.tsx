import { Host, Icon } from "@expo/ui";
import { View } from "react-native";

import type { NativeIconName, NativeIconProps } from "@/components/ui/native-icon.types";
import { colors } from "@/theme/tokens";

const symbols: Record<NativeIconName, number> = {
  close: require("@expo/material-symbols/close.xml"),
  search: require("@expo/material-symbols/search.xml"),
  back: require("@expo/material-symbols/chevron_left.xml"),
  forward: require("@expo/material-symbols/chevron_right.xml"),
  more: require("@expo/material-symbols/more_horiz.xml"),
};

/** Material Symbol rendered through Expo UI. Touches pass through to the parent button. */
export function NativeIcon({ name, size = 18, color = colors.teal }: NativeIconProps) {
  return (
    <View pointerEvents="none">
      <Host matchContents style={{ width: size, height: size }}>
        <Icon color={color} name={symbols[name]} size={size} />
      </Host>
    </View>
  );
}
