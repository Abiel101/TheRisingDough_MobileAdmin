import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/auth-context";
import { NativeButton } from "@/components/ui/native-button";
import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { colors, spacing } from "@/theme/tokens";

function metadataText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const user = session?.user;
  const metadata = user?.user_metadata ?? {};
  const fullName = metadataText(metadata.full_name) || metadataText(metadata.name);
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = metadataText(metadata.first_name) || metadataText(metadata.given_name) || nameParts[0] || "Not provided";
  const lastName = metadataText(metadata.last_name) || metadataText(metadata.family_name) || nameParts.slice(1).join(" ") || "Not provided";

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try {
      await signOut();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <AppScreen>
      <SheetHeader showSettings={false} title="Settings" subtitle="Your account and session." />
      {error ? <MessageCard title="Sign out failed" message={error} tone="error" /> : null}
      <ContentCard style={styles.profileCard}>
        <Text style={styles.sectionTitle}>Account information</Text>
        <ProfileRow label="First name" value={firstName} />
        <ProfileRow label="Last name" value={lastName} />
        <ProfileRow label="Email" value={user?.email || "Not provided"} />
      </ContentCard>
      <NativeButton
        disabled={signingOut}
        label={signingOut ? "Signing out…" : "Sign out"}
        onPress={handleSignOut}
        variant="outlined"
      />
    </AppScreen>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.espresso,
    fontSize: 16,
    fontWeight: "700",
  },
  profileRow: {
    gap: spacing.xs,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
  },
  value: {
    color: colors.espresso,
    fontSize: 15,
    fontWeight: "600",
  },
});
