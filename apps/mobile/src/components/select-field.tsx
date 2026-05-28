import { Picker } from "@expo/ui/community/picker";
import { useEffect } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { fontNames } from "./text";

import { FieldLabel } from "./field-label";

type PickerValue = string | number | null;

interface Props<TOption, TValue extends PickerValue> {
  label: string;
  value: TOption | undefined;
  getOptionLabel: (option: NonNullable<TOption>) => string;
  getKey: (option: NonNullable<TOption>) => TValue;
  options: NonNullable<TOption>[];
  onChange: (value: TOption | undefined) => void;
}

export const SelectField = <TOption, TValue extends PickerValue>({
  label,
  value,
  getOptionLabel,
  getKey,
  options,
  onChange,
}: Props<TOption, TValue>) => {
  const active = useSharedValue(true);
  const focused = useSharedValue(false);

  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0]);
    }
  }, [value, options, onChange]);

  return (
    <View>
      <Picker
        selectedValue={value ? getKey(value) : undefined}
        onValueChange={(_, idx) => onChange(options[idx])}
        style={{
          backgroundColor: "#E6E6E6",
          borderRadius: 32,
        }}
      >
        {options.map((option) => (
          <Picker.Item
            key={String(getKey(option))}
            label={getOptionLabel(option)}
            value={getKey(option)}
            style={{ color: "#000000", fontFamily: fontNames.regular }}
          />
        ))}
      </Picker>
      <FieldLabel label={label} active={active} focused={focused} />
    </View>
  );
};
