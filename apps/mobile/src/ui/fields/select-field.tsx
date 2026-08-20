import { useEffect } from "react";
import { View } from "react-native";
import { NativeHost, NativePicker } from "~/ui/native/expo-ui";

import { FieldSurface } from "./field-surface";
import { Text } from "../text";
import { haptics } from "~/infra/native/haptics";

type PickerValue = string | number;

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

  const selectedValue = value ? getKey(value) : options[0] ? getKey(options[0]) : "";

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface className="min-h-14 justify-center px-3 py-1">
        <NativeHost style={{ width: "100%" }}>
          <NativePicker
            appearance="menu"
            enabled={options.length > 0}
            selectedValue={selectedValue}
            onValueChange={(nextValue) => {
              haptics.selection();
              onChange(options.find((option) => getKey(option) === nextValue));
            }}
          >
            {options.map((option) => (
              <NativePicker.Item
                key={String(getKey(option))}
                label={getOptionLabel(option)}
                value={getKey(option)}
              />
            ))}
          </NativePicker>
        </NativeHost>
      </FieldSurface>
    </View>
  );
};
