import { useEffect } from "react";
import { Picker } from "@expo/ui/community/picker";
import { View } from "react-native";

import { FieldSurface } from "./field-surface";
import { Text } from "../ui/text";
import { haptics } from "~/platform/haptics";

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
  useEffect(() => {
    if (!value && options.length > 0) {
      onChange(options[0]);
    }
  }, [value, options, onChange]);

  const selectedValue = value ? getKey(value) : options[0] ? getKey(options[0]) : null;

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface className="min-h-14 justify-center px-3 py-1">
        <Picker
          enabled={options.length > 0}
          selectedValue={selectedValue}
          onValueChange={(nextValue) => {
            haptics.selection();
            onChange(options.find((option) => getKey(option) === nextValue));
          }}
          style={{ width: "100%" }}
        >
          {options.map((option) => (
            <Picker.Item
              key={String(getKey(option))}
              label={getOptionLabel(option)}
              value={getKey(option)}
            />
          ))}
        </Picker>
      </FieldSurface>
    </View>
  );
};
