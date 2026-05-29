import { Picker } from "@expo/ui/community/picker";
import { useEffect } from "react";
import { ActionSheetIOS, Platform, Pressable, View } from "react-native";

import { FieldSurface } from "./field-surface";
import { SystemIcon } from "./system-icon";
import { fontNames, Text } from "./text";

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

  if (Platform.OS === "ios") {
    const selectedLabel = value ? getOptionLabel(value) : "Auswählen";

    return (
      <View className="gap-2">
        <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
          {label}
        </Text>
        <FieldSurface>
          <Pressable
            className="min-h-14 flex-row items-center justify-between px-5 py-4"
            onPress={() => {
              const labels = options.map((option) => getOptionLabel(option));

              ActionSheetIOS.showActionSheetWithOptions(
                {
                  options: [...labels, "Abbrechen"],
                  cancelButtonIndex: labels.length,
                },
                (buttonIndex) => {
                  if (buttonIndex >= 0 && buttonIndex < options.length) {
                    onChange(options[buttonIndex]);
                  }
                },
              );
            }}
          >
            <Text className="text-[17px] text-[#111827]">{selectedLabel}</Text>
            <SystemIcon name="chevron-right" size={20} color="#7B8794" />
          </Pressable>
        </FieldSurface>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface className="min-h-14 justify-center px-1">
        <Picker
          selectedValue={value ? getKey(value) : undefined}
          onValueChange={(_, idx) => onChange(options[idx])}
          style={{ height: 56 }}
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
      </FieldSurface>
    </View>
  );
};
