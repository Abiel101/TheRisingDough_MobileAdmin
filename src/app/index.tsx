import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { NativeText } from "@/components/ui/native-text";
import { AppScreen, ContentCard, FormField, styles as uiStyles } from "@/components/ui/screen-primitives";
import { supabaseConfigured } from "@/lib/supabase";
import { colors, spacing } from "@/theme/tokens";

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setSubmitting(true);
    setError("");
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.page}
      >
        <View style={styles.brandMark}>
          <NativeText textStyle={styles.brandMarkText}>RD</NativeText>
        </View>
        <NativeText textStyle={styles.eyebrow}>THE RISING DOUGH</NativeText>
        <NativeText textStyle={styles.title}>Welcome back.</NativeText>
        <NativeText textStyle={styles.subtitle}>
          Sign in with the owner or staff account connected to your bakery.
        </NativeText>

        <ContentCard style={styles.form}>
          {!supabaseConfigured ? (
            <NativeText textStyle={styles.error}>
              Supabase is not configured. Add the project URL and publishable key to .env.local, then restart Expo.
            </NativeText>
          ) : null}
          <FormField
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            textContentType="emailAddress"
            value={email}
          />
          <FormField
            autoCapitalize="none"
            autoComplete="password"
            label="Password"
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            textContentType="password"
            value={password}
          />
          {error ? <NativeText textStyle={styles.error}>{error}</NativeText> : null}
          <NativeButton
            disabled={!supabaseConfigured || !email.trim() || !password || submitting}
            label={submitting ? "Signing in…" : "Sign in"}
            onPress={handleSignIn}
          />
        </ContentCard>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.md,
  },
  brandMark: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.teal,
    marginBottom: spacing.sm,
  },
  brandMarkText: {
    color: colors.card,
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  eyebrow: uiStyles.eyebrow,
  title: {
    color: colors.espresso,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  form: {
    marginTop: spacing.md,
  },
  error: {
    color: colors.brick,
    fontSize: 14,
    lineHeight: 20,
  },
});
