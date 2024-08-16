import { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { FieldLabel } from "./field-label";

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText: (text: string) => void;
}

export const TextField = ({ label, placeholder, ...props }: Props) => {
  const [isActive, setIsActive] = useState(false);
  const active = useSharedValue(false);
  const focused = useSharedValue(false);

  const onFocus = () => {
    setIsActive(true);
    active.value = true;
    focused.value = true;
  };
  const onBlur = () => {
    setIsActive(false);
    if (!props.value) {
      active.value = false;
    }
    focused.value = false;
  };

  return (
    <View>
      <TextInput
        {...props}
        placeholder={isActive ? placeholder : ""}
        className="rounded-3xl bg-[#E6E6E6] px-6 py-6"
        style={{
          fontFamily: "Nunito_400Regular",
        }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <FieldLabel label={label} active={active} focused={focused} />
    </View>
  );
};
