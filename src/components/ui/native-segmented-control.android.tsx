import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";

import type { NativeSegmentedControlProps } from "@/components/ui/native-segmented-control.types";
import { colors } from "@/theme/tokens";

/** Material 3 single-choice segmented button row. */
export function NativeSegmentedControl<T extends string>({ options, value, onChange }: NativeSegmentedControlProps<T>) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
        {options.map((option) => (
          <SegmentedButton
            colors={{
              activeContainerColor: colors.teal,
              activeContentColor: colors.card,
              activeBorderColor: colors.teal,
              inactiveContainerColor: colors.card,
              inactiveContentColor: colors.espresso,
              inactiveBorderColor: colors.border,
            }}
            key={option.value}
            onClick={() => onChange(option.value)}
            selected={option.value === value}
          >
            <SegmentedButton.Label><Text>{option.label}</Text></SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
