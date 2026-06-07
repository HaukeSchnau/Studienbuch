import { Checkbox, Host } from "@expo/ui";
import type { StyleProp, TextStyle } from "react-native";
import { View } from "react-native";
import { PressableSurface } from "~/components/feedback/pressable-surface";

import { haptics } from "~/platform/haptics";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  textStyle?: StyleProp<TextStyle>;
}

export const CheckboxRow = ({ label, value, onChange }: Props) => {
  return (
    <PressableSurface
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      borderRadius={20}
      className="min-h-12 justify-center bg-[#F6F8FB] px-4 py-3"
      haptic="none"
      onPress={() => {
        const nextValue = !value;
        haptics.toggle(nextValue);
        onChange(nextValue);
      }}
      pressedScale={0.99}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
          <Checkbox value={value} label={label} onValueChange={() => undefined} />
        </Host>
      </View>
    </PressableSurface>
  );
};
