import { useState } from "react";
import type { LayoutChangeEvent, TextInputProps } from "react-native";
import { Platform, TextInput as RNTextInput, View } from "react-native";
import { NativeHost, NativeTextInput, useNativeState } from "~/ui/native/expo-ui";
import { colors } from "~/ui/colors";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "../text";

type Falsy = false | 0 | null | undefined;

interface Props extends Omit<TextInputProps, "onSubmitEditing"> {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: (text: string) => void;
  error?: string | Falsy;
}

export const TextField = ({ label, placeholder, error, onSubmitEditing, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputWidth, setInputWidth] = useState(0);
  const nativeValue = useNativeState(props.value);

  const handleLayout = (event: LayoutChangeEvent) => {
    setInputWidth(event.nativeEvent.layout.width);
  };

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      {Platform.OS === "android" ? (
        <FieldSurface focused={isFocused}>
          <RNTextInput
            {...props}
            onBlur={(event) => {
              setIsFocused(false);
              props.onBlur?.(event);
            }}
            onFocus={(event) => {
              setIsFocused(true);
              props.onFocus?.(event);
            }}
            onSubmitEditing={(event) => onSubmitEditing?.(event.nativeEvent.text)}
            placeholder={placeholder}
            placeholderTextColor="#98A2B3"
            selectionColor={colors.accent.DEFAULT}
            style={{
              color: "#111827",
              fontFamily: fontNames.regular,
              fontSize: 17,
              paddingHorizontal: 20,
              paddingVertical: 12,
            }}
          />
        </FieldSurface>
      ) : (
        <FieldSurface focused={isFocused} onLayout={handleLayout}>
          <NativeHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
            <NativeTextInput
              autoCapitalize={props.autoCapitalize}
              autoComplete={props.autoComplete}
              autoCorrect={props.autoCorrect}
              autoFocus={props.autoFocus}
              defaultValue={props.value}
              editable={props.editable}
              inputMode={props.inputMode}
              keyboardType={props.keyboardType}
              maxLength={props.maxLength}
              onBlur={() => {
                setIsFocused(false);
              }}
              onChangeText={props.onChangeText}
              onFocus={() => {
                setIsFocused(true);
              }}
              onSubmitEditing={onSubmitEditing}
              placeholder={placeholder}
              placeholderTextColor="#98A2B3"
              returnKeyType={props.returnKeyType}
              secureTextEntry={props.secureTextEntry}
              selectionColor={colors.accent.DEFAULT}
              testID={props.testID}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                width: inputWidth || undefined,
              }}
              textStyle={{
                color: "#111827",
                fontFamily: fontNames.regular,
                fontSize: 17,
              }}
              value={nativeValue}
            />
          </NativeHost>
        </FieldSurface>
      )}
      {error ? <Text className="px-1 text-danger">{error}</Text> : undefined}
    </View>
  );
};
