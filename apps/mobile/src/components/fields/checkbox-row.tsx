import { Checkbox, Host } from "@expo/ui";
import type { StyleProp, TextStyle } from "react-native";
import { View } from "react-native";

import { haptics } from "~/platform/haptics";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  textStyle?: StyleProp<TextStyle>;
}

export const CheckboxRow = ({ label, value, onChange }: Props) => {
  return (
    <View className="min-h-12 justify-center rounded-[20px] bg-[#F6F8FB] px-4 py-3">
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Checkbox
          value={value}
          label={label}
          onValueChange={(nextValue) => {
            haptics.toggle(nextValue);
            onChange(nextValue);
          }}
        />
      </Host>
    </View>
  );
};
