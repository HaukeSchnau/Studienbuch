import { Host, TextInput as NativeTextInput, useNativeState } from "@expo/ui";
import { useEffect, useState } from "react";
import type { TextInputProps } from "react-native";
import { View } from "react-native";
import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { fontNames, Text } from "../ui/text";

type Falsy = false | 0 | null | undefined;

interface Props extends TextInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
  error?: string | Falsy;
}

export const TextField = ({ label, placeholder, error, ...props }: Props) => {
  const [isFocused, setIsFocused] = useState(false);
  const nativeValue = useNativeState(props.value);

  useEffect(() => {
    nativeValue.value = props.value;
  }, [nativeValue, props.value]);

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>
      <FieldSurface focused={isFocused}>
        <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
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
            onSubmitEditing={(text) => props.onSubmitEditing?.({ nativeEvent: { text } } as never)}
            placeholder={placeholder}
            placeholderTextColor="#98A2B3"
            returnKeyType={props.returnKeyType}
            secureTextEntry={props.secureTextEntry}
            selectionColor={colors.accent.DEFAULT}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 12,
              width: "100%",
            }}
            textStyle={{
              color: "#111827",
              fontFamily: fontNames.regular,
              fontSize: 17,
            }}
            value={nativeValue}
          />
        </Host>
      </FieldSurface>
      {error ? <Text className="px-1 text-danger">{error}</Text> : undefined}
    </View>
  );
};
