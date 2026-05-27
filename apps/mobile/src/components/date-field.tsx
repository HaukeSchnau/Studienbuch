import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useState } from "react";
import { Platform, TouchableNativeFeedback, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { colors } from "~/theme/colors";

import { FieldLabel } from "./field-label";
import { Text } from "./text";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
}

export const DateField = ({ value, label, onChange }: Props) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const active = useSharedValue(true);
  const focused = useSharedValue(false);

  const onFocus = () => {
    focused.value = true;
    setShowAndroidPicker(true);
  };

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
            <View className="rounded-3xl bg-[#E6E6E6] px-6 py-4">
              <Text>{format(value, "dd.MM.yyyy")}</Text>
            </View>
          </TouchableNativeFeedback>
        )}
        {Platform.OS === "android" && showAndroidPicker && (
          <DateTimePicker
            value={value}
            mode="date"
            accentColor={colors.primary.text}
            onChange={(event, date) => {
              setShowAndroidPicker(false);
              focused.value = false;
              if (event.type === "set" && date) {
                onChange(date);
              }
            }}
          />
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
              focused.value = false;
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
