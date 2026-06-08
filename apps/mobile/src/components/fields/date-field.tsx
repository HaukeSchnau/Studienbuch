import DateTimePicker from "@expo/ui/community/datetime-picker";
import { format, startOfDay } from "date-fns";
import { useState } from "react";
import { Platform, View } from "react-native";

import { PressableSurface } from "~/components/feedback/pressable-surface";
import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { SystemIcon } from "../ui/system-icon";
import { Text } from "../ui/text";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
  iosContainer?: "field" | "plain";
}

export const DateField = ({ value, label, onChange, iosContainer = "field" }: Props) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const formattedDate = format(value, "dd.MM.yyyy");
  const pickerValue = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  const handleDateChange = (date: Date) => {
    onChange(startOfDay(date));
  };

  const iosPicker = (
    <View className="min-h-10 flex-row items-center justify-between gap-3">
      <DateTimePicker
        accentColor={colors.primary.text}
        display="compact"
        locale="de_DE"
        mode="date"
        onValueChange={(_, date) => handleDateChange(date)}
        style={{ height: 38, width: 146 }}
        value={pickerValue}
      />
      <SystemIcon name="calendar-today" size={21} color="#7B8794" />
    </View>
  );

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>

      {Platform.OS === "ios" ? (
        iosContainer === "plain" ? (
          <View className="min-h-14 justify-center rounded-[22px] bg-[#F6F8FB] px-4 py-2">
            {iosPicker}
          </View>
        ) : (
          <FieldSurface className="min-h-14 justify-center px-4 py-2" focused={false}>
            {iosPicker}
          </FieldSurface>
        )
      ) : (
        <>
          <PressableSurface
            accessibilityLabel={`${label}: ${formattedDate}`}
            borderRadius={24}
            onPress={() => setShowAndroidPicker(true)}
            pressedScale={0.99}
          >
            <FieldSurface className="min-h-14 justify-center px-5 py-4" focused={showAndroidPicker}>
              <Text className="text-[17px] text-[#111827]">{formattedDate}</Text>
            </FieldSurface>
          </PressableSurface>

          {showAndroidPicker ? (
            <DateTimePicker
              value={pickerValue}
              mode="date"
              accentColor={colors.primary.text}
              presentation="dialog"
              onValueChange={(_, date) => {
                setShowAndroidPicker(false);
                handleDateChange(date);
              }}
              onDismiss={() => {
                setShowAndroidPicker(false);
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
};
