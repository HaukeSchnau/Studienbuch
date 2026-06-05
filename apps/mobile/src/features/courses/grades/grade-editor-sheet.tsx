import { Host, Slider } from "@expo/ui";
import { useState } from "react";
import { View } from "react-native";
import { Button, OutlinedButton, TextButton } from "~/components/ui/button";
import { DateField } from "~/components/fields/date-field";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { Text } from "~/components/ui/text";
import { haptics } from "~/platform/haptics";

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
    <SheetScaffold
      title={title}
      footer={
        <View className="flex-row items-center justify-end gap-4">
          <TextButton label="Abbrechen" onPress={onClose} />
          <Button
            label="Speichern"
            onPress={() => {
              haptics.success();
              onSave({ result, date });
            }}
          />
        </View>
      }
    >
      <DateField value={date} onChange={setDate} label="Datum" />
      <View className="h-6" />

      <Text className="text-center text-lg opacity-70">Punktzahl</Text>
      <View className="h-3" />
      <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
        <Slider
          min={0}
          max={15}
          step={1}
          value={result}
          onValueChange={(value) => {
            haptics.selection();
            setResult(Math.round(value));
          }}
        />
      </Host>
      <View className="h-3" />
      <View className="flex-row items-center justify-center gap-4">
        <OutlinedButton
          label="−"
          size="sm"
          onPress={() => setResult((current) => Math.max(0, current - 1))}
        />
        <Text weight="bold" className="text-4xl">
          {result}
        </Text>
        <OutlinedButton
          label="+"
          size="sm"
          onPress={() => setResult((current) => Math.min(15, current + 1))}
        />
      </View>
    </SheetScaffold>
  );
};
