import { format, startOfDay } from "date-fns";
import { useState } from "react";
import { Platform, View } from "react-native";

import { NativeDateTimePicker } from "~/components/native/expo-ui";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { colors } from "~/theme/colors";

import { FieldSurface } from "./field-surface";
import { Text } from "../ui/text";

interface Props {
  value: Date;
  label: string;
  onChange: (date: Date) => void;
}

export const DateField = ({ value, label, onChange }: Props) => {
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const formattedDate = format(value, "dd.MM.yyyy");
  const pickerValue = new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
  const handleDateChange = (date: Date) => {
    onChange(startOfDay(date));
  };

  if (Platform.OS === "ios") {
    return (
      <FieldSurface className="min-h-14 justify-center px-4 py-2" focused={false}>
        <View className="min-h-10 flex-row items-center justify-between gap-4">
          <Text className="mr-2 flex-1 text-[15px] text-[#5B6472]" weight="medium">
            {label}
          </Text>
          <NativeDateTimePicker
            accentColor={colors.primary.text}
            display="compact"
            locale="de_DE"
            mode="date"
            onValueChange={(_, date) => handleDateChange(date)}
            style={{ height: 38, width: 146 }}
            value={pickerValue}
          />
        </View>
      </FieldSurface>
    );
  }

  return (
    <View className="gap-2">
      <Text className="px-1 text-[15px] text-[#5B6472]" weight="medium">
        {label}
      </Text>

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
          <NativeDateTimePicker
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
    </View>
  );
};
