import DateTimePicker from "@expo/ui/community/datetime-picker";
import { format } from "date-fns";
import { useState } from "react";
import { Platform, TouchableNativeFeedback, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { colors } from "~/theme/colors";
import { FieldSurface } from "./field-surface";

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
            <FieldSurface className="px-6 py-4">
              <Text>{format(value, "dd.MM.yyyy")}</Text>
            </FieldSurface>
          </TouchableNativeFeedback>
        )}
        {Platform.OS === "android" && showAndroidPicker && (
          <DateTimePicker
            value={value}
            mode="date"
            accentColor={colors.primary.text}
            presentation="dialog"
            onValueChange={(_, date) => {
              setShowAndroidPicker(false);
              focused.value = false;
              onChange(date);
            }}
            onDismiss={() => {
              setShowAndroidPicker(false);
              focused.value = false;
            }}
          />
        )}
        {Platform.OS === "ios" && (
          <DateTimePicker
            style={{
              alignSelf: "flex-start",
              width: "100%",
            }}
            accentColor={colors.primary.text}
            display="compact"
            locale="de_DE"
            mode="date"
            onValueChange={(_, date) => {
              onChange(date);
              focused.value = false;
            }}
            value={value}
          />
        )}
        <FieldLabel label={label} active={active} focused={focused} />
      </View>
    </View>
  );
};
