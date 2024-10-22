import type { TextInputProps } from "react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import type { Falsy } from "@stu/lib";

import { FieldLabel } from "./field-label";
import { Text } from "./text";

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
      <View>
        <TextInput
          {...props}
          placeholder={isActive ? placeholder : ""}
          className="rounded-3xl bg-[#E6E6E6] px-6 py-6"
          style={{
            fontFamily: "Nunito_400Regular",
          }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <FieldLabel label={label} active={active} focused={focused} />
      </View>
      {error ? (
        <Text className="px-6 pt-1 text-danger">{error}</Text>
      ) : undefined}
    </View>
  );
};
