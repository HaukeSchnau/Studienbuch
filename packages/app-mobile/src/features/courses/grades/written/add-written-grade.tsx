import { useQueryClient } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "~/components/button";
import { DateField } from "~/components/date-field";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { useRequiredAuthenticatedSession } from "~/utils/auth";
import { useIngest } from "~/utils/events/ingest";

export const AddWrittenGrade = ({ courseId, onClose }: { courseId: string; onClose: () => void }) => {
  const { userId } = useRequiredAuthenticatedSession();
  const queryClient = useQueryClient();
  const addMutation = useIngest("grades.writtenGradeRecorded", {
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["grades"],
      });
      onClose();
    },
  });

  const [points, setPoints] = useState("");
  const gradeNum = Number.parseFloat(points.replaceAll(",", "."));

  const [date, setDate] = useState(startOfDay(new Date()));

  const isValid = !Number.isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Klausurnote eintragen
      </Text>
      <View className="h-6" />
      <DateField value={date} onChange={setDate} label="Datum der Klausur" />
      <View className="h-6" />

      <TextField autoFocus label="Punkte" value={points} onChangeText={setPoints} keyboardType="numeric" />
      <View className="h-6" />
      <Text className="text-lg">
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen Eltern bestätigt werden.
      </Text>

      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          addMutation.mutate({
            studentId: userId,
            courseId,
            date,
            result: gradeNum,
          });
        }}
      />
    </View>
  );
};
