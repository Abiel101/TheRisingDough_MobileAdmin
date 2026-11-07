import { Pressable, StyleSheet, Text, View } from "react-native";

import { NativeIcon } from "@/components/ui/native-icon";
import { DEFAULT_OPTION_NAME, groupLinesByItem, hasOptionLabel } from "@/domain/orders";
import type { OrderLine } from "@/lib/workspace";
import { colors, spacing } from "@/theme/tokens";

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

type OrderLinesProps = {
  items: readonly OrderLine[];
  /** Per-line totals after any order discount, in the same order as `items`. */
  discountedTotals: readonly number[];
  onRemove?: (item: OrderLine) => void;
  removeDisabled?: boolean;
};

function LineTotal({ original, discounted }: { original: number; discounted: number }) {
  if (discounted < original) {
    return (
      <View style={styles.totals}>
        <Text style={styles.struck}>{formatCurrency(original)}</Text>
        <Text style={styles.sale}>{formatCurrency(discounted)}</Text>
      </View>
    );
  }
  return <Text style={styles.total}>{formatCurrency(original)}</Text>;
}

/**
 * Items on an order. Items with options are grouped under their name, with the
 * quantity beside each option and its price on the far right.
 */
export function OrderLines({ items, discountedTotals, onRemove, removeDisabled }: OrderLinesProps) {
  return (
    <>
      {groupLinesByItem(items).map((group) => {
        if (!group.showOptions) {
          return group.entries.map(({ line, index }) => (
            <View key={line.id} style={styles.simpleRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{line.quantity}×</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{line.name}</Text>
                <Text style={styles.muted}>{formatCurrency(line.price)} each</Text>
              </View>
              <LineTotal discounted={discountedTotals[index] ?? line.price * line.quantity} original={line.price * line.quantity} />
              {onRemove ? <RemoveButton disabled={removeDisabled} label={line.name} onPress={() => onRemove(line)} /> : null}
            </View>
          ));
        }
        return (
          <View key={group.key} style={styles.group}>
            <Text style={styles.name}>{group.name}</Text>
            {group.entries.map(({ line, index }) => (
              <View key={line.id} style={styles.optionRow}>
                <View style={styles.copy}>
                  <Text style={styles.optionName}>{hasOptionLabel(line.optionName) ? line.optionName : DEFAULT_OPTION_NAME}</Text>
                  <Text style={styles.muted}>{formatCurrency(line.price)} each</Text>
                </View>
                <Text style={styles.quantity}>{line.quantity}×</Text>
                <View style={styles.priceColumn}>
                  <LineTotal discounted={discountedTotals[index] ?? line.price * line.quantity} original={line.price * line.quantity} />
                </View>
                {onRemove ? <RemoveButton disabled={removeDisabled} label={`${line.name}, ${line.optionName}`} onPress={() => onRemove(line)} /> : null}
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

function RemoveButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityLabel={`Remove ${label}`} accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.remove}>
      <NativeIcon color={colors.brick} name="close" size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  simpleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  group: { gap: spacing.xs, paddingVertical: spacing.xs },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.cream, paddingLeft: spacing.md, paddingVertical: 2 },
  badge: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.cream },
  badgeText: { color: colors.espresso, fontSize: 12, fontWeight: "700" },
  copy: { flex: 1, gap: 2 },
  name: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  optionName: { color: colors.espresso, fontSize: 14, fontWeight: "600" },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  quantity: { minWidth: 34, color: colors.teal, fontSize: 14, fontWeight: "800", textAlign: "right" },
  priceColumn: { minWidth: 68, alignItems: "flex-end" },
  total: { color: colors.espresso, fontSize: 14, fontWeight: "700" },
  totals: { alignItems: "flex-end" },
  struck: { color: colors.mutedText, fontSize: 12, textDecorationLine: "line-through" },
  sale: { color: colors.sale, fontSize: 14, fontWeight: "700" },
  remove: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.parchment },
});
