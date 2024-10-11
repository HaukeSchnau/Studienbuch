import { useState } from "react";
import { View } from "react-native";
import { startOfDay } from "date-fns";

import type { Grade } from "@stu/lib";

import { Button } from "~/components/button";
import { Divider } from "~/components/divider";
import { Text } from "~/components/text";
import { TextField } from "~/components/text-field";
import { api } from "~/utils/api";
import { GradeCard } from "../grade-card";

export const EditOralGrade = ({
  courseId,
  onClose,
  mostRecentConfirmedOralGrade,
}: {
  courseId: string;
  onClose: () => void;
  mostRecentConfirmedOralGrade: Grade | null;
}) => {
  const utils = api.useUtils();
  const upsertMutation = api.students.grades.upsert.useMutation({
    onSuccess: async () => {
      await utils.students.grades.invalidate();
      onClose();
    },
  });

  const restoreMutation = api.students.grades.restore.useMutation({
    onSuccess: async () => {
      await utils.students.grades.invalidate();
      onClose();
    },
  });

  const [points, setPoints] = useState("");
  const gradeNum = parseFloat(points.replaceAll(",", "."));
  const isValid = !isNaN(gradeNum) && gradeNum >= 0 && gradeNum <= 15;

  return (
    <View className="px-8 py-8">
      <Text variant="heading" className="text-center">
        Mündliche Mitarbeitsnote eintragen
      </Text>
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
        Diese Note muss im Nachhinein noch von deiner Lehrkraft und deinen
        Eltern bestätigt werden.
      </Text>

      {mostRecentConfirmedOralGrade && (
        <>
          <View className="h-4" />
          <Divider />
          <View className="h-4" />
          <Text className="text-lg">
            Alternativ kannst du deine letzte bestätigte Note wiederherstellen:
          </Text>
          <View className="h-4" />
          <GradeCard
            grade={mostRecentConfirmedOralGrade}
            actionText="Wiederherstellen"
            onClick={() =>
              restoreMutation.mutate({
                course: courseId,
                date: mostRecentConfirmedOralGrade.date,
                type: "ORAL",
              })
            }
          />
        </>
      )}

      <View className="h-6" />
      <Button
        disabled={!isValid}
        className="self-end"
        label="Speichern"
        onPress={() => {
          const date = startOfDay(new Date());
          upsertMutation.mutate({
            courseId,
            date,
            result: gradeNum,
            type: "ORAL",
          });
        }}
      />
    </View>
  );
};
