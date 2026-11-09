import { useState } from "react";
import {
  Animated,
  Easing,
  Pressable as NativePressable,
  Platform,
  StyleSheet,
  type PressableProps,
} from "react-native";

import { haptic, type HapticKind } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(NativePressable);

const RIPPLE = { color: "rgba(23, 74, 70, 0.16)", foreground: true } as const;

type Props = PressableProps & {
  /** Haptic fired on tap. Long presses use a medium impact. Defaults to a light impact. */
  haptic?: HapticKind;
  /** Set false on opaque surfaces layered over something else (e.g. swipe actions) so they don't fade or shrink. */
  animated?: boolean;
  /** Set false for backdrops and other large surfaces that should not animate or vibrate. */
  feedback?: boolean;
};

/**
 * Drop-in Pressable with platform-native touch feedback: a Material ripple on Android,
 * a smooth dim-and-shrink on iOS, and a haptic tap on both.
 */
export function Pressable({
  haptic: hapticKind = "light",
  feedback = true,
  animated = true,
  style,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  android_ripple,
  ...rest
}: Props) {
  const [pressed, setPressed] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  if (!feedback) {
    return (
      <NativePressable
        {...rest}
        onLongPress={onLongPress}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
      />
    );
  }

  const animateTo = (value: number) =>
    Animated.timing(progress, {
      toValue: value,
      duration: value ? 70 : 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const resolvedStyle = StyleSheet.flatten(typeof style === "function" ? style({ pressed, hovered: false }) : style);
  const baseOpacity = typeof resolvedStyle?.opacity === "number" ? resolvedStyle.opacity : 1;
  const iosFeedback = Platform.OS === "ios" && animated
    ? {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity, baseOpacity * 0.8] }),
        transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
      }
    : null;

  return (
    <AnimatedPressable
      android_ripple={android_ripple ?? RIPPLE}
      {...rest}
      onLongPress={onLongPress ? (event) => { haptic("medium"); onLongPress(event); } : undefined}
      onPress={onPress ? (event) => { haptic(hapticKind); onPress(event); } : undefined}
      onPressIn={(event) => {
        setPressed(true);
        animateTo(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        animateTo(0);
        onPressOut?.(event);
      }}
      style={[resolvedStyle, iosFeedback]}
    />
  );
}
