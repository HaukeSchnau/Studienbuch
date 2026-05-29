import { useState } from "react";
import type { TextInputProps } from "react-native";
import { TextInput, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { FieldSurface } from "./field-surface";
import { FieldLabel } from "./field-label";
import { fontNames, Text } from "./text";

type Falsy = false | 0 | null | undefined;

interface Props extends TextInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  error?: string | Falsy;
}

export const TextField = ({ label, placeholder, error, ...props }: Props) => {
  const [isActive, setIsActive] = useState(false);
  const active = useSharedValue(props.value.length > 0);
  const focused = useSharedValue(false);

  const onFocus = () => {
    setIsActive(true);
    active.value = true;
    focused.value = true;
  };
  const onBlur = () => {
    setIsActive(false);
    if (!props.value) {
      active.value = false;
    }
    focused.value = false;
  };

  return (
    <View>
      <View className="relative h-16">
        <FieldSurface>
          <TextInput
            {...props}
            placeholder={isActive ? placeholder : ""}
            className="px-6 py-6"
            style={{
              fontFamily: fontNames.regular,
            }}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </FieldSurface>
        <FieldLabel label={label} active={active} focused={focused} />
      </View>
      {error ? <Text className="px-6 pt-1 text-danger">{error}</Text> : undefined}
    </View>
  );
};
