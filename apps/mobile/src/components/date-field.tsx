import DateTimePicker from "@expo/ui/community/datetime-picker";
import { format } from "date-fns";
import { useState } from "react";
import { Platform, TouchableNativeFeedback, View } from "react-native";

import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { Text } from "./text";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
}

export const DateField = ({ value, label, onChange }: Props) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>

      {Platform.OS === "android" ? (
        <>
          <TouchableNativeFeedback onPress={() => setShowAndroidPicker(true)}>
            <FieldSurface className="min-h-14 justify-center px-5 py-4" focused={showAndroidPicker}>
              <Text className="text-[17px] text-[#111827]">{format(value, "dd.MM.yyyy")}</Text>
            </FieldSurface>
          </TouchableNativeFeedback>

          {showAndroidPicker ? (
            <DateTimePicker
              value={value}
              mode="date"
              accentColor={colors.primary.text}
              presentation="dialog"
              onValueChange={(_, date) => {
                setShowAndroidPicker(false);
                onChange(date);
              }}
              onDismiss={() => {
                setShowAndroidPicker(false);
              }}
            />
          ) : null}
        </>
      ) : (
        <FieldSurface className="min-h-14 justify-center px-4 py-2">
          <DateTimePicker
            style={{ alignSelf: "flex-start" }}
            accentColor={colors.primary.text}
            display="compact"
            locale="de_DE"
            mode="date"
            onValueChange={(_, date) => onChange(date)}
            value={value}
          />
        </FieldSurface>
      )}
    </View>
  );
};
