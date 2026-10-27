import { Host, Icon } from "@expo/ui";
import { View } from "react-native";

import type { NativeIconName, NativeIconProps } from "@/components/ui/native-icon.types";
import { colors } from "@/theme/tokens";

const symbols: Record<NativeIconName, string> = {
  close: "xmark",
  search: "magnifyingglass",
  back: "chevron.left",
  forward: "chevron.right",
  more: "ellipsis",
};

/** SF Symbol rendered through Expo UI. Touches pass through to the parent button. */
export function NativeIcon({ name, size = 18, color = colors.teal }: NativeIconProps) {
  return (
    <View pointerEvents="none">
      <Host matchContents style={{ width: size, height: size }}>
        <Icon color={color} name={symbols[name] as "star"} size={size} />
      </Host>
    </View>
  );
}
