import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";

import type { NativeSegmentedControlProps } from "@/components/ui/native-segmented-control.types";

/** SwiftUI segmented picker. */
export function NativeSegmentedControl<T extends string>({ options, value, onChange }: NativeSegmentedControlProps<T>) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Picker modifiers={[pickerStyle("segmented")]} onSelectionChange={(next) => onChange(next as T)} selection={value}>
        {options.map((option) => (
          <Text key={option.value} modifiers={[tag(option.value)]}>{option.label}</Text>
        ))}
      </Picker>
    </Host>
  );
}
