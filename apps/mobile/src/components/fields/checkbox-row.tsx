import { Checkbox } from "expo-checkbox";
import type { StyleProp, TextStyle } from "react-native";
import { Pressable, View } from "react-native";

import { colors } from "~/theme/colors";

import { Text } from "../ui/text";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  textStyle?: StyleProp<TextStyle>;
}

export const CheckboxRow = ({ label, textStyle, value, onChange }: Props) => {
  return (
    <Pressable onPress={() => onChange(!value)}>
      <View className="min-h-12 flex-row items-center justify-between rounded-[20px] bg-[#F6F8FB] px-4 py-3">
        <Text style={textStyle}>{label}</Text>
        <Checkbox value={value} onValueChange={onChange} color={colors.primary.DEFAULT} />
      </View>
    </Pressable>
  );
};
