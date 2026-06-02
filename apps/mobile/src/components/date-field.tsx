import DateTimePicker from "@expo/ui/community/datetime-picker";
import { format } from "date-fns";
import { useState } from "react";
import { Platform, Pressable, TouchableNativeFeedback, View } from "react-native";

import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { SystemIcon } from "./system-icon";
import { Text } from "./text";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
}

export const DateField = ({ value, label, onChange }: Props) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const formattedDate = format(value, "dd.MM.yyyy");

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>

      {Platform.OS === "android" ? (
        <>
          <TouchableNativeFeedback onPress={() => setShowAndroidPicker(true)}>
            <FieldSurface className="min-h-14 justify-center px-5 py-4" focused={showAndroidPicker}>
              <Text className="text-[17px] text-[#111827]">{formattedDate}</Text>
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
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowIOSPicker((current) => !current)}
          >
            <FieldSurface className="min-h-14 justify-center px-5 py-4" focused={showIOSPicker}>
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-[17px] text-[#111827]">{formattedDate}</Text>
                <SystemIcon name="calendar-today" size={21} color="#7B8794" />
              </View>
            </FieldSurface>
          </Pressable>

          {showIOSPicker ? (
            <View className="overflow-hidden rounded-[24px] border border-[#DCE4EE] bg-[#F8FAFC] px-2 py-2">
              <DateTimePicker
                style={{ height: 168 }}
                accentColor={colors.primary.text}
                display="spinner"
                locale="de_DE"
                mode="date"
                onValueChange={(_, date) => onChange(date)}
                value={value}
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
};
