import { useState } from "react";
import { View } from "react-native";
import { Button, OutlinedButton } from "~/components/button";
import { DateField } from "~/components/date-field";
import { Text } from "~/components/text";

interface Props {
  title: string;
  initialResult: number;
  initialDate?: Date;
  onSave: (payload: { result: number; date: Date }) => void;
  onClose: () => void;
}

export const GradeEditorSheet = ({
  title,
  initialResult,
  initialDate = new Date(),
  onSave,
  onClose,
}: Props) => {
  const [result, setResult] = useState(Math.round(initialResult));
  const [date, setDate] = useState(initialDate);

  return (
    <View className="px-4 py-2">
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      <View className="h-4" />

      <DateField value={date} onChange={setDate} label="Datum" />
      <View className="h-6" />

      <Text className="text-center text-lg opacity-70">Punktzahl</Text>
      <View className="h-3" />
      <View className="flex-row items-center justify-center gap-4">
        <OutlinedButton
          label="−"
          onPress={() => setResult((current) => Math.max(0, current - 1))}
        />
        <Text weight="bold" className="text-4xl">
          {result}
        </Text>
        <OutlinedButton
          label="+"
          onPress={() => setResult((current) => Math.min(15, current + 1))}
        />
      </View>

      <View className="h-6" />

      <View className="flex-row items-center justify-end gap-4">
        <OutlinedButton label="Abbrechen" onPress={onClose} />
        <Button label="Speichern" onPress={() => onSave({ result, date })} />
      </View>
    </View>
  );
};
