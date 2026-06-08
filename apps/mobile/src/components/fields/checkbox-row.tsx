import { Checkbox, Host } from "@expo/ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import type { StyleProp, TextStyle } from "react-native";
import { Platform, View } from "react-native";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { nativeHostThemeProps } from "~/components/ui/native-theme";
import { Text } from "~/components/ui/text";

import { haptics } from "~/platform/haptics";
import { colors } from "~/theme/colors";

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  presentation?: "standalone" | "grouped";
  textStyle?: StyleProp<TextStyle>;
}

export const CheckboxRow = ({
  label,
  value,
  onChange,
  presentation = "standalone",
  textStyle,
}: Props) => {
  const isGrouped = presentation === "grouped";

  return (
    <PressableSurface
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      borderRadius={isGrouped ? 0 : 20}
      className={
        isGrouped
          ? "min-h-14 justify-center px-4 py-4"
          : "min-h-12 justify-center bg-[#F6F8FB] px-4 py-3"
      }
      haptic="none"
      onPress={() => {
        const nextValue = !value;
        haptics.toggle(nextValue);
        onChange(nextValue);
      }}
      pressedScale={isGrouped ? 0.997 : 0.99}
    >
      <View
        className="flex-row items-center gap-3"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        <Host matchContents {...nativeHostThemeProps(colors.primary.DEFAULT)}>
          <Checkbox
            value={value}
            onValueChange={() => undefined}
            modifiers={Platform.OS === "ios" ? [tint(colors.primary.DEFAULT)] : undefined}
          />
        </Host>
        <Text className="flex-1 text-[17px] text-[#111827]" style={textStyle} weight="semi-bold">
          {label}
        </Text>
      </View>
    </PressableSurface>
  );
};
