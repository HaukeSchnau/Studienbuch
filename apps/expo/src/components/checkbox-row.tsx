import type { StyleProp, TextStyle } from "react-native";
import React from "react";
import { TouchableNativeFeedback, View } from "react-native";
import { Checkbox } from "expo-checkbox";

import { colors } from "@stu/tailwind-config/native";

import { Text } from "./text";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  textStyle?: StyleProp<TextStyle>;
}

export const CheckboxRow = ({ label, textStyle, value, onChange }: Props) => {
  return (
    <TouchableNativeFeedback onPress={() => onChange(!value)}>
      <View className="flex-row justify-between px-4">
        <Text style={textStyle}>{label}</Text>
        <Checkbox
          value={value}
          onValueChange={onChange}
          color={colors.primary.DEFAULT}
        />
      </View>
    </TouchableNativeFeedback>
  );
};
