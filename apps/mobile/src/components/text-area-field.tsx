import { useState } from "react";
import type { TextInputProps } from "react-native";
import { TextInput, View } from "react-native";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "./text";

interface Props extends TextInputProps {
  label: string;
}

export const TextAreaField = ({ label, style, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface focused={isFocused} className="px-5 py-3">
        <TextInput
          {...props}
          multiline
          textAlignVertical="top"
          placeholderTextColor="#98A2B3"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[
            {
              minHeight: 84,
              fontFamily: fontNames.regular,
              fontSize: 16,
              color: "#111827",
            },
            style,
          ]}
        />
      </FieldSurface>
    </View>
  );
};
