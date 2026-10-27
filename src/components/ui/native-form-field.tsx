import { useEffect } from "react";
import { Host, TextInput as ExpoTextInput, useNativeState, type TextInputProps } from "@expo/ui";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
  View,
} from "react-native";

import { NativeText } from "@/components/ui/native-text";
import { colors, spacing } from "@/theme/tokens";

type NativeFormFieldProps = {
  autoCapitalize?: RNTextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  keyboardType?: RNTextInputProps["keyboardType"];
  label: string;
  onChangeText?: RNTextInputProps["onChangeText"];
  placeholder?: string;
  secureTextEntry?: boolean;
  trailingAction?: { label: string; accessibilityLabel?: string; onPress: () => void };
  value?: string;
};

/** Uses Expo UI on Apple platforms and avoids its Compose Host on Android. */
export function NativeFormField(props: NativeFormFieldProps) {
  if (Platform.OS === "android") return <AndroidFormField {...props} />;
  return <ExpoFormField {...props} />;
}

function ExpoFormField({ label, value, onChangeText, trailingAction, ...inputProps }: NativeFormFieldProps) {
  const nativeValue = useNativeState(value ?? "");

  useEffect(() => {
    if (value !== undefined) nativeValue.set(value);
  }, [nativeValue, value]);

  return (
    <View style={styles.field}>
      <NativeText textStyle={styles.label}>{label}</NativeText>
      <View style={styles.inputFrame}>
        <Host matchContents={{ vertical: true }} style={styles.host}>
          <ExpoTextInput
            cursorColor={colors.teal}
            onChangeText={(nextValue) => {
              nativeValue.set(nextValue);
              onChangeText?.(nextValue);
            }}
            placeholderTextColor={colors.mutedText}
            selectionColor={colors.teal}
            textAlign="left"
            style={styles.input}
            textStyle={styles.inputText}
            value={nativeValue}
            {...inputProps}
          />
        </Host>
        {trailingAction ? <FieldAction {...trailingAction} /> : null}
      </View>
    </View>
  );
}

function AndroidFormField({ label, value, onChangeText, trailingAction, ...inputProps }: NativeFormFieldProps) {
  return (
    <View style={styles.field}>
      <NativeText textStyle={styles.label}>{label}</NativeText>
      <View style={styles.inputFrame}>
        <RNTextInput
          {...inputProps}
          onChangeText={onChangeText}
          placeholderTextColor={colors.mutedText}
          selectionColor={colors.teal}
          textAlign="left"
          textAlignVertical="center"
          style={styles.androidInput}
          value={value}
        />
        {trailingAction ? <FieldAction {...trailingAction} /> : null}
      </View>
    </View>
  );
}

function FieldAction({ label, accessibilityLabel, onPress }: NonNullable<NativeFormFieldProps["trailingAction"]>) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel || label} accessibilityRole="button" hitSlop={8} onPress={onPress} style={styles.trailingAction}>
      <Text style={styles.trailingActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    alignSelf: "stretch",
    gap: spacing.xs,
  },
  label: {
    color: colors.espresso,
    fontSize: 13,
    fontWeight: "600",
  },
  host: {
    flex: 1,
    height: 48,
    alignSelf: "stretch",
  },
  inputFrame: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderColor: colors.paper,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  input: {
    width: "100%" as const,
    height: 48,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
  },
  inputText: {
    color: colors.espresso,
    fontSize: 16,
  },
  androidInput: {
    flex: 1,
    minWidth: 0,
    height: 48,
    backgroundColor: "transparent",
    color: colors.espresso,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trailingAction: { minWidth: 54, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  trailingActionText: { color: colors.teal, fontSize: 13, fontWeight: "700" },
});
