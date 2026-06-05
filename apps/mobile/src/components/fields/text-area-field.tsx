import { Host, TextInput as NativeTextInput, useNativeState } from "@expo/ui";
import { useEffect, useState } from "react";
import type { TextInputProps } from "react-native";
import { View } from "react-native";
import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "../ui/text";

interface Props extends TextInputProps {
  label: string;
}

export const TextAreaField = ({ label, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const nativeValue = useNativeState(props.value ?? "");

  useEffect(() => {
    nativeValue.value = props.value ?? "";
  }, [nativeValue, props.value]);

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface focused={isFocused} className="px-5 py-3">
        <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
          <NativeTextInput
            autoCapitalize={props.autoCapitalize}
            autoCorrect={props.autoCorrect}
            maxLength={props.maxLength}
            multiline
            numberOfLines={props.numberOfLines ?? 4}
            onBlur={() => {
              setIsFocused(false);
            }}
            onChangeText={props.onChangeText}
            onFocus={() => {
              setIsFocused(true);
            }}
            placeholder={props.placeholder}
            placeholderTextColor="#98A2B3"
            selectionColor={colors.accent.DEFAULT}
            style={{
              padding: 0,
              width: "100%",
            }}
            textStyle={{
              color: "#111827",
              fontFamily: fontNames.regular,
              fontSize: 16,
            }}
            value={nativeValue}
          />
        </Host>
      </FieldSurface>
    </View>
  );
};
