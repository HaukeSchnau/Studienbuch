import { Picker } from "@react-native-picker/picker";
import type { Key } from "react";
import { useEffect } from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { FieldLabel } from "./field-label";

interface Props<TOption> {
  label: string;
  value: TOption | undefined;
  getOptionLabel: (option: NonNullable<TOption>) => string;
  getKey: (option: NonNullable<TOption>) => Key;
  options: NonNullable<TOption>[];
  onChange: (value: TOption | undefined) => void;
}

export const SelectField = <TOption,>({
  label,
  value,
  getOptionLabel,
  getKey,
  options,
  onChange,
}: Props<TOption>) => {
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
          <Picker.Item key={getKey(option)} label={getOptionLabel(option)} value={getKey(option)} />
        ))}
      </Picker>
      <FieldLabel label={label} active={active} focused={focused} />
    </View>
  );
};
