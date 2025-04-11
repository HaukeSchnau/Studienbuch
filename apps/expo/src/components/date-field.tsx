// import { useState } from "react";
import { Platform, TouchableNativeFeedback, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";

import { colors } from "@stu/tailwind-config/native";

import { FieldLabel } from "./field-label";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
}

export const DateField = ({ value, label, onChange }: Props) => {
  // const [isOpen, setIsOpen] = useState(false);
  const active = useSharedValue(true);
  const focused = useSharedValue(false);

  const onFocus = () => {
    // setIsOpen(true);
    focused.value = true;
  };
  // const onBlur = () => {
  //   setIsOpen(false);
  //   focused.value = false;
  // };

  return (
    <View>
      <View
        style={{
          // backgroundColor: "red",
          width: "100%",
          height: 48,
        }}
      >
        {Platform.OS === "android" && (
          <TouchableNativeFeedback onPress={onFocus}>
            <View className="rounded-3xl bg-[#E6E6E6] px-6 py-6" />
          </TouchableNativeFeedback>
        )}
        {Platform.OS === "ios" && (
          <DateTimePicker
            style={{
              alignSelf: "flex-start",
              width: "100%",
            }}
            value={value}
            onChange={(e, date) => {
              if (e.type === "set" && date) {
                onChange(date);
              }
            }}
            mode="date"
            accentColor={colors.primary.text}
            display="compact"
            locale="de-DE"
          />
        )}
        <FieldLabel label={label} active={active} focused={focused} />
      </View>
    </View>
  );
};
