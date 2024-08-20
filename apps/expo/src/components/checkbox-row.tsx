import React from "react";
import { TouchableNativeFeedback, View } from "react-native";
import { Checkbox } from "expo-checkbox";

import { Text } from "./text";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export const CheckboxRow = ({ label, value, onChange }: Props) => {
  return (
    <TouchableNativeFeedback onPress={() => onChange(!value)}>
      <View className="flex-row justify-between px-4">
        <Text>{label}</Text>
        <Checkbox value={value} onValueChange={onChange} />
      </View>
    </TouchableNativeFeedback>
  );
};
