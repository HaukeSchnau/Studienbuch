import { requireNativeView } from "expo";
import { useCallback } from "react";
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";
import { processColor } from "react-native";

export interface ColorPickerProps {
  /**
   * The currently selected color in the format `#RRGGBB` or `#RRGGBBAA`.
   */
  selection: string | null;
  /**
   * A label displayed on the `ColorPicker`.
   */
  label?: string;
  /**
   * Callback function that is called when a new color is selected.
   */
  onValueChanged?: (value: string) => void;
  /**
   * Optional style to apply to the `ColorPicker` component.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Whether the color picker should support opacity.
   */
  supportsOpacity?: boolean;
}

type OnValueChangedEvent = NativeSyntheticEvent<{ value: string }>;

const ColorPickerNativeView: React.ComponentType<
  Omit<ColorPickerProps, "selection" | "onValueChanged"> & {
    selection: ReturnType<typeof processColor>;
    onValueChanged: (event: OnValueChangedEvent) => void;
  }
> = requireNativeView("ExpoUI", "ColorPickerView");

/**
 * Renders a `ColorPicker` component using SwiftUI.
 * @platform ios
 */
export function ColorPicker({
  selection,
  onValueChanged,
  ...restProps
}: ColorPickerProps) {
  const onNativeValueChanged = useCallback(
    (event: OnValueChangedEvent) => {
      onValueChanged?.(event.nativeEvent.value);
    },
    [onValueChanged],
  );
  return (
    <ColorPickerNativeView
      selection={processColor(selection ?? "")}
      onValueChanged={onNativeValueChanged}
      {...restProps}
    />
  );
}
