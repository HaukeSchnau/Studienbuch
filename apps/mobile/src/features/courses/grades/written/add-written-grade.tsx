import { startOfDay } from "date-fns";
import { useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/ui/button";
import { DateField } from "~/ui/fields/date-field";
import { SheetCallout } from "~/ui/layout/sheet-callout";
import { SheetScaffold } from "~/ui/layout/sheet-scaffold";
import { TextField } from "~/ui/fields/text-field";
import { useGrades } from "../use-grades";
import { haptics } from "~/infra/native/haptics";

export const AddWrittenGrade = ({
  courseId,
  onClose,
}: {
  courseId: string;
  onClose: () => void;
}) => {
  const { upsertGrade } = useGrades();
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
      <TextField
        autoFocus
        label="Punkte"
        value={points}
        onChangeText={setPoints}
        keyboardType="numeric"
      />
      <SheetCallout>
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </SheetCallout>
    </SheetScaffold>
  );
};
