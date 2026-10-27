import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { Stack } from "expo-router";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/auth/auth-context";
import { LoadingSplash } from "@/components/loading-splash";
import { colors } from "@/theme/tokens";

const SPLASH_DURATION_MS = 1000;
const FADE_DURATION_MS = 300;

// Pushed cards slide in from the right and animate back out natively on close.
const modalOptions: ComponentProps<typeof Stack.Screen>["options"] = {
  presentation: Platform.OS === "ios" ? "card" : "transparentModal",
  animation: "slide_from_right",
  gestureEnabled: true,
  headerShown: false,
  contentStyle: { backgroundColor: colors.background },
};

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const [startupDelayElapsed, setStartupDelayElapsed] = useState(false);
  const [showSignInSplash, setShowSignInSplash] = useState(false);
  const [splashOpacity] = useState(() => new Animated.Value(1));
  const previousAuthenticated = useRef<boolean | null>(null);
  const signInSplashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setStartupDelayElapsed(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const isAuthenticated = Boolean(session);
    const wasAuthenticated = previousAuthenticated.current;
    previousAuthenticated.current = isAuthenticated;

    if (wasAuthenticated === false && isAuthenticated) {
      setShowSignInSplash(true);
      if (signInSplashTimer.current) clearTimeout(signInSplashTimer.current);
      signInSplashTimer.current = setTimeout(() => {
        setShowSignInSplash(false);
        signInSplashTimer.current = null;
      }, SPLASH_DURATION_MS);
    }

    if (!isAuthenticated && signInSplashTimer.current) {
      clearTimeout(signInSplashTimer.current);
      signInSplashTimer.current = null;
      setShowSignInSplash(false);
    }
  }, [isLoading, session]);

  useEffect(
    () => () => {
      if (signInSplashTimer.current) clearTimeout(signInSplashTimer.current);
    },
    [],
  );

  const splashVisible = isLoading || !startupDelayElapsed || showSignInSplash;

  useLayoutEffect(() => {
    splashOpacity.stopAnimation();

    if (splashVisible) {
      splashOpacity.setValue(1);
      return;
    }

    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [splashOpacity, splashVisible]);

  return (
    <View style={styles.navigator}>
      <View
        accessibilityElementsHidden={splashVisible}
        importantForAccessibility={splashVisible ? "no-hide-descendants" : "auto"}
        pointerEvents={splashVisible ? "none" : "auto"}
        style={styles.navigator}
      >
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={Boolean(session)}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="order/[id]" options={modalOptions} />
            <Stack.Screen name="order/new" options={modalOptions} />
            <Stack.Screen name="settings" options={modalOptions} />
            <Stack.Screen name="customer/[id]" options={modalOptions} />
            <Stack.Screen name="customer/new" options={modalOptions} />
            <Stack.Screen name="catalog/new" options={modalOptions} />
            <Stack.Screen name="catalog/[id]" options={modalOptions} />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="index" />
          </Stack.Protected>
        </Stack>
      </View>
      <Animated.View pointerEvents="none" style={[styles.splash, { opacity: splashOpacity }]}>
        <LoadingSplash active={splashVisible} />
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navigator: {
    flex: 1,
    backgroundColor: colors.background,
  },
  splash: {
    ...StyleSheet.absoluteFill,
  },
});
