import { startOfDay } from "date-fns";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "~/components/button";
import { DateField } from "~/components/date-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
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
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Klausurnote eintragen
      </Text>
      <View className="h-6" />
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
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestaetigt werden.
      </Text>
      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          upsertGrade({ courseId, date, result: gradeNum, type: "WRITTEN" });
          onClose();
        }}
      />
    </View>
  );
};
