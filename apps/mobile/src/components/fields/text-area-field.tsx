import { Host, TextInput as NativeTextInput, useNativeState } from "@expo/ui";
import { useState } from "react";
import type { LayoutChangeEvent, TextInputProps } from "react-native";
import { Platform, TextInput as RNTextInput, View } from "react-native";
import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "../ui/text";

interface Props extends TextInputProps {
  label: string;
}

export const TextAreaField = ({ label, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);
  const nativeValue = useNativeState(props.value ?? "");

  const handleLayout = (event: LayoutChangeEvent) => {
    setInputWidth(Math.max(0, event.nativeEvent.layout.width - 40));
  };

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      {Platform.OS === "android" ? (
        <FieldSurface focused={isFocused} className="px-5 py-3">
          <RNTextInput
            {...props}
            multiline
            numberOfLines={props.numberOfLines ?? 4}
            onBlur={(event) => {
              setIsFocused(false);
              props.onBlur?.(event);
            }}
            onFocus={(event) => {
              setIsFocused(true);
              props.onFocus?.(event);
            }}
            placeholderTextColor="#98A2B3"
            selectionColor={colors.accent.DEFAULT}
            style={{
              color: "#111827",
              fontFamily: fontNames.regular,
              fontSize: 16,
              minHeight: 88,
              padding: 0,
              textAlignVertical: "top",
            }}
          />
        </FieldSurface>
      ) : (
        <FieldSurface focused={isFocused} className="px-5 py-3" onLayout={handleLayout}>
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
                width: inputWidth || undefined,
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
      )}
    </View>
  );
};
