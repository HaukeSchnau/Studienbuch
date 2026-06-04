import { startOfDay } from "date-fns";
import { useState } from "react";
import { View } from "react-native";

import { Button, TextButton } from "~/components/ui/button";
import { DateField } from "~/components/fields/date-field";
import { SheetCallout } from "~/components/layout/sheet-callout";
import { SheetScaffold } from "~/components/layout/sheet-scaffold";
import { TextField } from "~/components/fields/text-field";
import { useGrades } from "~/data/hooks";
import { haptics } from "~/platform/haptics";

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
