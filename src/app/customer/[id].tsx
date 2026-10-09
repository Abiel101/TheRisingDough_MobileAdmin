import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { AppScreen, ContentCard, MessageCard, SheetHeader } from "@/components/ui/screen-primitives";
import { getCustomer, type CustomerRecord } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

export default function CustomerDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("This customer link is missing its customer ID.");
      setLoading(false);
      return;
    }
    try {
      const result = await getCustomer(id);
      setCustomer(result);
      setError(result ? "" : "This customer could not be found.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this customer.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <AppScreen>
      <SheetHeader title={customer?.name || "Customer details"} subtitle="Saved customer information." />
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.teal} /><Text style={styles.muted}>Loading customer…</Text></View>
      ) : customer ? (
        <ContentCard style={styles.card}>
          <Text style={styles.sectionTitle}>Contact information</Text>
          <DetailField label="Name" value={customer.name || "Not provided"} />
          <DetailField label="Phone" value={customer.phone || "Not provided"} selectable />
          <DetailField label="Email" value={customer.email || "Not provided"} selectable />
          <DetailField label="Address" value={customer.address || "Not provided"} />
          <DetailField label="Customer since" value={new Date(customer.createdAt).toLocaleDateString()} />
        </ContentCard>
      ) : (
        <MessageCard title="Customer unavailable" message={error || "This customer could not be found."} tone="error" />
      )}
    </AppScreen>
  );
}

function DetailField({ label, value, selectable = false }: { label: string; value: string; selectable?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable={selectable} style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md },
  card: { gap: spacing.md, padding: spacing.md },
  sectionTitle: { color: colors.espresso, fontSize: 16, fontWeight: "700" },
  field: { gap: spacing.xs, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  label: { color: colors.mutedText, fontSize: 12 },
  value: { color: colors.espresso, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
});
