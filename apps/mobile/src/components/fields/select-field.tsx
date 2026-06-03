import { useEffect } from "react";
import { ActionSheetIOS, Platform, Pressable, View } from "react-native";

import { FieldSurface } from "./field-surface";
import { SystemIcon } from "../ui/system-icon";
import { Text } from "../ui/text";

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

  const selectedLabel = value ? getOptionLabel(value) : "Auswählen";
  const selectNextOption = () => {
    if (options.length === 0) {
      return;
    }

    const currentIndex = value
      ? options.findIndex((option) => getKey(option) === getKey(value))
      : -1;
    const nextIndex = (currentIndex + 1) % options.length;
    onChange(options[nextIndex]);
  };

  if (Platform.OS === "ios") {
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
      <FieldSurface>
        <Pressable
          className="min-h-14 flex-row items-center justify-between px-5 py-4"
          onPress={selectNextOption}
        >
          <Text className="text-[17px] text-[#111827]">{selectedLabel}</Text>
          <SystemIcon name="chevron-right" size={20} color="#7B8794" />
        </Pressable>
      </FieldSurface>
    </View>
  );
};
