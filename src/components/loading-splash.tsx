import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { colors } from "@/theme/tokens";

const CYCLE_DURATION_MS = 1000;
const REVEAL_DURATION_MS = 750;
const CIRCLE_SIZE = 128;
const FILL_COLORS = [colors.teal, colors.cream, colors.paper] as const;

export function LoadingSplash({ active: shouldAnimate = true }: { active?: boolean }) {
  const { height, width } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [backgroundColor, setBackgroundColor] = useState<string>(colors.background);
  const [circleColor, setCircleColor] = useState<string>(FILL_COLORS[0]);

  useEffect(() => {
    if (!shouldAnimate) return;

    let running = true;
    let cycleTimer: ReturnType<typeof setTimeout> | undefined;
    let colorIndex = 0;
    const maxScale = Math.hypot(width, height) / CIRCLE_SIZE + 0.2;

    const runCycle = () => {
      if (!running) return;

      const nextColor = FILL_COLORS[colorIndex];
      setCircleColor(nextColor);
      progress.setValue(0);

      Animated.timing(progress, {
        toValue: maxScale,
        duration: REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !running) return;

        setBackgroundColor(nextColor);
        colorIndex = (colorIndex + 1) % FILL_COLORS.length;
        setCircleColor(FILL_COLORS[colorIndex]);
        progress.setValue(0);
        cycleTimer = setTimeout(runCycle, CYCLE_DURATION_MS - REVEAL_DURATION_MS);
      });
    };

    runCycle();
    return () => {
      running = false;
      if (cycleTimer) clearTimeout(cycleTimer);
      progress.stopAnimation();
    };
  }, [shouldAnimate, height, progress, width]);

  const onDarkBackground = backgroundColor === colors.teal;

  return (
    <View
      accessibilityLabel="Loading The Rising Dough"
      accessibilityRole="progressbar"
      style={[styles.screen, { backgroundColor }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.circle,
          {
            backgroundColor: circleColor,
            left: width / 2 - CIRCLE_SIZE / 2,
            top: height / 2 - CIRCLE_SIZE / 2,
            transform: [{ scale: progress }],
          },
        ]}
      />
      <View pointerEvents="none" style={styles.content}>
        <Image
          accessibilityLabel="The Rising Dough"
          source={require("../../assets/images/icon.png")}
          style={styles.icon}
        />
        <Text style={[styles.title, { color: onDarkBackground ? colors.cream : colors.espresso }]}>
          The Rising Dough
        </Text>
        <Text style={[styles.caption, { color: onDarkBackground ? colors.cream : colors.mutedText }]}>
          Getting things ready…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
  },
  circle: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  icon: {
    width: 116,
    height: 116,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 14,
    letterSpacing: 0.15,
  },
});
