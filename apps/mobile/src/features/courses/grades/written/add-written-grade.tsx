import { startOfDay } from "date-fns";
import { useState } from "react";
import { View } from "react-native";
import { Button, TextButton } from "~/components/button";
import { DateField } from "~/components/date-field";
import { SheetScaffold } from "~/components/sheet-scaffold";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { haptics } from "~/utils/haptics";
import { useMockApp } from "~/mock-app/provider";

export const AddWrittenGrade = ({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) => {
  const { upsertGrade } = useMockApp();
  const [points, setPoints] = useState("");
  const [date, setDate] = useState(startOfDay(new Date()));
  const gradeNum = Number.parseFloat(points.replaceAll(",", "."));
  const isValid = !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <SheetScaffold
      title="Klausurnote eintragen"
      footer={
        <View className="flex-row items-center justify-end gap-4">
          <TextButton label="Abbrechen" onPress={onClose} />
          <Button
            disabled={!isValid}
            label="Speichern"
            onPress={() => {
              upsertGrade({ courseId, date, result: gradeNum, type: "WRITTEN" });
              haptics.success();
              onClose();
            }}
          />
        </View>
      }
    >
      <DateField value={date} onChange={setDate} label="Datum der Klausur" />
      <View className="h-6" />
      <TextField
        autoFocus
        label="Punkte"
        value={points}
        onChangeText={setPoints}
        keyboardType="numeric"
      />
      <View className="h-6" />
      <Text className="text-lg">
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </Text>
    </SheetScaffold>
  );
};
