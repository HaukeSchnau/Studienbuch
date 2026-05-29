import { ActionSheetIOS, Platform, Pressable, View } from "react-native";
import { Picker } from "@expo/ui/community/picker";
import { useEffect } from "react";
import { useSharedValue } from "react-native-reanimated";
import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "./text";

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

  if (Platform.OS === "ios") {
    const selectedLabel = value ? getOptionLabel(value) : "Auswählen";

    return (
      <View className="relative h-16 justify-center">
        <FieldSurface>
          <Pressable
            className="px-6 py-4"
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
            <Text className="pt-3 text-center text-[17px]">{selectedLabel}</Text>
          </Pressable>
        </FieldSurface>
        <FieldLabel label={label} active={active} focused={focused} />
      </View>
    );
  }

  return (
    <View>
      <FieldSurface>
        <Picker
          selectedValue={value ? getKey(value) : undefined}
          onValueChange={(_, idx) => onChange(options[idx])}
          style={{
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
      </FieldSurface>
      <FieldLabel label={label} active={active} focused={focused} />
    </View>
  );
};
